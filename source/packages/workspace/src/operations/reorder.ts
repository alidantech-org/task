import { dirname } from "node:path";
import { WorkspaceError } from "@task/workspace/errors";
import { buildWorkspaceIndex } from "@task/workspace/indexing/incremental";
import type { DocumentSummary, WorkspaceContext } from "@task/workspace/indexing/types";
import { updateTask } from "@task/workspace/operations/mutate";
import {
  effectiveOrder,
  orderStep,
  rankBetween,
  sortTasks,
} from "@task/workspace/operations/order";
import { findDocument } from "@task/workspace/operations/query";

export type ReorderTarget = {
  /** Place the task immediately before this task. */
  before?: string;
  /** Place the task immediately after this task. */
  after?: string;
  /** Set an explicit rank instead. */
  order?: number;
};

/** Moves a task within its group by giving it a rank between its new neighbours. */
export async function reorderTask(
  context: WorkspaceContext,
  identifier: string,
  target: ReorderTarget,
  expectedHash?: string,
): Promise<DocumentSummary> {
  const given = [target.before, target.after, target.order].filter((value) => value !== undefined);
  if (given.length !== 1)
    throw new WorkspaceError("invalid_input", "Give exactly one of before, after or order");
  const index = await buildWorkspaceIndex(context);
  const task = findDocument(index, identifier);
  if (task.metadata.type !== "task")
    throw new WorkspaceError("invalid_input", `${identifier} is not a task`);
  if (target.order !== undefined)
    return (await updateTask(context, identifier, { order: target.order }, expectedHash)).task;
  const siblings = sortTasks(
    [...index.documents.values()].filter(
      (document) =>
        document.metadata.type === "task" &&
        dirname(document.path) === dirname(task.path) &&
        document.metadata.id !== task.metadata.id,
    ),
  );
  const anchorId = target.before ?? target.after ?? "";
  const position = siblings.findIndex((sibling) => sibling.metadata.id === anchorId);
  if (position < 0)
    throw new WorkspaceError("not_found", `${anchorId} is not another task in the same group`);
  const insertAt = target.before !== undefined ? position : position + 1;
  const previous = siblings[insertAt - 1];
  const following = siblings[insertAt];
  const rank = rankBetween(
    previous ? effectiveOrder(previous) : undefined,
    following ? effectiveOrder(following) : undefined,
  );
  if (rank !== undefined)
    return (await updateTask(context, identifier, { order: rank }, expectedHash)).task;
  // No room between the neighbours: renumber the whole group in even steps.
  const ordered = [...siblings.slice(0, insertAt), task, ...siblings.slice(insertAt)];
  let moved = task;
  for (const [position2, item] of ordered.entries()) {
    const wanted = (position2 + 1) * orderStep;
    if (effectiveOrder(item) === wanted && item.metadata.order !== undefined) continue;
    const result = await updateTask(
      context,
      item.metadata.id,
      { order: wanted },
      item.metadata.id === task.metadata.id ? expectedHash : undefined,
    );
    if (item.metadata.id === task.metadata.id) moved = result.task;
  }
  return moved;
}
