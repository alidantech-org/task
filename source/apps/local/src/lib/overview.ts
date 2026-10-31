import { dateKey, weekGrid } from "@/lib/calendar";

export type StatusChange = { from: string; to: string; at: string };
export type HistoricalTask = {
  extra?: { status_history?: readonly StatusChange[] };
};
export type CompletedTaskRecord = HistoricalTask & {
  status?: string;
  archived_at?: string;
  updated_at?: string;
  path: string;
  modifiedAt: number;
};

export function isArchivedTask(task: Pick<CompletedTaskRecord, "archived_at" | "path">): boolean {
  return (
    Boolean(task.archived_at) ||
    task.path.startsWith("_archive/") ||
    task.path.includes("/_archive/")
  );
}

export function isCompletedOrArchived(task: CompletedTaskRecord): boolean {
  return task.status === "completed" || isArchivedTask(task);
}

function completedAt(task: CompletedTaskRecord): number {
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
    .sort((left, right) => completedAt(right) - completedAt(left));
}

export function completionWeek(tasks: readonly HistoricalTask[], now = new Date()) {
  const days = weekGrid(now).map((date) => ({ date: dateKey(date), count: 0 }));
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
  return Math.max(208, Math.min(360, Math.round(width)));
}

export function sidebarResize(width: number): { width: number; collapsed: boolean } {
  if (width < 208) return { width: 76, collapsed: true };
  return { width: clampSidebarWidth(width), collapsed: false };
}
