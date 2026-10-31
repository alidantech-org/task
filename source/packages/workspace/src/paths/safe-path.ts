import { lstat, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

function isWithin(root: string, candidate: string): boolean {
  const pathFromRoot = relative(root, candidate);
  return (
    pathFromRoot === "" ||
    (!isAbsolute(pathFromRoot) && pathFromRoot !== ".." && !pathFromRoot.startsWith(`..${sep}`))
  );
}

/** Resolve a path and verify lexical containment within the selected workspace. */
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
 * Missing final path segments are allowed; callers must still protect filesystem operations.
 */
export async function resolveSafeWorkspacePath(root: string, candidate: string): Promise<string> {
  const lexicalRoot = resolve(root);
  const target = resolveWorkspacePath(lexicalRoot, candidate);
  const realRoot = await realpath(lexicalRoot);
  let ancestor = target;

  while (true) {
    try {
      await lstat(ancestor);
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
        throw new Error("Unable to inspect workspace path safely");
      }
      const parent = resolve(ancestor, "..");
      if (parent === ancestor) throw new Error("Unable to verify workspace path safely");
      ancestor = parent;
      continue;
    }

    const info = await lstat(ancestor);
    if (info.isSymbolicLink()) {
      throw new Error("Symbolic links are not allowed in managed workspace paths");
    }
    let realAncestor: string;
    try {
      realAncestor = await realpath(ancestor);
    } catch {
      throw new Error("Unable to resolve workspace path safely");
    }
    if (!isWithin(realRoot, realAncestor)) {
      throw new Error("Path is outside the selected workspace");
    }
    return target;
  }
}
