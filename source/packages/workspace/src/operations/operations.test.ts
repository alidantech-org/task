import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildWorkspaceIndex,
  createDocument,
  createTask,
  createTaskGroup,
  listTaskGroups,
  listTasks,
  readWorkspaceDocument,
  resolveWorkspace,
  restoreTaskGroup,
  searchWorkspace,
  updateTask,
  validateWorkspace,
} from "#/index";

let root = "";

afterEach(async () => {
  if (root) await rm(root, { recursive: true, force: true });
  root = "";
});

function withMetadata(markdown: string, update: (values: Record<string, unknown>) => void): string {
  const match = /^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(markdown);
  if (!match) throw new Error("Test fixture is missing frontmatter");
  const values = Bun.YAML.parse(match[1]) as Record<string, unknown>;
  update(values);
  return `---\n${Bun.YAML.stringify(values).trimEnd()}\n---\n${markdown.slice(match[0].length)}`;
}

async function project(): Promise<{ projectRoot: string; workspace: string }> {
  root = await mkdtemp(join(tmpdir(), "task-operations-"));
  const workspace = join(root, "tasks");
  await mkdir(workspace);
  return { projectRoot: root, workspace };
}

describe("workspace resolution", () => {
  test("finds the nearest default workspace from nested directories", async () => {
    const { projectRoot, workspace } = await project();
    await mkdir(join(projectRoot, "src", "nested"), { recursive: true });
    const resolved = await resolveWorkspace({ cwd: join(projectRoot, "src", "nested") });
    expect(resolved.root).toBe(workspace);
    expect(resolved.source).toBe("default");
  });

  test("uses task.yaml workspace and rejects traversal", async () => {
    const { projectRoot, workspace } = await project();
    await writeFile(join(projectRoot, "task.yaml"), "workspace: tasks\n");
    expect((await resolveWorkspace({ cwd: projectRoot })).root).toBe(workspace);
    await writeFile(join(projectRoot, "task.yaml"), "workspace: ../escape\n");
    await expect(resolveWorkspace({ cwd: projectRoot })).rejects.toThrow("inside the project root");
  });

  test("argument and environment roots override discovery", async () => {
    const { projectRoot, workspace } = await project();
    const alternate = join(projectRoot, "alternate");
    await mkdir(alternate);
    expect((await resolveWorkspace({ cwd: "/", workspaceOverride: alternate })).source).toBe(
      "argument",
    );
    expect((await resolveWorkspace({ cwd: "/", environmentWorkspaceRoot: alternate })).source).toBe(
      "environment",
    );
    expect(
      (
        await resolveWorkspace({
          cwd: "/",
          workspaceOverride: workspace,
          environmentWorkspaceRoot: alternate,
        })
      ).root,
    ).toBe(workspace);
  });

  test("rejects missing workspaces", async () => {
    root = await mkdtemp(join(tmpdir(), "task-empty-project-"));
    await expect(resolveWorkspace({ cwd: root })).rejects.toThrow("No Task workspace found");
  });
});

