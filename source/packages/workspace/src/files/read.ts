import { constants } from "node:fs";
import { open, realpath } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { WorkspaceError } from "@task/workspace/errors";
import { languageForPath } from "@task/workspace/files/language";
import { isDeniedPath } from "@task/workspace/git/deny";
import type { WorkspaceContext } from "@task/workspace/indexing/types";
import { resolveSafeWorkspacePath, resolveWorkspacePath } from "@task/workspace/paths/safe-path";

export type ProjectFile = {
  path: string;
  size: number;
  language: string;
  binary: boolean;
  contentHash: string;
  content: string;
};

export const maxProjectFileBytes = 1_000_000;

/**
 * Reads one text file under the project root for display. Paths are lexically and symlink-checked,
 * protected paths (keys, .env files, .git) are refused, and the file is opened without following
 * a symlink at the final component.
 */
export async function readProjectFile(
  context: WorkspaceContext,
  relativePath: string,
): Promise<ProjectFile> {
  if (!relativePath || relativePath.includes("\0") || isAbsolute(relativePath))
    throw new WorkspaceError("invalid_input", "A project-relative file path is required");
  const root = await realpath(context.projectRoot ?? context.root);
  let lexical: string;
  try {
    lexical = resolveWorkspacePath(root, relativePath);
  } catch {
    throw new WorkspaceError("path_not_safe", "Path is outside the project");
  }
  const normalized = lexical.slice(root.length + 1);
  if (!normalized || isDeniedPath(normalized))
    throw new WorkspaceError("path_not_safe", "This file is protected and cannot be shown");
  let absolute: string;
  try {
    absolute = await resolveSafeWorkspacePath(root, normalized);
  } catch (error) {
    throw new WorkspaceError("path_not_safe", "Unsafe project path", { cause: error });
  }
  let handle: Awaited<ReturnType<typeof open>>;
  try {
    handle = await open(absolute, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") throw new WorkspaceError("not_found", `No file at ${normalized}`);
    throw new WorkspaceError("path_not_safe", `Cannot open ${normalized}`, { cause: error });
  }
  try {
    const info = await handle.stat();
    if (!info.isFile()) throw new WorkspaceError("invalid_input", `${normalized} is not a file`);
    if (info.size > maxProjectFileBytes)
      throw new WorkspaceError(
        "validation_failed",
        `${normalized} is larger than ${maxProjectFileBytes / 1_000_000} MB`,
      );
    const bytes = await handle.readFile();
    const binary = bytes.subarray(0, 8000).includes(0);
    return {
      path: normalized,
      size: info.size,
      language: languageForPath(normalized),
      binary,
      contentHash: new Bun.CryptoHasher("sha256").update(bytes).digest("hex"),
      content: binary ? "" : bytes.toString("utf8"),
    };
  } finally {
    await handle.close();
  }
}
