import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getCliMetadata, inspectWorkspace, resolveCommand } from "#/command";

describe("CLI command metadata", () => {
  test("supports task and tk aliases", () => {
    expect(getCliMetadata("0.1.0").aliases).toEqual(["task", "tk"]);
  });

  test("resolves the first positional command", () => {
    expect(resolveCommand(["--json", "doctor"])).toBe("doctor");
    expect(resolveCommand(["--help"])).toBeUndefined();
  });

  test("doctor workspace inspection uses the shared index", async () => {
    const root = await mkdtemp(join(tmpdir(), "task-cli-index-"));
    try {
      await mkdir(join(root, "tasks"));
      await writeFile(join(root, "tasks", "one.md"), "---\nid: T-1\nname: One\ntype: task\n---\n");
      expect(await inspectWorkspace(root)).toEqual({ documents: 1, invalid: 0 });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
