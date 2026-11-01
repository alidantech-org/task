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

function label(entry: ValidationDiagnostic): string {
  return entry.category === "quality" ? "Quality" : category(entry.message);
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
    for (const entry of entries) {
      const isWarning = entry.severity === "warning";
      const mark = isWarning ? style.warning(symbols.warning) : style.error(symbols.error);
      lines.push(`  ${mark} ${label(entry)}: ${entry.message}`);
    }
  }
  const warnings = sorted.filter((entry) => entry.severity === "warning").length;
  const errors = sorted.length - warnings;
  lines.push("");
  const summary = `${errors} ${errors === 1 ? "error" : "errors"}, ${warnings} ${warnings === 1 ? "warning" : "warnings"}.`;
  lines.push(errors > 0 ? style.error(summary) : style.warning(summary));
  return lines;
}
