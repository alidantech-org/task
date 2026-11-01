export type DocumentFolder = { path: string; name: string; depth: number };

export function listDocumentFolders(paths: readonly string[]): DocumentFolder[] {
  const folders = new Set<string>();
  for (const path of paths) {
    const segments = path.split("/").slice(0, -1);
    for (let index = 0; index < segments.length; index += 1) {
      folders.add(segments.slice(0, index + 1).join("/"));
    }
  }
  return [...folders]
    .sort((left, right) => left.localeCompare(right))
    .map((path) => ({
      path,
      name: path.split("/").at(-1) ?? path,
      depth: path.split("/").length - 1,
    }));
}

/** Top-level folders with their file counts; files directly in the root are not folders. */
export function topLevelFolders(paths: readonly string[]): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const path of paths) {
    const slash = path.indexOf("/");
    if (slash <= 0) continue;
    const name = path.slice(0, slash);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Files that sit directly in the root of the workspace. */
export function rootFiles<T extends { path: string }>(documents: readonly T[]): T[] {
  return documents.filter((document) => !document.path.includes("/"));
}

export type HeadingEntry = { line: number; level: number; title: string; id: string };

const fenceMarker = /^\s*(```|~~~)/;

function plainHeadingTitle(raw: string): string {
  return raw
    .replace(/!?\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[`*_~]/g, "")
    .trim();
}

/**
 * Every heading of a Markdown document with a stable anchor id (`h-…`, numbered when a title repeats).
 * The document body and its "On this page" list both use this, so their anchors always match.
 */
export function headingEntries(markdown: string): HeadingEntry[] {
  const counts = new Map<string, number>();
  const found: HeadingEntry[] = [];
  let fence: string | undefined;
  for (const [index, line] of markdown.split("\n").entries()) {
    const marker = fenceMarker.exec(line)?.[1];
    if (marker) {
      fence = fence === undefined ? marker : fence === marker ? undefined : fence;
      continue;
    }
    if (fence) continue;
    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!match?.[1] || !match[2]) continue;
    const title = plainHeadingTitle(match[2]);
    const slug = `h-${title
      .toLocaleLowerCase()
      .replace(/[^\w]+/g, "-")
      .replace(/^-|-$/g, "")}`;
    const occurrence = counts.get(slug) ?? 0;
    counts.set(slug, occurrence + 1);
    found.push({
      line: index + 1,
      level: match[1].length,
      title,
      id: occurrence ? `${slug}-${occurrence + 1}` : slug,
    });
  }
  return found;
}

export type SourceLink = { label: string; href: string };

/** Links in a document (Markdown links and bare web addresses), without images, anchors or code. */
export function extractLinks(markdown: string): SourceLink[] {
  const lines: string[] = [];
  let fence: string | undefined;
  for (const line of markdown.split("\n")) {
    const marker = fenceMarker.exec(line)?.[1];
    if (marker) {
      fence = fence === undefined ? marker : fence === marker ? undefined : fence;
      continue;
    }
    if (!fence) lines.push(line.replace(/`[^`]*`/g, ""));
  }
  const text = lines.join("\n");
  const found = new Map<string, SourceLink>();
  for (const match of text.matchAll(/(?<!!)\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)) {
    const href = match[2] ?? "";
    if (!href || href.startsWith("#") || found.has(href)) continue;
    found.set(href, { label: (match[1] ?? "").trim() || href, href });
  }
  const withoutMarkdownLinks = text.replace(/\[[^\]]*\]\([^)]*\)/g, " ");
  for (const match of withoutMarkdownLinks.matchAll(/https?:\/\/[^\s<>)\]]+/g)) {
    const href = match[0].replace(/[.,;:!?]+$/, "");
    if (!found.has(href)) found.set(href, { label: href, href });
  }
  return [...found.values()];
}

const taskCheckboxLine = /^(\s*(?:[-+*]|\d+[.)])\s+\[)([ xX])(\]\s+.*)$/;

export function markdownChecklistProgress(body: string): { completed: number; total: number } {
  const lines = body.match(/^\s*(?:[-+*]|\d+[.)])\s+\[[ xX]\]\s+.*$/gm) ?? [];
  return {
    completed: lines.filter((line) => /\[[xX]\]/.test(line)).length,
    total: lines.length,
  };
}

export function toggleMarkdownCheckbox(
  body: string,
  targetIndex: number,
  checked: boolean,
): string {
  let index = 0;
  return body
    .split("\n")
    .map((line) => {
      const match = taskCheckboxLine.exec(line);
      if (!match) return line;
      const currentIndex = index;
      index += 1;
      if (currentIndex !== targetIndex) return line;
      return `${match[1]}${checked ? "x" : " "}${match[3]}`;
    })
    .join("\n");
}

export function appendTimestampedMarkdownComment(
  body: string,
  comment: string,
  at = new Date().toISOString(),
): string {
  const text = comment.trim();
  if (!text) return body;
  const hasComments = /(?:^|\n)## Comments\s*(?:\n|$)/.test(body);
  const content = hasComments ? body : `${body.trimEnd()}\n\n## Comments\n`;
  return `${content.trimEnd()}\n\n- **${at}** — ${text}\n`;
}
