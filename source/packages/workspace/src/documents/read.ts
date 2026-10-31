import { lstat } from "node:fs/promises";
import type { WorkspaceContext } from "@task/workspace/indexing/types";
import { resolveSafeWorkspacePath } from "@task/workspace/paths/safe-path";

export async function readWorkspaceDocument(
  context: WorkspaceContext,
  path: string,
): Promise<string> {
  if (!/\.md$/i.test(path)) throw new Error("Only Markdown documents can be read");
  const safePath = await resolveSafeWorkspacePath(context.root, path);
  const stat = await lstat(safePath);
  if (!stat.isFile()) throw new Error("Workspace document is not a regular file");
  return Bun.file(safePath).text();
}
