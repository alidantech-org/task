import { lstat, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

function isWithin(root: string, candidate: string): boolean {
  const pathFromRoot = relative(root, candidate);
  return pathFromRoot === "" || (!isAbsolute(pathFromRoot) && pathFromRoot !== ".." && !pathFromRoot.startsWith(`..${sep}`));
}

/**
 * Resolve a path and verify lexical containment within the selected workspace.
 * This does not inspect the filesystem and must not be used as the only security check.
 */
export function resolveWorkspacePath(root: string, candidate: string): string {
  const absoluteRoot = resolve(root);
  const absoluteCandidate = resolve(absoluteRoot, candidate);
  if (!isWithin(absoluteRoot, absoluteCandidate)) {
    throw new Error("Path is outside the selected workspace");
  }
  return absoluteCandidate;
}

/**
 * Resolve a workspace path while rejecting existing symlink ancestors that escape it.
 * Missing final path segments are allowed so callers can safely create new files.
 */
export async function resolveSafeWorkspacePath(root: string, candidate: string): Promise<string> {
  const lexicalRoot = resolve(root);
  const target = resolveWorkspacePath(lexicalRoot, candidate);
  const realRoot = await realpath(lexicalRoot);
  let ancestor = target;

  while (true) {
    try {
      await lstat(ancestor);
      const realAncestor = await realpath(ancestor);
      if (!isWithin(realRoot, realAncestor)) {
        throw new Error("Path is outside the selected workspace");
      }
      return target;
    } catch (error) {
      if (error instanceof Error && error.message === "Path is outside the selected workspace") {
        throw error;
      }
      const parent = resolve(ancestor, "..");
      if (parent === ancestor) {
        throw new Error("Unable to verify workspace path safely");
      }
      ancestor = parent;
    }
  }
}
