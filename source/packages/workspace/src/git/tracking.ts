import { realpath } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { WorkspaceError } from "@task/workspace/errors";
import { isDeniedPath } from "@task/workspace/git/deny";
import { runGit, withTemporaryDirectory } from "@task/workspace/git/run";
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

const taskIdPattern = /^[A-Za-z0-9-]+$/;
const identity = {
  GIT_AUTHOR_NAME: "Task",
  GIT_AUTHOR_EMAIL: "task@localhost",
  GIT_COMMITTER_NAME: "Task",
  GIT_COMMITTER_EMAIL: "task@localhost",
};

export async function findGitRoot(projectRoot: string): Promise<string | undefined> {
  const result = await runGit(projectRoot, ["rev-parse", "--show-toplevel"]);
  if (result.code !== 0) return undefined;
  return realpath(result.stdout.trim());
}

async function git(root: string, args: readonly string[], env?: Record<string, string>) {
  const result = await runGit(root, args, { env });
  if (result.code !== 0)
    throw new WorkspaceError("filesystem_error", `git ${args[0]} failed: ${result.stderr.trim()}`);
  return result.stdout;
}

function projectDirectory(context: WorkspaceContext): string {
  return context.projectRoot ?? context.root;
}

/**
 * Captures the working tree (including uncommitted and untracked files that are not ignored) as a
 * commit, using a temporary index so the repository's index, branches and working tree are untouched.
 * The workspace's todo/ folder is excluded. When `ref` is given the commit is pinned there so
 * `git gc` cannot prune it.
 */
async function snapshot(
  context: WorkspaceContext,
  gitRoot: string,
  ref?: string,
): Promise<{ commit: string; head?: string }> {
  const headResult = await runGit(gitRoot, ["rev-parse", "--verify", "--quiet", "HEAD^{commit}"]);
  const head = headResult.code === 0 ? headResult.stdout.trim() : undefined;
  const todo = relative(gitRoot, join(await realpath(context.root), "todo"));
  const pathspec = [
    ".",
    ...(todo.startsWith("..") ? [] : [`:(exclude,literal)${todo.split(sep).join("/")}`]),
  ];
  return withTemporaryDirectory(async (directory) => {
    const env = { GIT_INDEX_FILE: join(directory, "index") };
    await git(gitRoot, head ? ["read-tree", head] : ["read-tree", "--empty"], env);
    await git(gitRoot, ["add", "-A", "--", ...pathspec], env);
    const tree = (await git(gitRoot, ["write-tree"], env)).trim();
    const commit = (
      await git(
        gitRoot,
        ["commit-tree", tree, ...(head ? ["-p", head] : []), "-m", "task snapshot"],
        identity,
      )
    ).trim();
    if (ref) await git(gitRoot, ["update-ref", ref, commit]);
    return { commit, head };
  });
}

function pinnedRef(taskId: string, label: "start" | "end"): string {
  if (!taskIdPattern.test(taskId))
    throw new WorkspaceError("invalid_input", `Cannot track task id ${taskId}`);
  return `refs/task/tracking/${taskId}/${Date.now()}-${label}`;
}

export async function startTracking(
  context: WorkspaceContext,
  taskId: string,
): Promise<TrackingSegment> {
  const gitRoot = await findGitRoot(projectDirectory(context));
  if (!gitRoot)
    throw new WorkspaceError("invalid_input", "Git change tracking needs a git repository");
  const ref = pinnedRef(taskId, "start");
  const { head } = await snapshot(context, gitRoot, ref);
  return {
    base_ref: ref,
    ...(head ? { base_commit: head } : {}),
    started_at: new Date().toISOString(),
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

async function diffFiles(gitRoot: string, from: string, to: string): Promise<FileChange[]> {
  const numstat = (
    await git(gitRoot, ["diff", "--numstat", "-z", "-M", "--no-color", from, to])
  ).split("\0");
  const nameStatus = (
    await git(gitRoot, ["diff", "--name-status", "-z", "-M", "--no-color", from, to])
  ).split("\0");
  const statuses = new Map<string, FileChange["status"]>();
  for (let index = 0; index < nameStatus.length; ) {
    const code = nameStatus[index++] ?? "";
    if (!code) continue;
    const letter = code[0] ?? "";
    if (letter === "R" || letter === "C") {
      index++;
      const target = nameStatus[index++] ?? "";
      statuses.set(target, statusNames[letter] ?? "other");
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

export async function endTracking(
  context: WorkspaceContext,
  taskId: string,
  segment: TrackingSegment,
): Promise<TrackingSegment> {
  const endedAt = new Date().toISOString();
  try {
    const gitRoot = await findGitRoot(projectDirectory(context));
    if (!gitRoot) throw new WorkspaceError("invalid_input", "Not a git repository any more");
    const ref = pinnedRef(taskId, "end");
    await snapshot(context, gitRoot, ref);
    const summary = summarize(await diffFiles(gitRoot, segment.base_ref, ref));
    return { ...segment, end_ref: ref, ended_at: endedAt, summary };
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
  gitRoot: string,
  segment: TrackingSegment,
): Promise<string | undefined> {
  if (segment.end_ref) return segment.end_ref;
  if (segment.ended_at) return undefined;
  return (await snapshot(context, gitRoot)).commit;
}

/** Changes made while a task was in progress. Open segments are measured against the live working tree. */
export async function getTaskChanges(
  context: WorkspaceContext,
  segments: readonly TrackingSegment[],
): Promise<TaskChanges> {
  const gitRoot = await findGitRoot(projectDirectory(context));
  if (!gitRoot) return { available: false, reason: "Not a git repository" };
  const results: SegmentChanges[] = [];
  let durationMs = 0;
  for (const [index, segment] of segments.entries()) {
    const end = await segmentEnd(context, gitRoot, segment);
    const files = end ? await diffFiles(gitRoot, segment.base_ref, end) : [];
    durationMs +=
      (segment.ended_at ? Date.parse(segment.ended_at) : Date.now()) -
      Date.parse(segment.started_at);
    results.push({
      index,
      startedAt: segment.started_at,
      ...(segment.ended_at ? { endedAt: segment.ended_at } : {}),
      live: !segment.ended_at,
      ...(segment.end_error ? { endError: segment.end_error } : {}),
      files,
      totals: summarize(files),
    });
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
  const gitRoot = await findGitRoot(projectDirectory(context));
  if (!gitRoot) throw new WorkspaceError("invalid_input", "Not a git repository");
  const end = await segmentEnd(context, gitRoot, segment);
  if (!end) throw new WorkspaceError("not_found", "This segment has no end snapshot");
  const changed = await diffFiles(gitRoot, segment.base_ref, end);
  const file = changed.find((candidate) => candidate.path === path);
  if (!file) throw new WorkspaceError("not_found", `${path} did not change in this segment`);
  const pathspecs = [
    `:(literal)${file.path}`,
    ...(file.oldPath ? [`:(literal)${file.oldPath}`] : []),
  ];
  const result = await runGit(
    gitRoot,
    ["diff", "--no-color", "--no-ext-diff", "-M", segment.base_ref, end, "--", ...pathspecs],
    { maxBytes: 1_000_000 },
  );
  if (result.code !== 0)
    throw new WorkspaceError("filesystem_error", `git diff failed: ${result.stderr.trim()}`);
  return { diff: result.stdout, truncated: result.truncated };
}
