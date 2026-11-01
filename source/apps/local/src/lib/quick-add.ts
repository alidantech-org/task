import { dateKey } from "@/lib/calendar";

export type QuickAddGroup = { id: string; name: string };
export type QuickAddResult = { title: string; dueDate: string; groupId: string };

function shiftDate(key: string, days: number): string {
  const date = new Date(`${key}T12:00:00`);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

export function parseQuickAdd(
  source: string,
  groups: readonly QuickAddGroup[],
  presetDueDate = "",
  now = new Date(),
): QuickAddResult {
  const today = dateKey(now);
  let title = source;
  let dueDate = presetDueDate;
  let groupId = "";
  const groupMatch = title.match(/#(\w+)/);
  if (groupMatch?.[1]) {
    const token = groupMatch[1].toLocaleLowerCase();
    const group = groups.find((candidate) =>
      candidate.name.toLocaleLowerCase().replace(/\s/g, "").startsWith(token),
    );
    if (group) {
      groupId = group.id;
      title = title.replace(groupMatch[0], "");
    }
  }
  const dateMatch = title.match(
    /\b(today|tomorrow|(?:mon|tue|wed|thu|fri|sat|sun)(?:day|sday|nesday|rsday|urday)?)\b/i,
  );
  if (dateMatch?.[1]) {
    const token = dateMatch[1].toLocaleLowerCase();
    if (token === "today") dueDate = today;
    else if (token === "tomorrow") dueDate = shiftDate(today, 1);
    else {
      const dayIndex = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].indexOf(token.slice(0, 3));
      const currentIndex = (now.getDay() + 6) % 7;
      dueDate = shiftDate(today, (dayIndex - currentIndex + 7) % 7 || 7);
    }
    title = title.replace(dateMatch[0], "");
  }
  return { title: title.replace(/\s+/g, " ").trim(), dueDate, groupId };
}
