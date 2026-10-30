import { type Dirent, type FSWatcher, watch } from "node:fs";
import { lstat, readdir, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

function isWithin(root: string, candidate: string): boolean {
  const pathFromRoot = relative(root, candidate);
  return (
    pathFromRoot === "" ||
    (!isAbsolute(pathFromRoot) && pathFromRoot !== ".." && !pathFromRoot.startsWith(`..${sep}`))
  );
}

/**
 * Resolve a path and verify lexical containment within the selected workspace.
 * This does not inspect the filesystem and must not be used as the only security check.
 */
export function resolveWorkspacePath(root: string, candidate: string): string {
  const absoluteRoot = resolve(root);
  const absoluteCandidate = resolve(absoluteRoot, candidate);
  if (!isWithin(absoluteRoot, absoluteCandidate)) {
    throw new Error("Path is outside the selected workspace");
  }
  return absoluteCandidate;
}

/**
 * Resolve a workspace path while rejecting existing symlink ancestors that escape it.
 * Missing final path segments are allowed so callers can safely create new files.
 */
export async function resolveSafeWorkspacePath(root: string, candidate: string): Promise<string> {
  const lexicalRoot = resolve(root);
  const target = resolveWorkspacePath(lexicalRoot, candidate);
  const realRoot = await realpath(lexicalRoot);
  let ancestor = target;

  while (true) {
    try {
      await lstat(ancestor);
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
        throw new Error("Unable to inspect workspace path safely");
      }
      const parent = resolve(ancestor, "..");
      if (parent === ancestor) {
        throw new Error("Unable to verify workspace path safely");
      }
      ancestor = parent;
      continue;
    }

    let realAncestor: string;
    try {
      realAncestor = await realpath(ancestor);
    } catch {
      throw new Error("Unable to resolve workspace path safely");
    }
    if (!isWithin(realRoot, realAncestor)) {
      throw new Error("Path is outside the selected workspace");
    }
    return target;
  }
}

export type WorkspaceContext = { root: string };
export type DocumentMetadata = {
  id: string;
  name: string;
  type: string;
  tags: readonly string[];
  status?: string;
  dates: Readonly<Record<string, string>>;
};
export type DocumentSummary = {
  path: string;
  metadata: DocumentMetadata;
  size: number;
  modifiedAt: number;
  contentHash: string;
  changeTime: number;
  fileId: string;
};
export type ValidationDiagnostic = { path: string; message: string };
export type WorkspaceIndex = {
  root: string;
  documents: ReadonlyMap<string, DocumentSummary>;
  diagnostics: readonly ValidationDiagnostic[];
  scannedAt: number;
  fingerprints: ReadonlyMap<string, string>;
};
export type IndexChange =
  | { type: "added" | "updated"; document: DocumentSummary }
  | { type: "removed"; path: string }
  | { type: "invalid"; diagnostic: ValidationDiagnostic }
  | { type: "repaired"; path: string }
  | { type: "reset"; index: WorkspaceIndex };
export type IndexChangeListener = (change: IndexChange) => void;
export type WatchOptions = {
  debounceMs?: number;
  reconcileEveryMs?: number;
  onError?: (error: Error) => void;
};
export type WorkspaceWatcher = {
  getSnapshot(): WorkspaceIndex;
  reconcile(): Promise<WorkspaceIndex>;
  close(): void;
};

const ignoredDirectoryNames = new Set([
  ".git",
  ".task",
  ".tasks-cache",
  ".cache",
  "node_modules",
  "vendor",
  "build",
  "dist",
  ".next",
  ".dart_tool",
  "coverage",
  "tmp",
  "temp",
]);

function hashContent(content: string): string {
  return new Bun.CryptoHasher("sha256").update(content).digest("hex");
}

function parseMetadata(content: string): DocumentMetadata {
  const match = /^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content);
  if (!match) throw new Error("Missing YAML frontmatter block");
  const parsed = Bun.YAML.parse(match[1]);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Frontmatter must be a YAML mapping");
  }
  const values = parsed as Record<string, unknown>;
  const scalar = (key: string): string | undefined =>
    typeof values[key] === "string" || typeof values[key] === "number"
      ? String(values[key])
      : undefined;
  const id = scalar("id");
  const name = scalar("name");
  const type = scalar("type");
  if (!id || !name || !type) throw new Error("Frontmatter requires non-empty id, name, and type");
  const rawTags = values.tags ?? [];
  if (!Array.isArray(rawTags) || rawTags.some((tag) => typeof tag !== "string")) {
    throw new Error("Tags must be a YAML string sequence");
  }
  const tags = rawTags as string[];
  if (new Set(tags).size !== tags.length) throw new Error("Tags must not contain duplicates");
  if (tags.some((tag) => !tag)) throw new Error("Tags must be non-empty strings");
  const dates: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    if (
      /(date|at|until|due)$/i.test(key) &&
      typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(value)
    )
      dates[key] = value;
  }
  return {
    id,
    name,
    type,
    tags,
    ...(scalar("status") ? { status: scalar("status") } : {}),
    dates,
  };
}

async function discoverMarkdown(root: string): Promise<string[]> {
  const files: string[] = [];
  async function walk(directory: string, relativeDirectory: string): Promise<void> {
    let entries: Dirent[];
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const path = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (!ignoredDirectoryNames.has(entry.name))
          await walk(resolve(directory, entry.name), path);
      } else if (
        entry.isFile() &&
        /\.md$/i.test(entry.name) &&
        !ignoredDirectoryNames.has(path.split("/").at(-2) ?? "")
      ) {
        files.push(path);
      }
    }
  }
  await walk(root, "");
  return files.sort();
}

