import { dateKey, weekGrid } from "@/lib/calendar";

export type StatusChange = { from: string; to: string; at: string };
export type HistoricalTask = {
  extra?: { status_history?: readonly StatusChange[]; hidden_from_recent?: boolean };
};
export type CompletedTaskRecord = HistoricalTask & {
  status?: string;
  archived_at?: string;
  updated_at?: string;
  path: string;
  modifiedAt: number;
};

export function isArchivedTask(
  task: Pick<CompletedTaskRecord, "archived_at" | "path"> & { status?: string },
): boolean {
  return (
    task.status === "archived" ||
    Boolean(task.archived_at) ||
    task.path.startsWith("_archived/") ||
    task.path.startsWith("_archive/") ||
    task.path.includes("/_archived/") ||
    task.path.includes("/_archive/")
  );
}

export function isCompletedOrArchived(task: CompletedTaskRecord): boolean {
  return task.status === "completed" || isArchivedTask(task);
}

export function getCompletionTimestamp(task: CompletedTaskRecord): number {
  const archivedAt = task.archived_at ? Date.parse(task.archived_at) : Number.NaN;
  if (Number.isFinite(archivedAt)) return archivedAt;
  const statusChange = [...(task.extra?.status_history ?? [])]
    .reverse()
    .find((change) => change.to === "completed");
  const transitionAt = statusChange ? Date.parse(statusChange.at) : Number.NaN;
  if (Number.isFinite(transitionAt)) return transitionAt;
  const updatedAt = task.updated_at ? Date.parse(task.updated_at) : Number.NaN;
  return Number.isFinite(updatedAt) ? updatedAt : task.modifiedAt;
}

export function sortCompletedTasks<T extends CompletedTaskRecord>(tasks: readonly T[]): T[] {
  return tasks
    .filter(isCompletedOrArchived)
    .sort((left, right) => getCompletionTimestamp(right) - getCompletionTimestamp(left));
}

export function getRecentCompletedTasks<T extends CompletedTaskRecord>(
  tasks: readonly T[],
  limit: number,
): T[] {
  return sortCompletedTasks(
    tasks.filter(
      (task) =>
        task.status === "completed" && !isArchivedTask(task) && !task.extra?.hidden_from_recent,
    ),
  ).slice(0, Math.max(0, limit));
}

export function completionWeek(tasks: readonly HistoricalTask[], now = new Date(), weekStart = 1) {
  const days = weekGrid(now, weekStart % 7).map((date) => ({ date: dateKey(date), count: 0 }));
  const counts = new Map(days.map((day) => [day.date, day]));
  for (const task of tasks) {
    for (const change of task.extra?.status_history ?? []) {
      if (change.to !== "completed") continue;
      const changedAt = new Date(change.at);
      if (Number.isNaN(changedAt.valueOf())) continue;
      const day = counts.get(dateKey(changedAt));
      if (day) day.count += 1;
    }
  }
  return days;
}

export function clampSidebarWidth(width: number): number {
  return Math.max(200, Math.min(380, Math.round(width)));
}

export type SidebarMode = "full" | "mini" | "hidden";
export type SidebarPreference = { mode: SidebarMode; width: number; last: "full" | "mini" };

export function toggleSidebarPreference(preference: SidebarPreference): SidebarPreference {
  if (preference.mode === "hidden") {
    return { ...preference, mode: preference.last };
  }
  return { ...preference, mode: "hidden", last: preference.mode };
}

export function parseSidebarPreference(
  serialized: string | null,
  legacy: { compact: string | null; visible: string | null; width: string | null },
): SidebarPreference {
  try {
    const stored: unknown = JSON.parse(serialized ?? "null");
    if (Array.isArray(stored) && stored.length === 3) {
      const [mode, width, last] = stored as unknown[];
      if (
        (mode === "full" || mode === "mini" || mode === "hidden") &&
        typeof width === "number" &&
        (last === "full" || last === "mini")
      ) {
        return { mode, width: clampSidebarWidth(width), last };
      }
    }
  } catch {
    // Invalid or unavailable current-format values use the legacy preference keys.
  }

  const compact = legacy.compact === "true";
  const visible = legacy.visible !== "false";
  const storedWidth = Number(legacy.width);
  return {
    mode: visible ? (compact ? "mini" : "full") : "hidden",
    width: Number.isFinite(storedWidth) && storedWidth > 0 ? clampSidebarWidth(storedWidth) : 240,
    last: compact ? "mini" : "full",
  };
}
