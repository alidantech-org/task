import type { Recurrence } from "@task/workspace/indexing/types";

function parseDate(value: string): Date {
  const [year = 1970, month = 1, day = 1] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function format(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** The due date of the next occurrence; months keep the day when they can and clamp otherwise. */
export function nextDueDate(from: string, recurrence: Recurrence): string {
  const date = parseDate(from);
  if (recurrence.every === "day") date.setUTCDate(date.getUTCDate() + recurrence.interval);
  else if (recurrence.every === "week")
    date.setUTCDate(date.getUTCDate() + 7 * recurrence.interval);
  else {
    const day = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + recurrence.interval);
    const lastDay = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
    ).getUTCDate();
    date.setUTCDate(Math.min(day, lastDay));
  }
  return format(date);
}

/** The next occurrence's due date, or undefined when it would fall after `until`. */
export function nextOccurrence(from: string, recurrence: Recurrence): string | undefined {
  const next = nextDueDate(from, recurrence);
  return recurrence.until && next > recurrence.until ? undefined : next;
}

/** Parses "week", "week:2" or "month:3" as used by the command line. */
export function parseRecurrence(text: string): Recurrence {
  const [every, interval = "1"] = text.split(":");
  if (every !== "day" && every !== "week" && every !== "month")
    throw new Error(
      "Repeat must be day, week or month, optionally with an interval such as week:2",
    );
  const count = Number(interval);
  if (!Number.isInteger(count) || count < 1)
    throw new Error("Repeat interval must be a whole number of 1 or more");
  return { every, interval: count };
}
