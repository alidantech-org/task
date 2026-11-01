export type StatusChange = { from: string; to: string; at: string };

/** Total time a task has spent in progress, counting the open window up to `now`. */
export function inProgressMs(
  history: readonly StatusChange[] | undefined,
  status: string | undefined,
  now: number,
): number {
  let total = 0;
  let started: number | undefined;
  for (const change of history ?? []) {
    const at = Date.parse(change.at);
    if (Number.isNaN(at)) continue;
    if (change.to === "in-progress") started = at;
    else if (change.from === "in-progress" && started !== undefined) {
      total += Math.max(0, at - started);
      started = undefined;
    }
  }
  if (started !== undefined && status === "in-progress") total += Math.max(0, now - started);
  return total;
}

export function formatDuration(milliseconds: number): string {
  const minutes = Math.floor(milliseconds / 60_000);
  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ${minutes % 60} min`;
  const days = Math.floor(hours / 24);
  return `${days} d ${hours % 24} h`;
}

export type DueState = { text: string; tone: "late" | "soon" | "ok" | "none" };

/** Describes a due date relative to today; finished work is never late. */
export function describeDue(
  due: string | undefined,
  status: string | undefined,
  now: number,
): DueState {
  if (!due) return { text: "No due date", tone: "none" };
  const day = Date.parse(`${due.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(day)) return { text: due, tone: "none" };
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const days = Math.round((day - today.getTime()) / 86_400_000);
  if (status === "completed" || status === "archived")
    return { text: "Due date passed", tone: "ok" };
  if (days < 0) return { text: `${-days} day${days === -1 ? "" : "s"} overdue`, tone: "late" };
  if (days === 0) return { text: "Due today", tone: "soon" };
  if (days === 1) return { text: "Due tomorrow", tone: "soon" };
  return { text: `Due in ${days} days`, tone: days <= 3 ? "soon" : "ok" };
}

function plain(markdown: string): string {
  return markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/[`*_~>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * A short description for the overview: the first prose of the Goal-like section when there is one,
 * otherwise the first prose in the document, limited to `maxWords` words.
 */
export function descriptionOf(body: string, maxWords = 60): { text: string; truncated: boolean } {
  const lines = body.replace(/<!--[\s\S]*?-->/g, "").split("\n");
  const goal = lines.findIndex((line) =>
    /^#{1,6}\s+(goal|context|purpose|background|why)\b/i.test(line),
  );
  const start = goal >= 0 ? goal + 1 : 0;
  const paragraphs: string[] = [];
  let current: string[] = [];
  let fenced = false;
  const flush = () => {
    if (current.length) paragraphs.push(plain(current.join(" ")));
    current = [];
  };
  for (const line of lines.slice(start)) {
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced;
      flush();
      continue;
    }
    if (fenced) continue;
    if (/^#{1,6}\s/.test(line)) {
      if (paragraphs.length || current.length) break;
      continue;
    }
    if (!line.trim() || /^\s*(?:[-+*]|\d+[.)])\s/.test(line) || /^\s*\|/.test(line)) {
      flush();
      continue;
    }
    current.push(line);
  }
  flush();
  const words = paragraphs.join(" ").split(/\s+/).filter(Boolean);
  if (words.length === 0) return { text: "", truncated: false };
  const truncated = words.length > maxWords;
  return { text: `${words.slice(0, maxWords).join(" ")}${truncated ? "…" : ""}`, truncated };
}
