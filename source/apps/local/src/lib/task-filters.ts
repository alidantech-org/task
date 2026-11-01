export type TaskFilters = {
  text: string;
  /** An assignee name, "me", or empty for everyone. */
  assignee: string;
  tag: string;
  priority: string;
  watching: boolean;
  due: "" | "overdue" | "week" | "none";
};

export const emptyFilters: TaskFilters = {
  text: "",
  assignee: "",
  tag: "",
  priority: "",
  watching: false,
  due: "",
};

type Filterable = {
  name: string;
  tags: readonly string[];
  priority?: string;
  assignee?: string;
  due_at?: string;
  status?: string;
  watchers?: readonly string[];
  groupName?: string;
};

export function isFiltering(filters: TaskFilters): boolean {
  return (Object.keys(emptyFilters) as (keyof TaskFilters)[]).some(
    (key) => filters[key] !== emptyFilters[key],
  );
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Keeps the tasks that match every active filter; `me` is the current author for "me" and watching. */
export function applyFilters<T extends Filterable>(
  tasks: readonly T[],
  filters: TaskFilters,
  me: string,
  now = new Date(),
): T[] {
  const text = filters.text.trim().toLowerCase();
  const today = dayKey(now);
  const week = new Date(now);
  week.setDate(week.getDate() + 7);
  const weekKey = dayKey(week);
  const lowerMe = me.toLowerCase();
  const wantedAssignee = (filters.assignee === "me" ? me : filters.assignee).toLowerCase();
  return tasks.filter((task) => {
    if (
      text &&
      !`${task.name} ${task.groupName ?? ""} ${task.tags.join(" ")} ${task.assignee ?? ""}`
        .toLowerCase()
        .includes(text)
    )
      return false;
    if (wantedAssignee && (task.assignee ?? "").toLowerCase() !== wantedAssignee) return false;
    if (filters.tag && !task.tags.includes(filters.tag)) return false;
    if (filters.priority && task.priority !== filters.priority) return false;
    if (filters.watching && !(task.watchers ?? []).some((name) => name.toLowerCase() === lowerMe))
      return false;
    if (filters.due) {
      const done = task.status === "completed" || task.status === "archived";
      if (filters.due === "none" && task.due_at) return false;
      if (filters.due === "overdue" && !(task.due_at && task.due_at < today && !done)) return false;
      if (
        filters.due === "week" &&
        !(task.due_at && task.due_at >= today && task.due_at <= weekKey)
      )
        return false;
    }
    return true;
  });
}

export type SavedView = { id: string; name: string; filters: TaskFilters };

export function isFilters(value: unknown): value is TaskFilters {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.text === "string" &&
    typeof record.assignee === "string" &&
    typeof record.tag === "string" &&
    typeof record.priority === "string" &&
    typeof record.watching === "boolean" &&
    ["", "overdue", "week", "none"].includes(String(record.due))
  );
}

export function isSavedViews(value: unknown): value is SavedView[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as SavedView).id === "string" &&
        typeof (item as SavedView).name === "string" &&
        isFilters((item as SavedView).filters),
    )
  );
}

/** Adds or replaces a saved view by name, keeping at most 30. */
export function upsertView(
  views: readonly SavedView[],
  name: string,
  filters: TaskFilters,
): SavedView[] {
  const clean = name.trim().slice(0, 40);
  if (!clean) return [...views];
  const existing = views.find((view) => view.name.toLowerCase() === clean.toLowerCase());
  const next: SavedView = {
    id: existing?.id ?? `view-${Date.now().toString(36)}`,
    name: clean,
    filters,
  };
  return [...views.filter((view) => view.id !== next.id), next].slice(-30);
}
