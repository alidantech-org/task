import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildWorkspaceIndex } from "@task/workspace";
import { navigationSections } from "#/navigation";

describe("TUI navigation", () => {
  test("exposes the initial workspace sections", () => {
    expect(navigationSections).toEqual(["Overview", "Projects", "Tasks", "Documents", "Activity"]);
  });

  test("TUI workspace overview can consume the shared metadata index", async () => {
    const root = await mkdtemp(join(tmpdir(), "task-tui-index-"));
    try {
      await mkdir(join(root, "tasks"));
      await writeFile(join(root, "tasks", "one.md"), "---\nid: T-1\nname: One\ntype: task\n---\n");
      const index = await buildWorkspaceIndex({ root });
      expect(index.documents.size).toBe(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
