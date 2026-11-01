import { lstat, realpath, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { WorkspaceError } from "@task/workspace/errors";
import { isDeniedPath } from "@task/workspace/git/deny";
import { runGit, withTemporaryDirectory } from "@task/workspace/git/run";
import { ensureStore, type PrivateStore } from "@task/workspace/git/store";
import type {
  TrackingSegment,
  TrackingSummary,
  WorkspaceContext,
} from "@task/workspace/indexing/types";

export type FileChange = {
  path: string;
  oldPath?: string;
  status: "added" | "modified" | "deleted" | "renamed" | "copied" | "other";
  insertions: number;
  deletions: number;
  binary: boolean;
  /** Contents of protected paths (keys, .env files) are never shown. */
  denied: boolean;
};

export type SegmentChanges = {
  index: number;
  startedAt: string;
  endedAt?: string;
  live: boolean;
  truncated: boolean;
  endError?: string;
  files: FileChange[];
  totals: TrackingSummary;
};

export type TaskChanges =
  | { available: false; reason: string }
  | {
      available: true;
      segments: SegmentChanges[];
      files: FileChange[];
      totals: TrackingSummary;
      byDirectory: Record<string, TrackingSummary>;
      byExtension: Record<string, TrackingSummary>;
      durationMs: number;
    };

/** Limits that keep a snapshot of a large project bounded. */
export const snapshotLimits = {
  maxFiles: 20_000,
  maxFileBytes: 2_000_000,
  maxTotalBytes: 200_000_000,
};

const taskIdPattern = /^[A-Za-z0-9-]+$/;
const identity = {
  GIT_AUTHOR_NAME: "Task",
  GIT_AUTHOR_EMAIL: "task@localhost",
  GIT_COMMITTER_NAME: "Task",
  GIT_COMMITTER_EMAIL: "task@localhost",
  GIT_CONFIG_NOSYSTEM: "1",
};
const legacyPrefix = "refs/task/";

/** A place git commands can run against: the private store, or a project repository for old segments. */
type Repository = { cwd: string; env: Record<string, string> };

function projectDirectory(context: WorkspaceContext): string {
  return context.projectRoot ?? context.root;
}

export function trackingEnabled(context: WorkspaceContext): boolean {
  return context.config?.tracking?.enabled !== false;
}

export async function findGitRoot(projectRoot: string): Promise<string | undefined> {
  const result = await runGit(projectRoot, ["rev-parse", "--show-toplevel"]);
  if (result.code !== 0) return undefined;
  return realpath(result.stdout.trim());
}

async function git(repository: Repository, args: readonly string[], env?: Record<string, string>) {
  const result = await runGit(repository.cwd, args, { env: { ...repository.env, ...env } });
  if (result.code !== 0)
    throw new WorkspaceError("filesystem_error", `git ${args[0]} failed: ${result.stderr.trim()}`);
  return result.stdout;
}

function storeRepository(store: PrivateStore): Repository {
  return {
    cwd: store.projectRoot,
    env: { GIT_DIR: store.gitDir, GIT_WORK_TREE: store.projectRoot },
  };
}

function diffRepository(store: PrivateStore): Repository {
  return { cwd: store.gitDir, env: { GIT_DIR: store.gitDir } };
}

async function repositoryFor(context: WorkspaceContext, ref: string): Promise<Repository> {
  if (ref.startsWith(legacyPrefix)) {
    const root = await findGitRoot(projectDirectory(context));
    if (!root) throw new WorkspaceError("invalid_input", "Not a git repository");
    return { cwd: root, env: {} };
  }
  return diffRepository(await ensureStore(projectDirectory(context)));
}

function pinnedRef(taskId: string, label: "start" | "end"): string {
  if (!taskIdPattern.test(taskId))
    throw new WorkspaceError("invalid_input", `Cannot track task id ${taskId}`);
  return `refs/tracking/${taskId}/${Date.now()}-${label}`;
}

/**
 * Captures the project's files (honouring .gitignore files, built-in ignores and size limits,
 * excluding the workspace todo/ folder) as a commit in the private store. The project is only read.
 */
async function snapshot(
  context: WorkspaceContext,
  store: PrivateStore,
  ref?: string,
): Promise<{ commit: string; truncated: boolean }> {
  const repository = storeRepository(store);
  const todo = relative(store.projectRoot, join(await realpath(context.root), "todo"))
    .split(sep)
    .join("/");
  const excluded = todo.startsWith("..") ? undefined : `${todo}/`;
  return withTemporaryDirectory(async (directory) => {
    const env = { GIT_INDEX_FILE: join(directory, "index") };
    const listed = (
      await git(repository, ["ls-files", "-z", "--others", "--exclude-standard"], env)
    )
      .split("\0")
      .filter(Boolean);
    const chosen: string[] = [];
    let total = 0;
    let truncated = false;
    for (const path of listed) {
      if (excluded && (path === todo || path.startsWith(excluded))) continue;
      if (chosen.length >= snapshotLimits.maxFiles) {
        truncated = true;
        break;
      }
      let info: Awaited<ReturnType<typeof lstat>>;
      try {
        info = await lstat(join(store.projectRoot, path));
      } catch {
        continue;
      }
      if (info.isDirectory()) continue;
      if (
        info.size > snapshotLimits.maxFileBytes ||
        total + info.size > snapshotLimits.maxTotalBytes
      ) {
        truncated = true;
        continue;
      }
      total += info.size;
      chosen.push(path);
    }
    const pathspecs = join(directory, "paths");
    await writeFile(pathspecs, chosen.map((path) => `${path}\0`).join(""), { mode: 0o600 });
    if (chosen.length > 0)
      await git(
        repository,
        ["add", "--force", `--pathspec-from-file=${pathspecs}`, "--pathspec-file-nul"],
        env,
      );
    const tree = (await git(repository, ["write-tree"], env)).trim();
    const commit = (
      await git(
        repository,
        ["commit-tree", tree, "-m", truncated ? "task snapshot (truncated)" : "task snapshot"],
        identity,
      )
    ).trim();
    if (ref) await git(repository, ["update-ref", ref, commit]);
    return { commit, truncated };
  });
}

/** Opens a tracking window for a task. Needs only the git executable; the project need not be a repository. */
export async function startTracking(
  context: WorkspaceContext,
  taskId: string,
): Promise<TrackingSegment> {
  const store = await ensureStore(projectDirectory(context));
  const ref = pinnedRef(taskId, "start");
  const { truncated } = await snapshot(context, store, ref);
  return {
    base_ref: ref,
    started_at: new Date().toISOString(),
    ...(truncated ? { truncated } : {}),
  };
}

function emptySummary(): TrackingSummary {
  return { files: 0, insertions: 0, deletions: 0 };
}

function summarize(files: readonly FileChange[]): TrackingSummary {
  return files.reduce(
    (total, file) => ({
      files: total.files + 1,
      insertions: total.insertions + file.insertions,
      deletions: total.deletions + file.deletions,
    }),
    emptySummary(),
  );
}

const statusNames: Record<string, FileChange["status"]> = {
  A: "added",
  M: "modified",
  D: "deleted",
  R: "renamed",
  C: "copied",
};

async function diffFiles(repository: Repository, from: string, to: string): Promise<FileChange[]> {
  const numstat = (
    await git(repository, ["diff", "--numstat", "-z", "-M", "--no-color", from, to])
  ).split("\0");
  const nameStatus = (
    await git(repository, ["diff", "--name-status", "-z", "-M", "--no-color", from, to])
  ).split("\0");
  const statuses = new Map<string, FileChange["status"]>();
  for (let index = 0; index < nameStatus.length; ) {
    const code = nameStatus[index++] ?? "";
    if (!code) continue;
    const letter = code[0] ?? "";
    if (letter === "R" || letter === "C") {
      index++;
      statuses.set(nameStatus[index++] ?? "", statusNames[letter] ?? "other");
    } else statuses.set(nameStatus[index++] ?? "", statusNames[letter] ?? "other");
  }
  const files: FileChange[] = [];
  for (let index = 0; index < numstat.length; ) {
    const head = numstat[index++] ?? "";
    const match = /^(-|\d+)\t(-|\d+)\t([\s\S]*)$/.exec(head);
    if (!match) continue;
    let path = match[3] ?? "";
    let oldPath: string | undefined;
    if (path === "") {
      oldPath = numstat[index++];
      path = numstat[index++] ?? "";
    }
    files.push({
      path,
      ...(oldPath ? { oldPath } : {}),
      status: statuses.get(path) ?? "other",
      insertions: match[1] === "-" ? 0 : Number(match[1]),
      deletions: match[2] === "-" ? 0 : Number(match[2]),
      binary: match[1] === "-",
      denied: isDeniedPath(path) || (oldPath !== undefined && isDeniedPath(oldPath)),
    });
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

/** Closes a tracking window with an end snapshot; failures are recorded instead of blocking the task. */
export async function endTracking(
  context: WorkspaceContext,
  taskId: string,
  segment: TrackingSegment,
): Promise<TrackingSegment> {
  const endedAt = new Date().toISOString();
  try {
    const store = await ensureStore(projectDirectory(context));
    const ref = pinnedRef(taskId, "end");
    const { truncated } = await snapshot(context, store, ref);
    const summary = summarize(
      await diffFiles(await repositoryFor(context, segment.base_ref), segment.base_ref, ref),
    );
    return {
      ...segment,
      end_ref: ref,
      ended_at: endedAt,
      summary,
      ...(truncated || segment.truncated ? { truncated: true } : {}),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ...segment, ended_at: endedAt, end_error: message.slice(0, 200) };
  }
}

function mergeFiles(segments: readonly SegmentChanges[]): FileChange[] {
  const merged = new Map<string, FileChange>();
  for (const segment of segments)
    for (const file of segment.files) {
      const existing = merged.get(file.path);
      merged.set(
        file.path,
        existing
          ? {
              ...existing,
              insertions: existing.insertions + file.insertions,
              deletions: existing.deletions + file.deletions,
            }
          : file,
      );
    }
  return [...merged.values()].sort((a, b) => a.path.localeCompare(b.path));
}

function group(files: readonly FileChange[], key: (file: FileChange) => string) {
  const groups: Record<string, TrackingSummary> = {};
  for (const file of files) {
    const name = key(file);
    const current = groups[name] ?? emptySummary();
    groups[name] = {
      files: current.files + 1,
      insertions: current.insertions + file.insertions,
      deletions: current.deletions + file.deletions,
    };
  }
  return groups;
}

async function segmentEnd(
  context: WorkspaceContext,
  segment: TrackingSegment,
): Promise<string | undefined> {
  if (segment.end_ref) return segment.end_ref;
  if (segment.ended_at) return undefined;
  const store = await ensureStore(projectDirectory(context));
  return (await snapshot(context, store)).commit;
}

/** Changes made while a task was in progress. Open segments are measured against the live working tree. */
export async function getTaskChanges(
  context: WorkspaceContext,
  segments: readonly TrackingSegment[],
): Promise<TaskChanges> {
  const results: SegmentChanges[] = [];
  let durationMs = 0;
  try {
    for (const [index, segment] of segments.entries()) {
      const end = await segmentEnd(context, segment);
      const files = end
        ? await diffFiles(await repositoryFor(context, segment.base_ref), segment.base_ref, end)
        : [];
      durationMs +=
        (segment.ended_at ? Date.parse(segment.ended_at) : Date.now()) -
        Date.parse(segment.started_at);
      results.push({
        index,
        startedAt: segment.started_at,
        ...(segment.ended_at ? { endedAt: segment.ended_at } : {}),
        live: !segment.ended_at,
        truncated: Boolean(segment.truncated),
        ...(segment.end_error ? { endError: segment.end_error } : {}),
        files,
        totals: summarize(files),
      });
    }
  } catch (error) {
    return {
      available: false,
      reason: error instanceof Error ? error.message : "Change tracking is unavailable",
    };
  }
  const files = mergeFiles(results);
  return {
    available: true,
    segments: results,
    files,
    totals: summarize(files),
    byDirectory: group(files, (file) =>
      file.path.includes("/") ? (file.path.split("/")[0] ?? ".") : ".",
    ),
    byExtension: group(files, (file) => {
      const name = file.path.split("/").pop() ?? "";
      const dot = name.lastIndexOf(".");
      return dot > 0 ? name.slice(dot) : "(none)";
    }),
    durationMs: Math.max(0, durationMs),
  };
}

/** Unified diff of one changed file in a segment; protected paths are refused. */
export async function getTaskFileDiff(
  context: WorkspaceContext,
  segments: readonly TrackingSegment[],
  segmentIndex: number,
  path: string,
): Promise<{ diff: string; truncated: boolean }> {
  const segment = segments[segmentIndex];
  if (!segment) throw new WorkspaceError("not_found", `No tracking segment ${segmentIndex}`);
  if (isDeniedPath(path))
    throw new WorkspaceError("invalid_input", "Diff content is hidden for protected paths");
  const end = await segmentEnd(context, segment);
  if (!end) throw new WorkspaceError("not_found", "This segment has no end snapshot");
  const repository = await repositoryFor(context, segment.base_ref);
  const changed = await diffFiles(repository, segment.base_ref, end);
  const file = changed.find((candidate) => candidate.path === path);
  if (!file) throw new WorkspaceError("not_found", `${path} did not change in this segment`);
  const pathspecs = [
    `:(literal)${file.path}`,
    ...(file.oldPath ? [`:(literal)${file.oldPath}`] : []),
  ];
  const result = await runGit(
    repository.cwd,
    ["diff", "--no-color", "--no-ext-diff", "-M", segment.base_ref, end, "--", ...pathspecs],
    { maxBytes: 1_000_000, env: repository.env },
  );
  if (result.code !== 0)
    throw new WorkspaceError("filesystem_error", `git diff failed: ${result.stderr.trim()}`);
  return { diff: result.stdout, truncated: result.truncated };
}
