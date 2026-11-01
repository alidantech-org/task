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
