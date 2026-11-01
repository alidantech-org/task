import { constants } from "node:fs";
import { mkdir, open, unlink } from "node:fs/promises";
import { basename, dirname, extname } from "node:path";
import { WorkspaceError } from "@task/workspace/errors";
import { isDeniedPath } from "@task/workspace/git/deny";
import { buildWorkspaceIndex } from "@task/workspace/indexing/incremental";
import { maxAttachmentBytes } from "@task/workspace/indexing/metadata";
import type { Attachment, DocumentSummary, WorkspaceContext } from "@task/workspace/indexing/types";
import { findDocument } from "@task/workspace/operations/query";
import { updateTaskValues } from "@task/workspace/operations/task-values";
import { resolveSafeWorkspacePath } from "@task/workspace/paths/safe-path";

export { maxAttachmentBytes };

/** A file name that is safe to store: no directories, no leading dots, limited characters and length. */
export function sanitizeFileName(name: string): string {
  const base = basename(name.replace(/\\/g, "/"))
    .replace(/[^A-Za-z0-9._ -]/g, "_")
    .trim();
  const clean = base.replace(/^\.+/, "").slice(-100);
  return clean;
}

async function taskOf(context: WorkspaceContext, identifier: string): Promise<DocumentSummary> {
  const task = findDocument(await buildWorkspaceIndex(context), identifier);
  if (task.metadata.type !== "task")
    throw new WorkspaceError("invalid_input", `${identifier} is not a task`);
  return task;
}

async function writeNew(path: string, data: Uint8Array): Promise<boolean> {
  try {
    const handle = await open(
      path,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      0o600,
    );
    try {
      await handle.writeFile(data);
      await handle.sync();
    } finally {
      await handle.close();
    }
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") return false;
    throw error;
  }
}

/** Stores a small file under the workspace's attachments folder and records it on the task. */
export async function addFileAttachment(
  context: WorkspaceContext,
  identifier: string,
  file: { name: string; data: Uint8Array },
  addedBy?: string,
): Promise<DocumentSummary> {
  const task = await taskOf(context, identifier);
  if (file.data.byteLength > maxAttachmentBytes)
    throw new WorkspaceError(
      "invalid_input",
      `Attachments are limited to ${maxAttachmentBytes / 1_000_000} MB. Attach a link to larger files instead.`,
    );
  const clean = sanitizeFileName(file.name);
  if (!clean) throw new WorkspaceError("invalid_input", "The attachment needs a file name");
  if (isDeniedPath(clean))
    throw new WorkspaceError(
      "path_not_safe",
      `${clean} looks like a protected file and cannot be attached`,
    );
  const directory = `attachments/${task.metadata.id}`;
  const ext = extname(clean);
  const stem = clean.slice(0, clean.length - ext.length);
  let stored = "";
  for (let attempt = 1; attempt <= 50; attempt += 1) {
    const candidate = attempt === 1 ? clean : `${stem}-${attempt}${ext}`;
    const path = `${directory}/${candidate}`;
    const absolute = await resolveSafeWorkspacePath(context.root, path);
    await mkdir(dirname(absolute), { recursive: true, mode: 0o700 });
    await resolveSafeWorkspacePath(context.root, path);
    if (await writeNew(absolute, file.data)) {
      stored = candidate;
      break;
    }
  }
  if (!stored) throw new WorkspaceError("already_exists", "Too many attachments share that name");
  const path = `${directory}/${stored}`;
  try {
    return await updateTaskValues(context, identifier, (values) => {
      const attachments = Array.isArray(values.attachments) ? [...values.attachments] : [];
      attachments.push({
        kind: "file",
        name: stored,
        path,
        size: file.data.byteLength,
        added_at: new Date().toISOString(),
        ...(addedBy ? { added_by: addedBy } : {}),
      });
      values.attachments = attachments;
    });
  } catch (error) {
    await unlink(await resolveSafeWorkspacePath(context.root, path)).catch(() => undefined);
    throw error;
  }
}

export async function addLinkAttachment(
  context: WorkspaceContext,
  identifier: string,
  link: { url: string; name?: string },
  addedBy?: string,
): Promise<DocumentSummary> {
  await taskOf(context, identifier);
  if (!/^https?:\/\/\S+$/i.test(link.url))
    throw new WorkspaceError("invalid_input", "A link attachment must be an http or https address");
  const name = (link.name?.trim() || link.url).slice(0, 120);
  return updateTaskValues(context, identifier, (values) => {
    const attachments = Array.isArray(values.attachments) ? [...values.attachments] : [];
    attachments.push({
      kind: "link",
      name,
      url: link.url,
      added_at: new Date().toISOString(),
      ...(addedBy ? { added_by: addedBy } : {}),
    });
    values.attachments = attachments;
  });
}

function findAttachment(task: DocumentSummary, name: string): Attachment {
  const found = task.metadata.attachments?.find((attachment) => attachment.name === name);
  if (!found) throw new WorkspaceError("not_found", `No attachment named ${name}`);
  return found;
}

export async function removeAttachment(
  context: WorkspaceContext,
  identifier: string,
  name: string,
): Promise<DocumentSummary> {
  const task = await taskOf(context, identifier);
  const attachment = findAttachment(task, name);
  const updated = await updateTaskValues(context, identifier, (values) => {
    const rest = (Array.isArray(values.attachments) ? values.attachments : []).filter(
      (item) => (item as Attachment).name !== name,
    );
    if (rest.length === 0) delete values.attachments;
    else values.attachments = rest;
  });
  if (attachment.kind === "file" && attachment.path)
    await unlink(await resolveSafeWorkspacePath(context.root, attachment.path)).catch(
      () => undefined,
    );
  return updated;
}

/** The bytes of a stored attachment, found only through the task's own record. */
export async function readAttachment(
  context: WorkspaceContext,
  identifier: string,
  name: string,
): Promise<{ name: string; data: Uint8Array }> {
  const task = await taskOf(context, identifier);
  const attachment = findAttachment(task, name);
  if (attachment.kind !== "file" || !attachment.path)
    throw new WorkspaceError("invalid_input", `${name} is a link, not a stored file`);
  const absolute = await resolveSafeWorkspacePath(context.root, attachment.path);
  try {
    const handle = await open(absolute, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      return { name: attachment.name, data: new Uint8Array(await handle.readFile()) };
    } finally {
      await handle.close();
    }
  } catch (error) {
    throw new WorkspaceError("not_found", `The file for ${name} is missing`, { cause: error });
  }
}
