import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { resolveSafeWorkspacePath, resolveWorkspacePath } from "#/index";

let root = "";
let outside = "";

afterEach(async () => {
  if (root) await rm(root, { recursive: true, force: true });
  if (outside) await rm(outside, { recursive: true, force: true });
  root = "";
  outside = "";
});

async function makeWorkspace(): Promise<string> {
  root = await mkdtemp(join(tmpdir(), "task-workspace-"));
  await mkdir(join(root, "tasks"));
  return root;
}

describe("workspace path safety", () => {
  test("resolves paths within the workspace", () => {
    expect(resolveWorkspacePath("/tmp/task-workspace", "tasks/example.md")).toBe(
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
    outside = join(workspace, "..", `${basename(workspace)}-outside`);
    await mkdir(outside, { recursive: true });
    await writeFile(join(outside, "secret.txt"), "not for Task");
    await symlink(outside, join(workspace, "tasks", "linked"), "dir");

    await expect(resolveSafeWorkspacePath(workspace, "tasks/linked/secret.txt")).rejects.toThrow(
      "outside the selected workspace",
    );
  });

  test("rejects dangling symlinks rather than allowing writes through them", async () => {
    const workspace = await makeWorkspace();
    await symlink(
      join(workspace, "..", "missing-outside-target"),
      join(workspace, "tasks", "dangling"),
    );

    await expect(resolveSafeWorkspacePath(workspace, "tasks/dangling/new-file.md")).rejects.toThrow(
      "Unable to resolve workspace path safely",
    );
  });

  test("allows a safe path under the workspace", async () => {
    const workspace = await makeWorkspace();
    const target = await resolveSafeWorkspacePath(workspace, "tasks/new-task.md");
    expect(target).toBe(join(workspace, "tasks", "new-task.md"));
  });
});
