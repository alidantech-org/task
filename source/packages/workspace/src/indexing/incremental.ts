import { lstat, realpath } from "node:fs/promises";
import { resolve } from "node:path";
import { discoverMarkdown } from "@task/workspace/discovery/scan";
import { classifyDocument } from "@task/workspace/documents/classify";
import { hashContent, parseMetadata } from "@task/workspace/indexing/metadata";
import type {
  DocumentSummary,
  ValidationDiagnostic,
  WorkspaceContext,
  WorkspaceIndex,
} from "@task/workspace/indexing/types";
import { resolveSafeWorkspacePath } from "@task/workspace/paths/safe-path";

export async function buildWorkspaceIndex(context: WorkspaceContext): Promise<WorkspaceIndex> {
  return scanWorkspaceIndex(context, undefined);
}

async function scanWorkspaceIndex(
  context: WorkspaceContext,
  previous: WorkspaceIndex | undefined,
): Promise<WorkspaceIndex> {
  const root = await realpath(resolve(context.root));
  if (!(await lstat(root)).isDirectory()) throw new Error("Workspace root must be a directory");
  const documents = new Map<string, DocumentSummary>();
  const diagnostics: ValidationDiagnostic[] = [];
  const fingerprints = new Map<string, string>();
  const previousDiagnostics = new Map(
    previous?.diagnostics.map((diagnostic) => [diagnostic.path, diagnostic]),
  );
  for (const path of await discoverMarkdown(root)) {
    const absolutePath = await resolveSafeWorkspacePath(root, path);
    const stat = await Bun.file(absolutePath).stat();
    const fingerprint = `${stat.dev}:${stat.ino}:${stat.size}:${stat.mtimeMs}:${stat.ctimeMs}`;
    fingerprints.set(path, fingerprint);
    if (previous?.fingerprints.get(path) === fingerprint) {
      const unchanged = previous.documents.get(path);
      if (unchanged) documents.set(path, unchanged);
      const oldDiagnostic = previousDiagnostics.get(path);
      if (oldDiagnostic) diagnostics.push(oldDiagnostic);
      continue;
    }
    const content = await Bun.file(absolutePath).text();
    const contentHash = hashContent(content);
    try {
      const metadata = parseMetadata(content);
      documents.set(path, {
        path,
        metadata,
        classification: classifyDocument(metadata),
        size: stat.size,
        modifiedAt: stat.mtimeMs,
        contentHash,
        changeTime: stat.ctimeMs,
        fileId: `${stat.dev}:${stat.ino}`,
      });
    } catch (error) {
      diagnostics.push({
        path,
        message: error instanceof Error ? error.message : "Invalid metadata",
        category: "metadata",
      });
    }
  }
  return { root, documents, diagnostics, scannedAt: Date.now(), fingerprints };
}

export function reconcileWorkspaceIndex(index: WorkspaceIndex): Promise<WorkspaceIndex> {
  return scanWorkspaceIndex({ root: index.root }, index);
}
