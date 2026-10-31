const ignoredDirectoryNames = new Set([
  ".git",
  ".task",
  ".tasks-cache",
  ".cache",
  "node_modules",
  "vendor",
  "build",
  "dist",
  ".next",
  ".dart_tool",
  "coverage",
  "tmp",
  "temp",
]);

export function shouldIgnoreDirectory(name: string): boolean {
  return ignoredDirectoryNames.has(name);
}