export async function buildWorkspaceIndex(context: WorkspaceContext): Promise<WorkspaceIndex> {
  return scanWorkspaceIndex(context, undefined);
}

async function scanWorkspaceIndex(
  context: WorkspaceContext,
  previous: WorkspaceIndex | undefined,
): Promise<WorkspaceIndex> {
  const root = await realpath(resolve(context.root));
  if (!(await lstat(root)).isDirectory()) throw new Error("Workspace root must be a directory");
  const documents = new Map<string, DocumentSummary>();
  const diagnostics: ValidationDiagnostic[] = [];
  const fingerprints = new Map<string, string>();
  const previousDiagnostics = new Map(
    previous?.diagnostics.map((diagnostic) => [diagnostic.path, diagnostic]),
  );
  for (const path of await discoverMarkdown(root)) {
    const absolutePath = await resolveSafeWorkspacePath(root, path);
    const stat = await Bun.file(absolutePath).stat();
    const fingerprint = `${stat.dev}:${stat.ino}:${stat.size}:${stat.mtimeMs}:${stat.ctimeMs}`;
    fingerprints.set(path, fingerprint);
    if (previous?.fingerprints.get(path) === fingerprint) {
      const unchanged = previous.documents.get(path);
      if (unchanged) documents.set(path, unchanged);
      const oldDiagnostic = previousDiagnostics.get(path);
      if (oldDiagnostic) diagnostics.push(oldDiagnostic);
      continue;
    }
    const content = await Bun.file(absolutePath).text();
    const contentHash = hashContent(content);
    try {
      documents.set(path, {
        path,
        metadata: parseMetadata(content),
        size: stat.size,
        modifiedAt: stat.mtimeMs,
        contentHash,
        changeTime: stat.ctimeMs,
        fileId: `${stat.dev}:${stat.ino}`,
      });
    } catch (error) {
      diagnostics.push({
        path,
        message: error instanceof Error ? error.message : "Invalid metadata",
      });
    }
  }
  return { root, documents, diagnostics, scannedAt: Date.now(), fingerprints };
}

export async function reconcileWorkspaceIndex(index: WorkspaceIndex): Promise<WorkspaceIndex> {
  return scanWorkspaceIndex({ root: index.root }, index);
}

export async function readWorkspaceDocument(
  context: WorkspaceContext,
  path: string,
): Promise<string> {
  if (!/\.md$/i.test(path)) throw new Error("Only Markdown documents can be read");
  const safePath = await resolveSafeWorkspacePath(context.root, path);
  const stat = await lstat(safePath);
  if (!stat.isFile()) throw new Error("Workspace document is not a regular file");
  return Bun.file(safePath).text();
}

export function watchWorkspaceIndex(
  context: WorkspaceContext,
  initialIndex: WorkspaceIndex,
  listener: IndexChangeListener,
  options: WatchOptions = {},
): WorkspaceWatcher {
  const root = resolve(context.root);
  let current = initialIndex;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let queued = new Set<string>();
  let forceReset = false;
  let running = false;
  let closed = false;
  const debounceMs = Math.max(0, options.debounceMs ?? 80);
  let watcher: FSWatcher;
  const onFilesystemChange = (_event: string, filename: string | Buffer | null): void => {
    if (!filename) forceReset = true;
    else queued.add(String(filename).replaceAll("\\", "/"));
    schedule();
  };
  watcher = watch(root, { recursive: true }, onFilesystemChange);
  watcher.on("error", () => {
    forceReset = true;
    schedule();
  });
  function schedule(): void {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      void reconcile().catch((error: unknown) => {
        if (!closed) options.onError?.(error instanceof Error ? error : new Error(String(error)));
      });
    }, debounceMs);
  }
  async function reconcile(): Promise<WorkspaceIndex> {
    if (running) {
      forceReset = true;
      return current;
    }
    running = true;
    const uncertain = forceReset || queued.size === 0;
    queued = new Set();
    forceReset = false;
    try {
      const next = await reconcileWorkspaceIndex(current);
      const changed: IndexChange[] = [];
      for (const [path, previous] of current.documents) {
        if (!next.documents.has(path)) changed.push({ type: "removed", path });
        else if (next.documents.get(path)?.contentHash !== previous.contentHash) {
          changed.push({ type: "updated", document: next.documents.get(path) as DocumentSummary });
        }
      }
      for (const [path, document] of next.documents) {
        if (!current.documents.has(path)) changed.push({ type: "added", document });
      }
      const oldDiagnostics = new Map(
        current.diagnostics.map((diagnostic) => [diagnostic.path, diagnostic]),
      );
      const nextDiagnostics = new Map(
        next.diagnostics.map((diagnostic) => [diagnostic.path, diagnostic]),
      );
      for (const [path, diagnostic] of nextDiagnostics) {
        if (oldDiagnostics.get(path)?.message !== diagnostic.message) {
          changed.push({ type: "invalid", diagnostic });
        }
      }
      for (const path of oldDiagnostics.keys()) {
        if (!nextDiagnostics.has(path)) changed.push({ type: "repaired", path });
      }
      current = next;
      if (closed) return current;
      if (uncertain) listener({ type: "reset", index: current });
      else for (const change of changed) listener(change);
      return current;
    } finally {
      running = false;
      if (!closed && (forceReset || queued.size > 0)) schedule();
    }
  }
  const interval =
    options.reconcileEveryMs && options.reconcileEveryMs > 0
      ? setInterval(() => {
          forceReset = true;
          schedule();
        }, options.reconcileEveryMs)
      : undefined;
  return {
    getSnapshot: () => current,
    reconcile,
    close() {
      closed = true;
      watcher.close();
      if (timer) clearTimeout(timer);
      if (interval) clearInterval(interval);
    },
  };
}
