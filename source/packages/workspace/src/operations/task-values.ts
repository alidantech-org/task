import { WorkspaceError } from "@task/workspace/errors";
import { buildWorkspaceIndex } from "@task/workspace/indexing/incremental";
import { parseFrontmatter, serializeMarkdown } from "@task/workspace/indexing/metadata";
import type { DocumentSummary, WorkspaceContext } from "@task/workspace/indexing/types";
import { replaceFile } from "@task/workspace/operations/mutate";
import { findDocument } from "@task/workspace/operations/query";
import { resolveSafeWorkspacePath } from "@task/workspace/paths/safe-path";

/** Edits a task's frontmatter with an optimistic hash check and a validated, atomic write. */
export async function updateTaskValues(
  context: WorkspaceContext,
  identifier: string,
  mutate: (values: Record<string, unknown>) => void,
  expectedHash?: string,
): Promise<DocumentSummary> {
  const task = findDocument(await buildWorkspaceIndex(context), identifier);
  if (task.metadata.type !== "task")
    throw new WorkspaceError("invalid_input", `${identifier} is not a task`);
  if (expectedHash !== undefined && task.contentHash !== expectedHash)
    throw new WorkspaceError("conflict", `Task changed since it was loaded: ${task.path}`);
  const parsed = parseFrontmatter(
    await Bun.file(await resolveSafeWorkspacePath(context.root, task.path)).text(),
  );
  const values = { ...parsed.values };
  mutate(values);
  values.updated_at = new Date().toISOString();
  const next = serializeMarkdown(values, parsed.body);
  try {
    parseFrontmatter(next);
  } catch (error) {
    throw new WorkspaceError(
      "validation_failed",
      error instanceof Error ? error.message : "Invalid task metadata",
      { cause: error },
    );
  }
  await replaceFile(context, task.path, next, task.contentHash);
  return findDocument(await buildWorkspaceIndex(context), task.metadata.id);
}
