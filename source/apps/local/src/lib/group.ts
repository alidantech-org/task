type GroupLike = { id: string; name: string; path: string };
type TaskLike = { path: string; project?: string; extra?: { group_id?: string } };

/**
 * The group a task belongs to. Finished and archived groups must be included in `groups`, otherwise
 * completed work loses its group name. Matches the recorded group id first, then the folder path.
 */
export function groupForTask<T extends GroupLike>(
  task: TaskLike,
  groups: readonly T[],
): T | undefined {
  const byId = task.extra?.group_id;
  if (byId) {
    const match = groups.find((group) => group.id === byId);
    if (match) return match;
  }
  return groups.find((group) => task.path === group.path || task.path.startsWith(`${group.path}/`));
}

export function groupLabel(task: TaskLike, groups: readonly GroupLike[]): string {
  return groupForTask(task, groups)?.name ?? task.project ?? "Ungrouped";
}
