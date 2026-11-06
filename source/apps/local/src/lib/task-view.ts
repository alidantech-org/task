export type TaskViewSort = "recent" | "name" | "group" | "status" | "priority" | "due";
export type TaskViewDirection = "ascending" | "descending";

export type TaskViewSortable = {
  name: string;
  groupName?: string;
  status?: string;
  priority?: string;
  due_at?: string;
  updated_at?: string;
  extra?: { status_history?: readonly { to: string; at: string }[] };
  modifiedAt: number;
};

const statusRank: Record<string, number> = {
  planned: 0,
  "in-progress": 1,
  blocked: 2,
  completed: 3,
  archived: 4,
};
const priorityRank: Record<string, number> = { high: 0, medium: 1, low: 2 };

function updatedTimestamp(task: TaskViewSortable): number {
  if (task.status === "completed") {
    const completion = [...(task.extra?.status_history ?? [])]
      .reverse()
      .find((change) => change.to === "completed");
    const completedAt = completion ? Date.parse(completion.at) : Number.NaN;
    if (Number.isFinite(completedAt)) return completedAt;
  }
  const updated = task.updated_at ? Date.parse(task.updated_at) : Number.NaN;
  return Number.isFinite(updated) ? updated : task.modifiedAt;
}

function compareText(left: string | undefined, right: string | undefined): number {
  return (left ?? "").localeCompare(right ?? "", undefined, { sensitivity: "base" });
}

/** Returns a sorted copy, keeping the source workspace order untouched. */
export function sortTaskView<T extends TaskViewSortable>(
  tasks: readonly T[],
  sort: TaskViewSort,
  direction: TaskViewDirection,
): T[] {
  const multiplier = direction === "ascending" ? 1 : -1;
  return [...tasks].sort((left, right) => {
    if (sort === "due") {
      if (!left.due_at && right.due_at) return 1;
      if (left.due_at && !right.due_at) return -1;
      return (left.due_at ?? "").localeCompare(right.due_at ?? "") * multiplier;
    }
    if (sort === "name") return compareText(left.name, right.name) * multiplier;
    if (sort === "group") return compareText(left.groupName, right.groupName) * multiplier;
    if (sort === "status")
      return (
        ((statusRank[left.status ?? ""] ?? Number.MAX_SAFE_INTEGER) -
          (statusRank[right.status ?? ""] ?? Number.MAX_SAFE_INTEGER)) *
        multiplier
      );
    if (sort === "priority")
      return (
        ((priorityRank[left.priority ?? ""] ?? Number.MAX_SAFE_INTEGER) -
          (priorityRank[right.priority ?? ""] ?? Number.MAX_SAFE_INTEGER)) *
        multiplier
      );
    return (updatedTimestamp(left) - updatedTimestamp(right)) * multiplier;
  });
}
