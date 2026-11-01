import { mkdir, rename } from "node:fs/promises";
import { basename, dirname } from "node:path";
import { WorkspaceError } from "@task/workspace/errors";
import { buildWorkspaceIndex } from "@task/workspace/indexing/incremental";
import type { DocumentSummary, WorkspaceContext } from "@task/workspace/indexing/types";
import { updateTask } from "@task/workspace/operations/mutate";
import { nextOrder } from "@task/workspace/operations/order";
import { findDocument, findGroup } from "@task/workspace/operations/query";
import { resolveSafeWorkspacePath } from "@task/workspace/paths/safe-path";

/** Moves a task file to another active group, keeping its id and placing it last. */
export async function moveTask(
  context: WorkspaceContext,
  identifier: string,
  groupIdentifier: string,
  expectedHash?: string,
): Promise<DocumentSummary> {
  const index = await buildWorkspaceIndex(context);
  const task = findDocument(index, identifier);
  if (task.metadata.type !== "task")
    throw new WorkspaceError("invalid_input", `${identifier} is not a task`);
  if (expectedHash !== undefined && task.contentHash !== expectedHash)
    throw new WorkspaceError("conflict", `Task changed since it was loaded: ${task.path}`);
  const group = await findGroup(context, groupIdentifier);
  if (group.archived || group.finished)
    throw new WorkspaceError("invalid_input", "Tasks can only be moved into an active group");
  if (dirname(task.path) === group.path) return task;
  const inGroup = [...index.documents.values()].filter(
    (document) => document.metadata.type === "task" && dirname(document.path) === group.path,
  );
  const numbers = inGroup.map((document) =>
    Number(/^(\d+)-/.exec(basename(document.path))?.[1] ?? 0),
  );
  const sequence = Math.max(0, ...numbers) + 1;
  const slug = basename(task.path).replace(/^\d+-/, "");
  const destination = `${group.path}/${String(sequence).padStart(3, "0")}-${slug}`;
  const sourcePath = await resolveSafeWorkspacePath(context.root, task.path);
  const destinationPath = await resolveSafeWorkspacePath(context.root, destination);
  if (await Bun.file(destinationPath).exists())
    throw new WorkspaceError("already_exists", `Destination already exists: ${destination}`);
  await mkdir(dirname(destinationPath), { recursive: true });
  await resolveSafeWorkspacePath(context.root, destination);
  await rename(sourcePath, destinationPath);
  return (await updateTask(context, task.metadata.id, { order: nextOrder(inGroup) })).task;
}
