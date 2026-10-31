import type { DocumentSummary } from "@task/workspace";
import type { Style } from "#/output/style";
import type { Symbols } from "#/output/symbols";

export function renderTask(
  summary: DocumentSummary,
  style: Style,
  symbols: Symbols,
  verbose = false,
): string[] {
  const meta = summary.metadata;
  const state = meta.status ?? meta.type;
  const priority = meta.priority ? ` · ${meta.priority}` : "";
  const owner = meta.assignee ? ` · ${meta.assignee}` : "";
  const due = meta.due_at ? ` · due ${meta.due_at}` : "";
  return [
    `${symbols.task} ${style.accent(meta.id)}  ${style.strong(meta.name)}`,
    `  ${state}${priority}${owner}${due}`,
    ...(verbose ? [`  ${style.muted(summary.path)}`] : []),
    ...(meta.tags.length ? [`  ${style.muted(`tags ${meta.tags.join(" · ")}`)}`] : []),
  ];
}
