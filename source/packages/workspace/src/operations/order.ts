import type { DocumentSummary } from "@task/workspace/indexing/types";

/** Spacing between consecutive ranks; new tasks go this far after the last one. */
export const orderStep = 1024;
const minimumGap = 1e-6;

function filePrefix(path: string): number | undefined {
  const match = /(?:^|\/)(\d+)-[^/]*\.md$/i.exec(path);
  return match?.[1] ? Number(match[1]) : undefined;
}

/**
 * A task's rank within its group: its `order`, or for older tasks the numeric file prefix scaled to
 * the same range, so mixed groups keep the creation order they always had.
 */
export function effectiveOrder(task: Pick<DocumentSummary, "path" | "metadata">): number {
  if (task.metadata.order !== undefined) return task.metadata.order;
  const prefix = filePrefix(task.path);
  return (prefix ?? 0) * orderStep;
}

export function compareTasks(
  left: Pick<DocumentSummary, "path" | "metadata">,
  right: Pick<DocumentSummary, "path" | "metadata">,
): number {
  return (
    effectiveOrder(left) - effectiveOrder(right) ||
    (left.metadata.created_at ?? "").localeCompare(right.metadata.created_at ?? "") ||
    left.path.localeCompare(right.path)
  );
}

export function sortTasks<T extends Pick<DocumentSummary, "path" | "metadata">>(
  tasks: readonly T[],
): T[] {
  return [...tasks].sort(compareTasks);
}

/** The rank for a task that comes after the last one in a group. */
export function nextOrder(tasks: readonly Pick<DocumentSummary, "path" | "metadata">[]): number {
  return tasks.length === 0 ? orderStep : Math.max(...tasks.map(effectiveOrder)) + orderStep;
}

/** A rank between two neighbours, or undefined when there is no room and the group needs renumbering. */
export function rankBetween(
  before: number | undefined,
  after: number | undefined,
): number | undefined {
  if (before === undefined && after === undefined) return orderStep;
  if (before === undefined) return (after as number) - orderStep;
  if (after === undefined) return before + orderStep;
  if (after - before < minimumGap) return undefined;
  return (before + after) / 2;
}
