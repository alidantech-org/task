import { dateKey } from "@/lib/calendar";

export type Totals = { count: number; done: number; overdue: number; estimate: number };

type Scheduled = { status?: string; due_at?: string; estimate?: number };

/** Counts for a set of scheduled tasks, as shown at the top of the day and week sheets. */
export function totalsOf(tasks: readonly Scheduled[], today = dateKey(new Date())): Totals {
  return {
    count: tasks.length,
    done: tasks.filter((task) => task.status === "completed").length,
    overdue: tasks.filter(
      (task) => task.status !== "completed" && task.due_at !== undefined && task.due_at < today,
    ).length,
    estimate: tasks.reduce((sum, task) => sum + (task.estimate ?? 0), 0),
  };
}
