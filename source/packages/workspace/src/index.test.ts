import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveSafeWorkspacePath, resolveWorkspacePath } from "./index.js";

let root = "";

afterEach(async () => {
  if (root) await rm(root, { recursive: true, force: true });
  root = "";
});

async function makeWorkspace(): Promise<string> {
  root = await mkdtemp(join(tmpdir(), "task-workspace-"));
  await mkdir(join(root, "tasks"));
  return root;
}

describe("workspace path safety", () => {
  test("resolves paths within the workspace", () => {
    const workspace = "/tmp/task-workspace";
    expect(resolveWorkspacePath(workspace, "tasks/example.md")).toBe(
      "/tmp/task-workspace/tasks/example.md",
    );
  });

  test("rejects lexical traversal", () => {
    expect(() => resolveWorkspacePath("/tmp/task-workspace", "../outside")).toThrow(
      "outside the selected workspace",
    );
  });

  test("rejects symlinked directories that escape the workspace", async () => {
    const workspace = await makeWorkspace();
    const outside = join(root, "..", "task-outside-test");
    await mkdir(outside, { recursive: true });
    await writeFile(join(outside, "secret.txt"), "not for Task");
    await symlink(outside, join(workspace, "tasks", "linked"), "dir");

    await expect(resolveSafeWorkspacePath(workspace, "tasks/linked/secret.txt")).rejects.toThrow(
      "outside the selected workspace",
    );
    await rm(outside, { recursive: true, force: true });
  });

  test("allows a safe path under the workspace", async () => {
    const workspace = await makeWorkspace();
    const target = await resolveSafeWorkspacePath(workspace, "tasks/new-task.md");
    expect(target).toBe(join(workspace, "tasks", "new-task.md"));
  });
});
