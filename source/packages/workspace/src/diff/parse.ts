export type DiffLine = {
  type: "context" | "add" | "delete";
  text: string;
  oldLine?: number;
  newLine?: number;
};
export type DiffHunk = { header: string; oldStart: number; newStart: number; lines: DiffLine[] };
export type DiffFile = {
  oldPath: string;
  newPath: string;
  binary: boolean;
  hunks: DiffHunk[];
};

/** Parses `git diff` unified output into files, hunks and numbered lines. */
export function parseUnifiedDiff(text: string): DiffFile[] {
  const files: DiffFile[] = [];
  let file: DiffFile | undefined;
  let hunk: DiffHunk | undefined;
  let oldLine = 0;
  let newLine = 0;
  for (const line of text.split("\n")) {
    if (line.startsWith("diff --git ")) {
      const match = /^diff --git a\/(.*) b\/(.*)$/.exec(line);
      file = { oldPath: match?.[1] ?? "", newPath: match?.[2] ?? "", binary: false, hunks: [] };
      files.push(file);
      hunk = undefined;
      continue;
    }
    if (!file) continue;
    if (!hunk) {
      if (line.startsWith("rename from ")) file.oldPath = line.slice("rename from ".length);
      else if (line.startsWith("rename to ")) file.newPath = line.slice("rename to ".length);
      else if (line.startsWith("Binary files ") || line.startsWith("GIT binary patch"))
        file.binary = true;
    }
    const header = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
    if (header) {
      oldLine = Number(header[1]);
      newLine = Number(header[2]);
      hunk = { header: line, oldStart: oldLine, newStart: newLine, lines: [] };
      file.hunks.push(hunk);
      continue;
    }
    if (!hunk || line.startsWith("\\")) continue;
    const marker = line[0];
    const content = line.slice(1);
    if (marker === "+") hunk.lines.push({ type: "add", text: content, newLine: newLine++ });
    else if (marker === "-") hunk.lines.push({ type: "delete", text: content, oldLine: oldLine++ });
    else if (marker === " ")
      hunk.lines.push({ type: "context", text: content, oldLine: oldLine++, newLine: newLine++ });
  }
  return files;
}
