import type { DocumentSummary, TaskGroup, TaskStatus } from "@task/workspace";

export const taskLanes: readonly TaskStatus[] = ["planned", "in-progress", "blocked", "completed"];

export function filterByQuery<T extends DocumentSummary>(items: readonly T[], query: string): T[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return [...items];
  return items.filter((item) => {
    const values = [
      item.metadata.id,
      item.metadata.name,
      item.metadata.type,
      item.metadata.status,
      item.metadata.priority,
      item.metadata.assignee,
      item.metadata.project,
      item.path,
      ...item.metadata.tags,
    ];
    return values.some((value) => value?.toLocaleLowerCase().includes(normalized));
  });
}

export function filterGroups(groups: readonly TaskGroup[], query: string): TaskGroup[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return [...groups];
  return groups.filter((group) =>
    [group.id, group.name, group.path].some((value) =>
      value.toLocaleLowerCase().includes(normalized),
    ),
  );
}

export function getTaskGroup(
  task: DocumentSummary,
  groups: readonly TaskGroup[],
): TaskGroup | undefined {
  return groups.find((group) => task.path.startsWith(`${group.path}/`));
}

export function getLaneTasks(
  tasks: readonly DocumentSummary[],
  status: TaskStatus,
): DocumentSummary[] {
  return tasks.filter((task) => task.metadata.status === status);
}

export function sliceAroundSelection<T>(
  items: readonly T[],
  selectedIndex: number,
  size: number,
): T[] {
  if (size <= 0) return [];
  const start = Math.max(0, Math.min(selectedIndex - Math.floor(size / 2), items.length - size));
  return items.slice(start, start + size);
}
