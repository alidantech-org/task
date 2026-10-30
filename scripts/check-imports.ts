import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const roots = ["source"];
const extensions = new Set([".ts", ".tsx", ".mts", ".cts"]);
const violations: string[] = [];

async function visit(path: string): Promise<void> {
  const entries = await readdir(path, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(path, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules" && entry.name !== ".next" && entry.name !== "dist")
        await visit(fullPath);
      continue;
    }
    if (!extensions.has(fullPath.slice(fullPath.lastIndexOf(".")))) continue;
    // Next.js generates this declaration file and owns its relative type imports.
    if (entry.name === "next-env.d.ts") continue;
    const source = await readFile(fullPath, "utf8");
    const pattern = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(["'])(\.\.?\/)[^"']+\1/g;
    if (pattern.test(source)) violations.push(fullPath);
  }
}

for (const root of roots) await visit(root);
if (violations.length > 0) {
  process.stderr.write(
    `Relative TypeScript imports are forbidden:\n${violations.map((path) => `  ${path}`).join("\n")}\n`,
  );
  process.exit(1);
}