describe("task operations", () => {
  test("creates numbered tasks with defaults, filters and body preserving updates", async () => {
    const { workspace } = await project();
    const context = { root: workspace };
    const group = await createTaskGroup(context, "Workspace engine");
    const task = await createTask(context, {
      group: group.id,
      title: "Build scanner",
      description: "Keep the body",
    });
    expect(task.metadata.id).toMatch(/^TSK-[A-F0-9]{12}$/);
    expect(task.metadata.status).toBe("planned");
    expect(task.metadata.priority).toBe("medium");
    expect(task.path).toBe("todo/workspace-engine/001-build-scanner.md");
    const index = await buildWorkspaceIndex(context);
    expect(listTasks(index, { status: "planned" })).toHaveLength(1);
    expect(listTasks(index, { group: group.id })).toHaveLength(1);
    const updated = await updateTask(context, task.metadata.id, {
      status: "in-progress",
      tags: ["engine"],
    });
    expect(updated.task.metadata.status).toBe("in-progress");
    expect(await readWorkspaceDocument(context, task.path)).toContain("Keep the body");
  });

  test("validates and persists explicit schedule dates", async () => {
    const { workspace } = await project();
    const context = { root: workspace };
    const group = await createTaskGroup(context, "Schedule fixture");
    const task = await createTask(context, {
      group: group.id,
      title: "Plan milestone",
      startAt: "2026-11-01",
      dueAt: "2026-11-07",
    });
    expect(task.metadata.start_at).toBe("2026-11-01");
    expect(task.metadata.due_at).toBe("2026-11-07");
    await expect(updateTask(context, task.metadata.id, { startAt: "2026-11-10" })).rejects.toThrow(
      "start_at must not be after due_at",
    );
  });

  test("archives a completed group and restores it by group ID", async () => {
    const { workspace } = await project();
    const context = { root: workspace };
    const group = await createTaskGroup(context, "Release prep");
    const task = await createTask(context, { group: group.id, title: "Ship it" });
    const updated = await updateTask(context, task.metadata.id, { status: "completed" });
    expect(updated.archivedGroup?.path).toMatch(
      /^archive\/\d{4}\/\d{2}\/\d{4}-\d{2}-\d{2}-release-prep$/,
    );
    expect(updated.task.path).toBe(`${updated.archivedGroup?.path}/001-ship-it.md`);
    expect(updated.task.metadata.created_at).toBeTruthy();
    expect(updated.task.metadata.archived_at).toBeTruthy();
    const restored = await restoreTaskGroup(context, group.id);
    expect(restored.path).toBe("todo/release-prep");
    expect((await listTaskGroups(context))[0]?.archived).toBe(false);
    const restoredTask = (await buildWorkspaceIndex(context)).documents.get("todo/release-prep/001-ship-it.md");
    expect(restoredTask?.metadata.archived_at).toBeUndefined();
    expect(restoredTask?.metadata.created_at).toBe(updated.task.metadata.created_at);
    expect(restoredTask?.metadata.updated_at).toBe(updated.task.metadata.updated_at);
  });

  test("searches document bodies, detects references, and protects explicit reads", async () => {
    const { workspace } = await project();
    const context = { root: workspace };
    const group = await createTaskGroup(context, "Search fixture");
    const task = await createTask(context, {
      group: group.id,
      title: "Find the token",
      description: "needle in body",
    });
    const matches = await searchWorkspace(context, "needle");
    expect(matches.map((match) => match.summary.metadata.id)).toContain(task.metadata.id);
    await expect(readWorkspaceDocument(context, "../outside.md")).rejects.toThrow();
    expect(await validateWorkspace(context)).toEqual([]);
  });

  test("reports duplicate task IDs, dependency cycles and broken local links", async () => {
    const { workspace } = await project();
    const context = { root: workspace };
    const group = await createTaskGroup(context, "Validation fixture");
    const first = await createTask(context, { group: group.id, title: "First" });
    const second = await createTask(context, { group: group.id, title: "Second" });
    const firstAbsolute = join(workspace, first.path);
    const secondAbsolute = join(workspace, second.path);
    const firstText = await readFile(firstAbsolute, "utf8");
    const secondText = await readFile(secondAbsolute, "utf8");
    await writeFile(
      firstAbsolute,
      withMetadata(firstText, (values) => {
        values.depends_on = [second.metadata.id];
      }),
    );
    await writeFile(
      secondAbsolute,
      withMetadata(secondText, (values) => {
        values.id = first.metadata.id;
        values.depends_on = [first.metadata.id];
      }),
    );
    await createDocument(context, {
      title: "Broken link",
      path: "docs/links.md",
      body: "[missing](missing.md)\n",
    });

    const diagnostics = await validateWorkspace(context);
    expect(
      diagnostics.some(
        (diagnostic) =>
          diagnostic.category === "identity" && diagnostic.message.includes("Duplicate"),
      ),
    ).toBe(true);
    expect(
      diagnostics.some(
        (diagnostic) =>
          diagnostic.category === "dependency" && diagnostic.message.includes("cycle"),
      ),
    ).toBe(true);
    expect(
      diagnostics.some(
        (diagnostic) => diagnostic.category === "link" && diagnostic.message.includes("Broken"),
      ),
    ).toBe(true);
  });

  test("rejects symlinked group path escapes", async () => {
    const { projectRoot, workspace } = await project();
    const outside = join(projectRoot, "outside");
    await mkdir(outside);
    await symlink(outside, join(workspace, "todo"));
    await expect(createTaskGroup({ root: workspace }, "Unsafe")).rejects.toThrow();
  });
});
