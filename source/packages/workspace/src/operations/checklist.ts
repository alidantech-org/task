import { type Checklist, parseChecklist } from "@task/workspace/documents/checklist";
import { readWorkspaceDocument } from "@task/workspace/documents/read";
import { parseFrontmatter } from "@task/workspace/indexing/metadata";
import type { DocumentSummary, WorkspaceContext } from "@task/workspace/indexing/types";
import { findDocument, readWorkspaceIndex } from "@task/workspace/operations/query";

/** Reads a document's checklist grouped by heading, with its content hash for later writes. */
export async function readDocumentChecklist(
  context: WorkspaceContext,
  identifier: string,
): Promise<{ document: DocumentSummary; checklist: Checklist }> {
  const document = findDocument(await readWorkspaceIndex(context), identifier);
  const body = parseFrontmatter(await readWorkspaceDocument(context, document.path)).body;
  return { document, checklist: parseChecklist(body) };
}
