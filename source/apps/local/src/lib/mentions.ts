export type TextPart = { text: string; mention?: string };

/** Splits text so `@name` mentions can be highlighted; everything else is kept verbatim. */
export function splitMentions(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(/(^|[\s(])@([A-Za-z0-9][\w.-]*[A-Za-z0-9]|[A-Za-z0-9])/g)) {
    const start = (match.index ?? 0) + (match[1]?.length ?? 0);
    if (start > last) parts.push({ text: text.slice(last, start) });
    parts.push({ text: `@${match[2]}`, mention: match[2] });
    last = start + 1 + (match[2]?.length ?? 0);
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

/** A short relative time such as "5 minutes ago", falling back to a date for older entries. */
export function relativeTime(iso: string, now = Date.now()): string {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return iso;
  const seconds = Math.round((time - now) / 1000);
  const abs = Math.abs(seconds);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (abs < 60) return formatter.format(Math.round(seconds), "second");
  if (abs < 3600) return formatter.format(Math.round(seconds / 60), "minute");
  if (abs < 86_400) return formatter.format(Math.round(seconds / 3600), "hour");
  if (abs < 7 * 86_400) return formatter.format(Math.round(seconds / 86_400), "day");
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(
    time,
  );
}
