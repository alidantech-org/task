import { lstat, readdir, realpath } from "node:fs/promises";
import { isAbsolute, join, relative, sep } from "node:path";
import { WorkspaceError } from "@task/workspace/errors";
import { shouldIgnoreDirectory } from "@task/workspace/discovery/ignore";
import { languageForPath } from "@task/workspace/files/language";
import { readProjectFile } from "@task/workspace/files/read";
import { isDeniedPath } from "@task/workspace/git/deny";
import { runGit } from "@task/workspace/git/run";
import type { WorkspaceContext } from "@task/workspace/indexing/types";
import { replaceFile } from "@task/workspace/operations/mutate";
import { resolveSafeWorkspacePath } from "@task/workspace/paths/safe-path";

export type ProjectTreeFile = {
  path: string;
  name: string;
  kind: "file";
  size: number;
  language: string;
  status?: "added" | "modified" | "deleted" | "renamed" | "untracked" | "other";
  oldPath?: string;
};
export type ProjectTreeFolder = { path: string; name: string; kind: "directory" };
export type ProjectTreeEntry = ProjectTreeFile | ProjectTreeFolder;
export type ProjectTree = {
  files: ProjectTreeFile[];
  folders: ProjectTreeFolder[];
  gitRoot?: string;
};
export type ProjectSearchHit = { path: string; line: number; text: string };

const maxProjectTreeFiles = 30_000;
const maxProjectDiffBytes = 2_000_000;
const maxProjectSearchBytes = 40_000_000;

function ignoredPath(path: string): boolean {
  return path.split("/").some((segment) => shouldIgnoreDirectory(segment));
}

function statusFor(code: string): ProjectTreeFile["status"] {
  if (code === "??") return "untracked";
  if (code.includes("A")) return "added";
  if (code.includes("D")) return "deleted";
  if (code.includes("R")) return "renamed";
  if (code.includes("M")) return "modified";
  return "other";
}

function parseStatus(output: string, prefix: string): Map<string, { status: ProjectTreeFile["status"]; oldPath?: string }> {
  const parts = output.split("\0");
  const statuses = new Map<string, { status: ProjectTreeFile["status"]; oldPath?: string }>();
  for (let index = 0; index < parts.length; ) {
    const record = parts[index++] ?? "";
    if (!record) continue;
    const code = record.slice(0, 2);
    let path = record.slice(3);
    let oldPath: string | undefined;
    if (code.includes("R") || code.includes("C")) {
      oldPath = path;
      path = parts[index++] ?? "";
    }
    if (prefix && !path.startsWith(`${prefix}/`)) continue;
    const localPath = prefix ? path.slice(prefix.length + 1) : path;
    if (!localPath || isDeniedPath(localPath)) continue;
    statuses.set(localPath, { status: statusFor(code), ...(oldPath ? { oldPath } : {}) });
  }
  return statuses;
}

async function projectRoot(context: WorkspaceContext): Promise<string> {
  return realpath(context.projectRoot ?? context.root);
}

async function gitFiles(root: string, gitRoot: string): Promise<string[]> {
  const prefix = relative(gitRoot, root).split(sep).join("/");
  const args = ["ls-files", "-z", "--cached", "--others", "--exclude-standard"];
  if (prefix) args.push("--", prefix);
  const result = await runGit(gitRoot, args);
  if (result.code !== 0) return [];
  return result.stdout
    .split("\0")
    .filter(Boolean)
    .map((path) => (prefix ? path.slice(prefix.length + 1) : path))
    .filter((path) => path && !path.startsWith("../") && !isDeniedPath(path) && !ignoredPath(path));
}

async function walkedFiles(root: string): Promise<string[]> {
  const found: string[] = [];
  async function visit(directory: string, relativeDirectory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory() && shouldIgnoreDirectory(entry.name)) continue;
      const path = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
      if (isDeniedPath(path)) continue;
      if (entry.isDirectory()) await visit(join(directory, entry.name), path);
      else if (entry.isFile()) found.push(path);
      if (found.length >= maxProjectTreeFiles) return;
    }
  }
  await visit(root, "");
  return found;
}

