import type { DocumentSummary } from "@task/workspace";
import type { Style } from "#/output/style";
import type { Symbols } from "#/output/symbols";
import { renderTask } from "#/output/task";

export function renderDocument(
  summary: DocumentSummary,
  style: Style,
  symbols: Symbols,
  verbose = false,
): string[] {
  return renderTask(summary, style, { ...symbols, task: symbols.document }, verbose);
}

export function renderDocumentList(
  documents: readonly DocumentSummary[],
  style: Style,
  symbols: Symbols,
  verbose = false,
): string[] {
  return documents.flatMap((document, index) => [
    ...(index ? [""] : []),
    ...renderDocument(document, style, symbols, verbose),
  ]);
}
