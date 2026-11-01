import { createHash } from "node:crypto";
import {
  cp,
  lstat,
  mkdir,
  readdir,
  readFile,
  realpath,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, sep } from "node:path";
import { WorkspaceError } from "@task/workspace/errors";
import { buildWorkspaceIndex } from "@task/workspace/indexing/incremental";
import type { DocumentSummary, WorkspaceContext } from "@task/workspace/indexing/types";
import { findDocument, findGroup, listTaskGroups } from "@task/workspace/operations/query";
import { resolveSafeWorkspacePath } from "@task/workspace/paths/safe-path";

export type TrashKind = "task" | "task-group" | "document";

export type TrashEntry = {
  trashId: string;
  kind: TrashKind;
  id: string;
  name: string;
  originalPath: string;
  deletedAt: string;
  payloadType: "file" | "directory";
  signature: string;
  trashPath: string;
};

export type DeleteOptions = {
  /** Delete even when other tasks depend on the item. */
  force?: boolean;
  /** Required to delete a task group that still contains tasks. */
  cascade?: boolean;
};

type Manifest = Omit<TrashEntry, "trashPath">;

const manifestName = "manifest.json";
const payloadName = "payload";
const trashIdPattern = /^\d{8}T\d{6}Z-[A-Z]+-[A-Z0-9]+$/;
const structuralTypes = new Set(["workspace-guide"]);

function errorCode(error: unknown): string | undefined {
  return error instanceof Error && "code" in error ? String(error.code) : undefined;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Trash lives outside the project so deleting never touches the repository. */
export async function trashDirectory(context: WorkspaceContext): Promise<string> {
  const projectRoot = await realpath(context.projectRoot ?? context.root);
  const base = process.env.TASK_TRASH_DIR || join(tmpdir(), "taskcode-trash");
  return join(base, sha256(projectRoot).slice(0, 16));
}

async function signature(path: string): Promise<string> {
  const info = await lstat(path);
  if (info.isSymbolicLink()) return "symlink";
  if (info.isFile()) return sha256(await readFile(path, "utf8").catch(() => String(info.size)));
  const lines: string[] = [];
  const walk = async (directory: string): Promise<void> => {
    for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const full = join(directory, entry.name);
      const rel = relative(path, full).split(sep).join("/");
      if (entry.isDirectory()) {
        lines.push(`d:${rel}`);
        await walk(full);
      } else lines.push(`${entry.isSymbolicLink() ? "l" : "f"}:${rel}:${(await lstat(full)).size}`);
    }
  };
  await walk(path);
  return sha256(lines.join("\n"));
}

/** Rename, falling back to copy + verify + remove when crossing devices. */
async function moveEntry(source: string, destination: string): Promise<void> {
  await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
  try {
    await rename(source, destination);
    return;
  } catch (error) {
    if (errorCode(error) !== "EXDEV") throw error;
  }
  const before = await signature(source);
  await cp(source, destination, { recursive: true, errorOnExist: true, force: false });
  if ((await signature(destination)) !== before) {
    await rm(destination, { recursive: true, force: true });
    throw new WorkspaceError("filesystem_error", "Copy verification failed; nothing was removed");
  }
  await rm(source, { recursive: true });
}

