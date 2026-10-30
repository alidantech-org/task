import { isAbsolute, relative, resolve, sep } from "node:path";

/**
 * Resolve a path and verify lexical containment within the selected workspace.
 * Filesystem callers must additionally defend against symlink escapes.
 */
export function resolveWorkspacePath(root: string, candidate: string): string {
  const absoluteRoot = resolve(root);
  const absoluteCandidate = resolve(absoluteRoot, candidate);
  const pathFromRoot = relative(absoluteRoot, absoluteCandidate);
  if (isAbsolute(pathFromRoot) || pathFromRoot === ".." || pathFromRoot.startsWith(`..${sep}`)) {
    throw new Error("Path is outside the selected workspace");
  }
  return absoluteCandidate;
}