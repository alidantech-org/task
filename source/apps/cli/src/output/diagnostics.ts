import type { ValidationDiagnostic } from "@task/workspace";
import type { Style } from "#/output/style";
import type { Symbols } from "#/output/symbols";

function category(message: string): string {
  const text = message.toLowerCase();
  if (text.includes("frontmatter") || text.includes("metadata") || text.includes("yaml"))
    return "Metadata";
  if (text.includes("link")) return "Links";
  if (text.includes("depend") || text.includes("reference") || text.includes("cycle"))
    return "References";
  return "Workspace";
}

export function renderDiagnostics(
  diagnostics: readonly ValidationDiagnostic[],
  style: Style,
  symbols: Symbols,
): string[] {
  const sorted = [...diagnostics].sort(
    (a, b) => a.path.localeCompare(b.path) || a.message.localeCompare(b.message),
  );
  const paths = new Map<string, ValidationDiagnostic[]>();
  for (const diagnostic of sorted)
    paths.set(diagnostic.path, [...(paths.get(diagnostic.path) ?? []), diagnostic]);
  const lines: string[] = [];
  for (const [path, entries] of paths) {
    lines.push(`${style.strong(path)}`);
    for (const entry of entries)
      lines.push(
        `  ${style.warning(symbols.warning)} ${category(entry.message)}: ${entry.message}`,
      );
  }
  lines.push("");
  lines.push(
    style.error(`${sorted.length} validation ${sorted.length === 1 ? "issue" : "issues"}.`),
  );
  return lines;
}
