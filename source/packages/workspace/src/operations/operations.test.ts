import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  archiveTask,
  archiveTaskGroup,
  autoArchiveResolvedGroups,
  buildWorkspaceIndex,
  createDocument,
  createTask,
  createTaskGroup,
  getTaskGroupWeekPath,
  initializeWorkspace,
  listTaskGroups,
  listTasks,
  migrateLegacyGroups,
  readWorkspaceDocument,
  resolveWorkspace,
  restoreTask,
  restoreTaskGroup,
  searchWorkspace,
  updateTask,
  updateWorkspaceOrganization,
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
  test("uses ISO Monday weeks by default and honors configurable week starts", () => {
    const date = new Date("2026-11-01T12:00:00.000Z");
    expect(getTaskGroupWeekPath(date, 1, 2026)).toBe("todo/work/W44");
    expect(getTaskGroupWeekPath(date, 7, 2026)).toBe("todo/work/W45");
    expect(getTaskGroupWeekPath(new Date("2026-01-01T12:00:00.000Z"), 1, 2026)).toBe(
      "todo/work/W01",
    );
  });

  test("saves organization settings when a default workspace has no task.yaml yet", async () => {
    const { projectRoot } = await project();
    const selected = await resolveWorkspace({ cwd: projectRoot });
    expect(selected.source).toBe("default");
    const updated = await updateWorkspaceOrganization(selected, {
      weekStart: 7,
      autoArchiveAfterDays: null,
    });
    expect(updated.config.organization).toEqual({ weekStart: 7, autoArchiveAfterDays: null });
    const reread = await resolveWorkspace({ cwd: projectRoot });
    expect(reread.config.organization).toEqual({ weekStart: 7, autoArchiveAfterDays: null });
  });

  test("rolls old groups into year folders and auto-archives resolved groups by age", async () => {
    const { workspace } = await project();
    const context = { root: workspace };
    const oldCreatedAt = "2025-06-01T12:00:00.000Z";
    const completedGroup = await createTaskGroup(context, "Old resolved group");
    const completedTask = await createTask(context, {
      group: completedGroup.id,
      title: "Resolved before rollover",
    });
    await updateTask(context, completedTask.metadata.id, { status: "completed" });
    const unfinishedGroup = await createTaskGroup(context, "Old unfinished group");
    const unfinishedTask = await createTask(context, {
      group: unfinishedGroup.id,
      title: "Still in progress",
    });
    for (const group of [completedGroup, unfinishedGroup]) {
      const path = join(workspace, group.path, "plan.md");
      const content = await readFile(path, "utf8");
      await writeFile(
        path,
        withMetadata(content, (values) => {
          const extra = values.extra as Record<string, unknown>;
          extra.created_at = oldCreatedAt;
        }),
      );
    }

    const rolloverArchives = await autoArchiveResolvedGroups(context, null);
    expect(rolloverArchives.map((group) => group.id)).toContain(completedGroup.id);
    const groupsAfterRollover = await listTaskGroups(context);
    expect(groupsAfterRollover.find((group) => group.id === completedGroup.id)?.archived).toBe(
      true,
    );
    expect(groupsAfterRollover.find((group) => group.id === unfinishedGroup.id)?.path).toMatch(
      /^todo\/work\/2025\/W\d{2}\/old-unfinished-group--[a-f0-9]{6}$/,
    );
    expect(unfinishedTask.path).toContain(unfinishedGroup.path);

    const agedGroup = await createTaskGroup(context, "Aged resolved group");
    const agedTask = await createTask(context, {
      group: agedGroup.id,
      title: "Archive after delay",
    });
    const completed = await updateTask(context, agedTask.metadata.id, { status: "completed" });
    const agedAt = new Date(Date.now() - 3 * 86_400_000).toISOString();
    const agedPath = join(workspace, completed.task.path);
    const agedContent = await readFile(agedPath, "utf8");
    await writeFile(
      agedPath,
      withMetadata(agedContent, (values) => {
        values.updated_at = agedAt;
        const extra = values.extra as Record<string, unknown>;
        extra.status_history = [{ from: "planned", to: "completed", at: agedAt }];
      }),
    );
    const ageArchives = await autoArchiveResolvedGroups(context, 2);
    expect(ageArchives.map((group) => group.id)).toContain(agedGroup.id);
    expect(
      (await listTaskGroups(context)).find((group) => group.id === agedGroup.id)?.archived,
    ).toBe(true);
  });

  test("keeps current resolved groups active when automatic archiving is disabled", async () => {
    const { workspace } = await project();
    const context = { root: workspace };
    const group = await createTaskGroup(context, "Manual archive only");
    const task = await createTask(context, { group: group.id, title: "Stay visible" });
    await updateTask(context, task.metadata.id, { status: "completed" });
    expect(await autoArchiveResolvedGroups(context, null)).toEqual([]);
    expect((await listTaskGroups(context)).find((item) => item.id === group.id)?.archived).toBe(
      false,
    );
  });

  test("migrates a legacy flat group while preserving IDs and Markdown", async () => {
    const { workspace } = await project();
    const context = { root: workspace };
    const group = await createTaskGroup(context, "Legacy project");
    const task = await createTask(context, {
      group: group.id,
      title: "Preserve this work",
      description: "Keep the authored body",
    });
    const originalBody = await readWorkspaceDocument(context, task.path);
    const legacyPath = "todo/legacy-project";
    await rename(join(workspace, group.path), join(workspace, legacyPath));
    const migrated = await migrateLegacyGroups(context);
    expect(migrated).toHaveLength(1);
    expect(migrated[0]?.path).toMatch(
      /^todo\/work\/(?:W\d{2}|\d{4}\/W\d{2})\/legacy-project--[a-f0-9]{6}$/,
    );
    const index = await buildWorkspaceIndex(context);
    const migratedTask = [...index.documents.values()].find(
      (document) => document.metadata.id === task.metadata.id,
    );
    expect(migratedTask?.metadata.id).toBe(task.metadata.id);
    expect(await readWorkspaceDocument(context, migratedTask!.path)).toBe(originalBody);
  });

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
    expect(task.path).toMatch(
      /^todo\/work\/W\d{2}\/workspace-engine--[a-f0-9]{6}\/001-build-scanner\.md$/,
    );
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
    const scheduled = await updateTask(context, task.metadata.id, { dueAt: "2026-11-06" });
    expect(scheduled.task.metadata.due_at).toBe("2026-11-06");
    const unscheduled = await updateTask(context, task.metadata.id, { dueAt: null });
    expect(unscheduled.task.metadata.due_at).toBeUndefined();
    const hidden = await updateTask(context, task.metadata.id, { hiddenFromRecent: true });
    expect(hidden.task.metadata.extra?.hidden_from_recent).toBe(true);
    const shown = await updateTask(context, task.metadata.id, { hiddenFromRecent: false });
    expect(shown.task.metadata.extra?.hidden_from_recent).toBe(false);
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
    await archiveTaskGroup(context, group.id);
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

  test("keeps completed tasks in place and archives/restores resolved groups by group ID", async () => {
    const { workspace } = await project();
    const context = { root: workspace };
    const group = await createTaskGroup(context, "Release prep");
    const task = await createTask(context, { group: group.id, title: "Ship it" });
    const updated = await updateTask(context, task.metadata.id, { status: "completed" });
    expect(updated.task.path).toBe(task.path);
    expect(updated.task.metadata.created_at).toBeTruthy();
    expect(updated.task.metadata.archived_at).toBeUndefined();
    const archived = await archiveTaskGroup(context, group.id);
    expect(archived.path).toMatch(/^todo\/_archived\//);
    const restored = await restoreTaskGroup(context, group.id);
    expect(restored.path).toMatch(
      /^todo\/work\/(?:W\d{2}|\d{4}\/W\d{2})\/release-prep--[a-f0-9]{6}$/,
    );
    expect(restored.finished).toBe(true);
    expect((await listTaskGroups(context))[0]?.archived).toBe(false);
    const restoredTask = (await buildWorkspaceIndex(context)).documents.get(
      `${restored.path}/001-ship-it.md`,
    );
    expect(restoredTask?.metadata.archived_at).toBeUndefined();
    expect(restoredTask?.metadata.created_at).toBe(updated.task.metadata.created_at);
    expect(restoredTask?.metadata.updated_at).toBe(updated.task.metadata.updated_at);
  });

  test("archives a task in place and restores its previous status", async () => {
    const { workspace } = await project();
    const context = { root: workspace };
    const group = await createTaskGroup(context, "Partial work");
    const task = await createTask(context, { group: group.id, title: "Pause this" });
    const started = await updateTask(context, task.metadata.id, { status: "in-progress" });
    const archived = await archiveTask(context, task.metadata.id, started.task.contentHash);
    expect(archived.path).toBe(task.path);
    expect(archived.metadata.status).toBe("archived");
    const restored = await restoreTask(context, task.metadata.id, archived.contentHash);
    expect(restored.path).toBe(task.path);
    expect(restored.metadata.status).toBe("in-progress");
    expect(restored.metadata.archived_at).toBeUndefined();
  });

  test("allows changing a task status from inside an archived group and restores its folder", async () => {
    const { workspace } = await project();
    const context = { root: workspace };
    const group = await createTaskGroup(context, "Status from archive");
    const task = await createTask(context, { group: group.id, title: "Return to planned" });
    await updateTask(context, task.metadata.id, { status: "completed" });
    await archiveTaskGroup(context, group.id);
    const archivedTask = [...(await buildWorkspaceIndex(context)).documents.values()].find(
      (document) => document.metadata.id === task.metadata.id,
    );
    if (!archivedTask) throw new Error("Archived task was not found");

    const reopened = await updateTask(
      context,
      task.metadata.id,
      { status: "planned" },
      archivedTask.contentHash,
    );
    expect(reopened.task.metadata.status).toBe("planned");
    expect(reopened.task.path).toMatch(/^todo\/work\/W\d{2}\/status-from-archive--/);
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
