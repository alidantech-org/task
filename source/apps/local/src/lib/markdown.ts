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