async function moveToTrash(
  context: WorkspaceContext,
  kind: TrashKind,
  item: { id: string; name: string; path: string },
): Promise<TrashEntry> {
  const absolute = await resolveSafeWorkspacePath(context.root, item.path);
  const info = await lstat(absolute);
  if (info.isSymbolicLink())
    throw new WorkspaceError("path_not_safe", `Refusing to delete a symbolic link: ${item.path}`);
  const payloadType = info.isDirectory() ? "directory" : "file";
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const trashId = `${stamp}-${item.id}`;
  if (!trashIdPattern.test(trashId))
    throw new WorkspaceError("invalid_input", `Cannot trash item with id ${item.id}`);
  const entryDirectory = join(await trashDirectory(context), trashId);
  const manifest: Manifest = {
    trashId,
    kind,
    id: item.id,
    name: item.name,
    originalPath: item.path,
    deletedAt: new Date().toISOString(),
    payloadType,
    signature: await signature(absolute),
  };
  await mkdir(entryDirectory, { recursive: true, mode: 0o700 });
  try {
    await moveEntry(absolute, join(entryDirectory, payloadName));
    await writeFile(join(entryDirectory, manifestName), `${JSON.stringify(manifest, null, 2)}\n`, {
      mode: 0o600,
    });
  } catch (error) {
    await rm(entryDirectory, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
  return { ...manifest, trashPath: entryDirectory };
}

function dependents(
  documents: Iterable<DocumentSummary>,
  ids: ReadonlySet<string>,
  ignorePathPrefix?: string,
): string[] {
  const found: string[] = [];
  for (const document of documents) {
    if (document.metadata.type !== "task" || ids.has(document.metadata.id)) continue;
    if (ignorePathPrefix && document.path.startsWith(`${ignorePathPrefix}/`)) continue;
    if (document.metadata.depends_on?.some((dependency) => ids.has(dependency)))
      found.push(document.metadata.id);
  }
  return found;
}

function assertNoDependents(found: string[], options: DeleteOptions, subject: string): void {
  if (found.length > 0 && !options.force)
    throw new WorkspaceError(
      "conflict",
      `${subject} is a dependency of ${found.join(", ")}; use force to delete it anyway`,
    );
}

export async function deleteTask(
  context: WorkspaceContext,
  identifier: string,
  options: DeleteOptions = {},
): Promise<TrashEntry> {
  const index = await buildWorkspaceIndex(context);
  const task = findDocument(index, identifier);
  if (task.metadata.type !== "task")
    throw new WorkspaceError("invalid_input", `${identifier} is not a task`);
  assertNoDependents(
    dependents(index.documents.values(), new Set([task.metadata.id])),
    options,
    task.metadata.id,
  );
  return moveToTrash(context, "task", {
    id: task.metadata.id,
    name: task.metadata.name,
    path: task.path,
  });
}

export async function deleteDocument(
  context: WorkspaceContext,
  identifier: string,
): Promise<TrashEntry> {
  const document = findDocument(await buildWorkspaceIndex(context), identifier);
  if (document.metadata.type === "task")
    throw new WorkspaceError("invalid_input", `${identifier} is a task; delete it as a task`);
  if ((await listTaskGroups(context)).some((group) => group.id === document.metadata.id))
    throw new WorkspaceError(
      "invalid_input",
      `${identifier} is a task group; delete it as a group, not as a document`,
    );
  if (document.path === "README.md" || structuralTypes.has(document.metadata.type))
    throw new WorkspaceError(
      "invalid_input",
      `${document.path} is structural and cannot be deleted`,
    );
  return moveToTrash(context, "document", {
    id: document.metadata.id,
    name: document.metadata.name,
    path: document.path,
  });
}

export async function deleteTaskGroup(
  context: WorkspaceContext,
  identifier: string,
  options: DeleteOptions = {},
): Promise<TrashEntry> {
  const group = await findGroup(context, identifier);
  if (group.total + group.archivedTasks > 0 && !options.cascade)
    throw new WorkspaceError(
      "conflict",
      `Group ${group.id} still contains tasks; use cascade to delete it with its tasks`,
    );
  const index = await buildWorkspaceIndex(context);
  const inside = new Set(
    [...index.documents.values()]
      .filter((document) => document.path.startsWith(`${group.path}/`))
      .filter((document) => document.metadata.type === "task")
      .map((document) => document.metadata.id),
  );
  assertNoDependents(dependents(index.documents.values(), inside, group.path), options, group.id);
  return moveToTrash(context, "task-group", { id: group.id, name: group.name, path: group.path });
}

async function readManifest(entryDirectory: string): Promise<Manifest | undefined> {
  try {
    const parsed: unknown = JSON.parse(await readFile(join(entryDirectory, manifestName), "utf8"));
    if (typeof parsed !== "object" || parsed === null) return undefined;
    const value = parsed as Record<string, unknown>;
    if (
      typeof value.trashId !== "string" ||
      !trashIdPattern.test(value.trashId) ||
      !["task", "task-group", "document"].includes(String(value.kind)) ||
      typeof value.id !== "string" ||
      typeof value.name !== "string" ||
      typeof value.originalPath !== "string" ||
      typeof value.deletedAt !== "string" ||
      !["file", "directory"].includes(String(value.payloadType)) ||
      typeof value.signature !== "string"
    )
      return undefined;
    return value as unknown as Manifest;
  } catch {
    return undefined;
  }
}

export async function listTrash(context: WorkspaceContext): Promise<TrashEntry[]> {
  const directory = await trashDirectory(context);
  let names: string[];
  try {
    names = await readdir(directory);
  } catch (error) {
    if (errorCode(error) === "ENOENT") return [];
    throw error;
  }
  const entries: TrashEntry[] = [];
  for (const name of names) {
    const manifest = await readManifest(join(directory, name));
    if (manifest && manifest.trashId === name)
      entries.push({ ...manifest, trashPath: join(directory, name) });
  }
  return entries.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
}

export async function restoreFromTrash(
  context: WorkspaceContext,
  trashId: string,
): Promise<TrashEntry> {
  if (!trashIdPattern.test(trashId))
    throw new WorkspaceError("invalid_input", `Invalid trash id: ${trashId}`);
  const entryDirectory = join(await trashDirectory(context), trashId);
  const manifest = await readManifest(entryDirectory);
  if (!manifest || manifest.trashId !== trashId)
    throw new WorkspaceError("not_found", `No trash entry found for ${trashId}`);
  const payload = join(entryDirectory, payloadName);
  if ((await signature(payload).catch(() => undefined)) !== manifest.signature)
    throw new WorkspaceError("conflict", "Trashed content changed or is missing; not restoring");
  const destination = await resolveSafeWorkspacePath(context.root, manifest.originalPath);
  try {
    await lstat(destination);
    throw new WorkspaceError(
      "already_exists",
      `Original path is occupied: ${manifest.originalPath}`,
    );
  } catch (error) {
    if (error instanceof WorkspaceError) throw error;
    if (errorCode(error) !== "ENOENT") throw error;
  }
  await mkdir(dirname(destination), { recursive: true });
  await resolveSafeWorkspacePath(context.root, manifest.originalPath);
  await moveEntry(payload, destination);
  await rm(entryDirectory, { recursive: true, force: true });
  return { ...manifest, trashPath: entryDirectory };
}
