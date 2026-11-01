/**
 * Comments live in the task Markdown under a `## Comments` heading. Each entry is a
 * `### <ISO time> · <author>` block followed by its text. The older single-line
 * `- **<ISO time>** — text` entries are read but never written.
 */
export type TaskComment = {
  index: number;
  at: string;
  author?: string;
  text: string;
  /** First line (0-based) and the line after the last one that belong to this entry. */
  start: number;
  end: number;
};

const sectionHeading = /^##\s+comments\s*$/i;
const modernHeading = /^###\s+(\S+)(?:\s+[·•-]\s+(.+?))?\s*$/;
const legacyEntry = /^[-*]\s+\*\*([^*]+)\*\*\s+[—-]\s+(.*)$/;

function sectionRange(lines: readonly string[]): { start: number; end: number } | undefined {
  const start = lines.findIndex((line) => sectionHeading.test(line));
  if (start < 0) return undefined;
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1)
    if (/^#{1,2}\s/.test(lines[index] ?? "")) {
      end = index;
      break;
    }
  return { start, end };
}

export function parseComments(body: string): TaskComment[] {
  const lines = body.split("\n");
  const range = sectionRange(lines);
  if (!range) return [];
  const comments: TaskComment[] = [];
  let current: { at: string; author?: string; start: number; text: string[] } | undefined;
  const close = (end: number) => {
    if (!current) return;
    while (current.text.length && !current.text[current.text.length - 1]?.trim())
      current.text.pop();
    comments.push({
      index: comments.length,
      at: current.at,
      ...(current.author ? { author: current.author } : {}),
      text: current.text.join("\n").trim(),
      start: current.start,
      end,
    });
    current = undefined;
  };
  for (let index = range.start + 1; index < range.end; index += 1) {
    const line = lines[index] ?? "";
    const modern = modernHeading.exec(line);
    if (modern?.[1] && !Number.isNaN(Date.parse(modern[1]))) {
      close(index);
      current = {
        at: modern[1],
        ...(modern[2] ? { author: modern[2] } : {}),
        start: index,
        text: [],
      };
      continue;
    }
    const legacy = legacyEntry.exec(line);
    if (legacy?.[1] && !Number.isNaN(Date.parse(legacy[1]))) {
      close(index);
      current = { at: legacy[1], start: index, text: [legacy[2] ?? ""] };
      continue;
    }
    current?.text.push(line);
  }
  close(range.end);
  return comments;
}

/** Adds a comment at the end of the Comments section, creating the section when missing. */
export function appendComment(
  body: string,
  comment: { at: string; author: string; text: string },
): string {
  const entry = `### ${comment.at} · ${comment.author}\n\n${comment.text.trim()}\n`;
  const lines = body.split("\n");
  const range = sectionRange(lines);
  if (!range) return `${body.trimEnd()}\n\n## Comments\n\n${entry}`;
  const before = lines.slice(0, range.end).join("\n").trimEnd();
  const after = lines.slice(range.end).join("\n");
  return `${before}\n\n${entry}${after ? `\n${after}` : ""}`;
}

export function removeComment(body: string, index: number): string {
  const comment = parseComments(body)[index];
  if (!comment) throw new Error(`No comment ${index + 1}`);
  const lines = body.split("\n");
  lines.splice(comment.start, comment.end - comment.start);
  return lines.join("\n").replace(/\n{3,}/g, "\n\n");
}

/** `@name` tokens in a piece of text, without the at sign and without duplicates. */
export function mentionsOf(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(/(?:^|[\s(])@([A-Za-z0-9][\w.-]*[A-Za-z0-9]|[A-Za-z0-9])/g))
    if (match[1]) found.add(match[1]);
  return [...found];
}

/** The body without its Comments section, used when a recurring task is copied. */
export function stripComments(body: string): string {
  const lines = body.split("\n");
  const range = sectionRange(lines);
  if (!range) return body;
  lines.splice(range.start, range.end - range.start);
  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd()
    .concat("\n");
}