/** Lists project files without following symlinks, applying Git ignore rules and Task's protected-path policy. */
export async function listProjectTree(context: WorkspaceContext): Promise<ProjectTree> {
  const root = await projectRoot(context);
  const rootGit = await runGit(root, ["rev-parse", "--show-toplevel"]);
  const gitRoot = rootGit.code === 0 ? await realpath(rootGit.stdout.trim()) : undefined;
  const files = gitRoot ? await gitFiles(root, gitRoot) : await walkedFiles(root);
  const statusMap = new Map<string, { status: ProjectTreeFile["status"]; oldPath?: string }>();
  if (gitRoot) {
    const prefix = relative(gitRoot, root).split(sep).join("/");
    const args = ["status", "--porcelain=v1", "-z", "--untracked-files=all"];
    if (prefix) args.push("--", prefix);
    const result = await runGit(gitRoot, args);
    if (result.code === 0) {
      for (const [path, change] of parseStatus(result.stdout, prefix)) statusMap.set(path, change);
    }
  }
  const folders = new Map<string, ProjectTreeFolder>();
  const fileEntries: ProjectTreeFile[] = [];
  for (const path of [...new Set(files)].slice(0, maxProjectTreeFiles).sort()) {
    let absolute: string;
    try {
      absolute = await resolveSafeWorkspacePath(root, path);
      const info = await lstat(absolute);
      if (!info.isFile() || info.isSymbolicLink()) continue;
      fileEntries.push({
        path,
        name: path.split("/").at(-1) ?? path,
        kind: "file",
        size: info.size,
        language: languageForPath(path),
        ...(statusMap.get(path) ?? {}),
      });
    } catch {
      // Paths removed during a scan are omitted from the tree; Git still reports their status.
      continue;
    }
    const segments = path.split("/");
    let current = "";
    for (const segment of segments.slice(0, -1)) {
      current = current ? `${current}/${segment}` : segment;
      folders.set(current, { path: current, name: segment, kind: "directory" });
    }
  }
  for (const [path, change] of statusMap) {
    if (change.status !== "deleted" || fileEntries.some((file) => file.path === path)) continue;
    fileEntries.push({
      path,
      name: path.split("/").at(-1) ?? path,
      kind: "file",
      size: 0,
      language: languageForPath(path),
      ...(change.status ? { status: change.status } : {}),
      ...(change.oldPath ? { oldPath: change.oldPath } : {}),
    });
  }
  return { files: fileEntries.sort((left, right) => left.path.localeCompare(right.path)), folders: [...folders.values()].sort((left, right) => left.path.localeCompare(right.path)), ...(gitRoot ? { gitRoot } : {}) };
}

/** Reads the committed HEAD version of one safe project file for Monaco's side-by-side diff view. */
export async function readProjectFileOriginal(context: WorkspaceContext, path: string): Promise<string> {
  if (!path || path.includes("\0") || isAbsolute(path) || isDeniedPath(path))
    throw new WorkspaceError("path_not_safe", "This project path cannot be shown");
  const root = await projectRoot(context);
  await resolveSafeWorkspacePath(root, path);
  const gitResult = await runGit(root, ["rev-parse", "--show-toplevel"]);
  if (gitResult.code !== 0) return "";
  const rootGit = await realpath(gitResult.stdout.trim());
  const prefix = relative(rootGit, root).split(sep).join("/");
  const gitPath = prefix ? `${prefix}/${path}` : path;
  const result = await runGit(rootGit, ["show", `HEAD:${gitPath}`], { maxBytes: maxProjectDiffBytes });
  if (result.code !== 0) return "";
  if (result.truncated)
    throw new WorkspaceError("validation_failed", "The committed file is too large to compare");
  return result.stdout;
}

/** Saves an existing safe text file with optimistic concurrency and atomic replacement. */
export async function writeProjectFile(
  context: WorkspaceContext,
  path: string,
  content: string,
  expectedHash: string,
): Promise<Awaited<ReturnType<typeof readProjectFile>>> {
  if (!path || path.includes("\0") || isAbsolute(path) || isDeniedPath(path))
    throw new WorkspaceError("path_not_safe", "This project path cannot be edited");
  if (content.includes("\0")) throw new WorkspaceError("invalid_input", "Text files cannot contain null bytes");
  const bytes = Buffer.byteLength(content, "utf8");
  if (bytes > 1_000_000)
    throw new WorkspaceError("validation_failed", "Code files are limited to 1 MB");
  const root = await projectRoot(context);
  const projectContext = { ...context, root, projectRoot: root };
  const current = await readProjectFile(projectContext, path);
  if (current.binary) throw new WorkspaceError("invalid_input", "Binary files cannot be edited here");
  await replaceFile(projectContext, path, content, expectedHash);
  return readProjectFile(projectContext, path);
}

/** Searches visible project text files for an exact query, with bounded file and result counts. */
export async function searchProjectFiles(
  context: WorkspaceContext,
  query: string,
): Promise<ProjectSearchHit[]> {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return [];
  const tree = await listProjectTree(context);
  const hits: ProjectSearchHit[] = [];
  let visited = 0;
  let searchedBytes = 0;
  for (const file of tree.files) {
    if (visited >= 500 || hits.length >= 200 || searchedBytes >= maxProjectSearchBytes) break;
    visited += 1;
    try {
      const projectFile = await readProjectFile(context, file.path);
      if (projectFile.size > 300_000 || projectFile.binary) continue;
      const text = projectFile.content;
      searchedBytes += projectFile.size;
      const lines = text.split("\n");
      for (let index = 0; index < lines.length && hits.length < 200; index += 1) {
        const line = lines[index] ?? "";
        if (line.toLocaleLowerCase().includes(needle))
          hits.push({ path: file.path, line: index + 1, text: line.trim().slice(0, 280) });
      }
    } catch {
      // A file can change between listing and reading; skip it and continue the search.
    }
  }
  return hits;
}
