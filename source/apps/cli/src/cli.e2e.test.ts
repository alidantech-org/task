import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

let root = "";
afterEach(async () => {
  if (root) await rm(root, { recursive: true, force: true });
  root = "";
});

async function cli(workspace: string, ...args: string[]) {
  const path = join(import.meta.dir, "index.ts");
  return Bun.spawnSync(["bun", "run", path, ...args], {
    cwd: root,
    env: { ...process.env, TASK_WORKSPACE_ROOT: workspace },
    stdout: "pipe",
    stderr: "pipe",
  });
}

describe("workspace-connected CLI", () => {
  test("task and tk share workspace operations with machine-readable output", async () => {
    root = await mkdtemp(join(tmpdir(), "task-cli-e2e-"));
    const workspace = join(root, "tasks");
    await mkdir(workspace);
    const groupResult = await cli(workspace, "group", "create", "--title", "CLI feature", "--json");
    expect(groupResult.exitCode).toBe(0);
    const group = JSON.parse(groupResult.stdout.toString());
    expect(group.id).toMatch(/^GRP-[A-F0-9]{12}$/);
    const createResult = await cli(
      workspace,
      "create",
      "--title",
      "CLI task",
      "--group",
      group.id,
      "--json",
    );
    expect(createResult.exitCode).toBe(0);
    const task = JSON.parse(createResult.stdout.toString());
    expect(task.id).toMatch(/^TSK-[A-F0-9]{12}$/);
    const listResult = await cli(workspace, "--json", "list");
    expect(listResult.exitCode).toBe(0);
    expect(JSON.parse(listResult.stdout.toString())).toHaveLength(1);
    const aliasList = await cli(workspace, "list", "--json");
    expect(aliasList.exitCode).toBe(0);
    expect(JSON.parse(aliasList.stdout.toString())[0].id).toBe(task.id);
    const completed = await cli(workspace, "update", task.id, "--status", "completed", "--json");
    expect(completed.exitCode).toBe(0);
    const completion = JSON.parse(completed.stdout.toString());
    expect(completion.archivedGroup.path).toMatch(/^archive\//);
    const archivedList = await cli(workspace, "list", "--archived", "--json");
    expect(JSON.parse(archivedList.stdout.toString())).toHaveLength(1);
    const restored = await cli(workspace, "restore", group.id, "--json");
    expect(JSON.parse(restored.stdout.toString()).path).toBe("todo/cli-feature");
    const missing = await cli(workspace, "show", "missing-id", "--json");
    expect(missing.exitCode).toBe(1);
    expect(missing.stdout.toString()).toBe("");
    expect(missing.stderr.toString()).toContain('"error"');
  });

  test("validates shared metadata and reports workspace discovery errors", async () => {
    root = await mkdtemp(join(tmpdir(), "task-cli-errors-"));
    const workspace = join(root, "tasks");
    await mkdir(workspace);
    const result = await cli(workspace, "validate", "--json");
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout.toString()).valid).toBe(true);
    await rm(workspace, { recursive: true, force: true });
    const missing = Bun.spawnSync(["bun", "run", join(import.meta.dir, "index.ts"), "info"], {
      cwd: root,
      env: { ...process.env, TASK_WORKSPACE_ROOT: "" },
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(missing.exitCode).toBe(2);
    expect(missing.stderr.toString()).toContain("No Task workspace found");
  });
});
