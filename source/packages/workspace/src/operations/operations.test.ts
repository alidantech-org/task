import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  archiveTask,
  archiveTaskGroup,
  buildWorkspaceIndex,
  createDocument,
  createTask,
  createTaskGroup,
  initializeWorkspace,
  listTaskGroups,
  listTasks,
  readWorkspaceDocument,
  resolveWorkspace,
  restoreTaskGroup,
  restoreTask,
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
  test("initializes a project workspace without overwriting existing content", async () => {
    root = await mkdtemp(join(tmpdir(), "task-init-project-"));
    await writeFile(join(root, "README.md"), "keep me\n");
    const initialized = await initializeWorkspace({ projectRoot: root, workspace: ".tasks" });
    expect(initialized.root).toBe(join(root, ".tasks"));
    expect(initialized.createdWorkspace).toBe(true);
    expect(await readFile(join(root, "task.yaml"), "utf8")).toBe('workspace: ".tasks"\n');
    expect(await readFile(join(root, "README.md"), "utf8")).toBe("keep me\n");
    await expect(initializeWorkspace({ projectRoot: root })).rejects.toThrow("already exists");
    expect(await readFile(join(root, "task.yaml"), "utf8")).toBe('workspace: ".tasks"\n');
  });

  test("rejects workspace paths outside the project", async () => {
    root = await mkdtemp(join(tmpdir(), "task-init-escape-"));
    await expect(
      initializeWorkspace({ projectRoot: root, workspace: "../outside" }),
    ).rejects.toThrow("inside the project");
  });

  test("rejects symlinked workspace components before creating outside paths", async () => {
    root = await mkdtemp(join(tmpdir(), "task-init-symlink-"));
    const outside = await mkdtemp(join(tmpdir(), "task-init-outside-"));
    await symlink(outside, join(root, "linked"), "dir");
    await expect(
      initializeWorkspace({ projectRoot: root, workspace: "linked/new-workspace" }),
    ).rejects.toMatchObject({ code: "path_not_safe" });
    await expect(readFile(join(outside, "new-workspace"), "utf8")).rejects.toThrow();
    await rm(outside, { recursive: true, force: true });
  });

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
    expect(updated.task.metadata.extra?.status_history).toEqual([
      expect.objectContaining({ from: "planned", to: "in-progress" }),
    ]);
    expect(await readWorkspaceDocument(context, task.path)).toContain("Keep the body");
  });

  test("records only real status transitions and validates the history shape", async () => {
    const { workspace } = await project();
    const context = { root: workspace };
    const group = await createTaskGroup(context, "Status history");
    const task = await createTask(context, { group: group.id, title: "Track transitions" });
    expect(task.metadata.extra?.status_history).toBeUndefined();
    const started = await updateTask(context, task.metadata.id, { status: "in-progress" });
    const unchanged = await updateTask(context, task.metadata.id, { status: "in-progress" });
    expect(unchanged.task.metadata.extra?.status_history).toHaveLength(1);
    const completed = await updateTask(context, task.metadata.id, { status: "completed" });
    expect(completed.task.metadata.extra?.status_history).toHaveLength(2);
    expect(completed.task.metadata.extra?.status_history?.[1]).toMatchObject({
      from: "in-progress",
      to: "completed",
    });
    expect(completed.task.metadata.extra?.status_history?.[1]?.at).toBeTruthy();
    expect(started.task.metadata.extra?.status_history?.[0]?.at).toBeTruthy();
    const restored = await restoreTaskGroup(context, group.id);
    const restoredTask = (await buildWorkspaceIndex(context)).documents.get(
      `${restored.path}/001-track-transitions.md`,
    );
    expect(restoredTask?.metadata.extra?.status_history).toHaveLength(2);

    const taskPath = join(workspace, restoredTask?.path ?? "");
    const content = await readFile(taskPath, "utf8");
    await writeFile(
      taskPath,
      withMetadata(content, (values) => {
        values.extra = { status_history: [{ from: "unknown", to: "completed", at: "yesterday" }] };
      }),
    );
    expect(await validateWorkspace(context)).toEqual(
      expect.arrayContaining([expect.objectContaining({ category: "metadata" })]),
    );
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

  test("rejects updates against a stale task content hash", async () => {
    const { workspace } = await project();
    const context = { root: workspace };
    const group = await createTaskGroup(context, "Concurrent edits");
    const task = await createTask(context, { group: group.id, title: "Avoid overwriting" });
    await updateTask(context, task.metadata.id, { status: "in-progress" });
    await expect(
      updateTask(context, task.metadata.id, { status: "blocked" }, task.contentHash),
    ).rejects.toMatchObject({ code: "conflict" });
  });

  test("moves a completed group to completed storage and archives/restores by group ID", async () => {
    const { workspace } = await project();
    const context = { root: workspace };
    const group = await createTaskGroup(context, "Release prep");
    const task = await createTask(context, { group: group.id, title: "Ship it" });
    const updated = await updateTask(context, task.metadata.id, { status: "completed" });
    expect(updated.completedGroup?.path).toMatch(
      /^todo\/_completed\/\d{4}\/\d{2}\/\d{4}-\d{2}-\d{2}-release-prep$/,
    );
    expect(updated.task.path).toBe(`${updated.completedGroup?.path}/001-ship-it.md`);
    expect(updated.task.metadata.created_at).toBeTruthy();
    expect(updated.task.metadata.archived_at).toBeUndefined();
    const archived = await archiveTaskGroup(context, group.id);
    expect(archived.path).toMatch(/^todo\/_archived\//);
    const restored = await restoreTaskGroup(context, group.id);
    expect(restored.path).toMatch(/^todo\/_completed\//);
    expect(restored.finished).toBe(true);
    expect((await listTaskGroups(context))[0]?.archived).toBe(false);
    const restoredTask = (await buildWorkspaceIndex(context)).documents.get(
      `${restored.path}/001-ship-it.md`,
    );
    expect(restoredTask?.metadata.archived_at).toBeUndefined();
    expect(restoredTask?.metadata.created_at).toBe(updated.task.metadata.created_at);
    expect(restoredTask?.metadata.updated_at).toBe(updated.task.metadata.updated_at);
  });

  test("archives an incomplete task independently and restores its original path", async () => {
    const { workspace } = await project();
    const context = { root: workspace };
    const group = await createTaskGroup(context, "Partial work");
    const task = await createTask(context, { group: group.id, title: "Pause this" });
    const archived = await archiveTask(context, task.metadata.id, task.contentHash);
    expect(archived.path).toMatch(/^todo\/_archived\/\d{4}\/\d{2}\/\d{4}-\d{2}-\d{2}-task-/);
    expect(archived.metadata.status).toBe("planned");
    expect(archived.metadata.extra?.archived_from).toBe("todo/partial-work/001-pause-this.md");
    const restored = await restoreTask(context, task.metadata.id, archived.contentHash);
    expect(restored.path).toBe(task.path);
    expect(restored.metadata.status).toBe("planned");
    expect(restored.metadata.archived_at).toBeUndefined();
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
