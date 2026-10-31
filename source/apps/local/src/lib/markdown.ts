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
