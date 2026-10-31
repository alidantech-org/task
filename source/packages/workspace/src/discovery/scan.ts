import type { Dirent } from "node:fs";
import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { shouldIgnoreDirectory } from "@task/workspace/discovery/ignore";

export async function discoverMarkdown(root: string): Promise<string[]> {
  const files: string[] = [];
  async function walk(directory: string, relativeDirectory: string): Promise<void> {
    let entries: Dirent[];
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const path = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (!shouldIgnoreDirectory(entry.name)) await walk(resolve(directory, entry.name), path);
      } else if (entry.isFile() && /\.md$/i.test(entry.name)) {
        files.push(path);
      }
    }
  }
  await walk(root, "");
  return files.sort();
}
