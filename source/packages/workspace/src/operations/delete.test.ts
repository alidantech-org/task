import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  deleteDocument,
  deleteTask,
  deleteTaskGroup,
  listTrash,
  restoreFromTrash,
} from "#/operations/delete";
import { createDocument, createTask, createTaskGroup } from "#/operations/mutate";
import { listTasks, readWorkspaceIndex } from "#/operations/query";

let root = "";
let trash = "";
const previousTrash = process.env.TASK_TRASH_DIR;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "task-delete-"));
  trash = join(root, "trash-base");
  process.env.TASK_TRASH_DIR = trash;
});
afterEach(async () => {
  if (previousTrash === undefined) delete process.env.TASK_TRASH_DIR;
  else process.env.TASK_TRASH_DIR = previousTrash;
  await rm(root, { recursive: true, force: true });
});

async function project(): Promise<{ root: string; projectRoot: string }> {
  const projectRoot = join(root, "project");
  const workspace = join(projectRoot, "tasks");
  await mkdir(workspace, { recursive: true });
  return { root: workspace, projectRoot };
}

describe("delete and trash", () => {
  test("deletes a task into trash outside the project and restores it", async () => {
    const context = await project();
    const group = await createTaskGroup(context, "Work");
    const task = await createTask(context, { title: "Remove me", group: group.id });
    const entry = await deleteTask(context, task.metadata.id);
    expect(entry.kind).toBe("task");
    expect(entry.trashPath.startsWith(trash)).toBe(true);
    expect(listTasks(await readWorkspaceIndex(context))).toHaveLength(0);
    expect(await listTrash(context)).toHaveLength(1);
    const restored = await restoreFromTrash(context, entry.trashId);
    expect(restored.originalPath).toBe(task.path);
    expect(listTasks(await readWorkspaceIndex(context))).toHaveLength(1);
    expect(await listTrash(context)).toHaveLength(0);
  });

  test("refuses to delete a task other tasks depend on unless forced", async () => {
    const context = await project();
    const group = await createTaskGroup(context, "Work");
    const base = await createTask(context, { title: "Base", group: group.id });
    await createTask(context, {
      title: "Needs base",
      group: group.id,
      dependsOn: [base.metadata.id],
    });
    await expect(deleteTask(context, base.metadata.id)).rejects.toThrow("dependency");
    const entry = await deleteTask(context, base.metadata.id, { force: true });
    expect(entry.id).toBe(base.metadata.id);
  });

  test("requires cascade for non-empty groups and restores the whole directory", async () => {
    const context = await project();
    const group = await createTaskGroup(context, "Work");
    await createTask(context, { title: "One", group: group.id });
    await expect(deleteTaskGroup(context, group.id)).rejects.toThrow("cascade");
    const entry = await deleteTaskGroup(context, group.id, { cascade: true });
    expect(entry.payloadType).toBe("directory");
    expect(listTasks(await readWorkspaceIndex(context))).toHaveLength(0);
    await restoreFromTrash(context, entry.trashId);
    expect(listTasks(await readWorkspaceIndex(context))).toHaveLength(1);
  });

  test("deletes documents but protects tasks and the workspace guide", async () => {
    const context = await project();
    const group = await createTaskGroup(context, "Work");
    const task = await createTask(context, { title: "Keep", group: group.id });
    const document = await createDocument(context, {
      title: "Notes",
      path: "docs/notes.md",
    });
    await expect(deleteDocument(context, task.metadata.id)).rejects.toThrow("task");
    await expect(deleteDocument(context, group.id)).rejects.toThrow("task group");
    const entry = await deleteDocument(context, document.metadata.id);
    expect(entry.kind).toBe("document");
    await restoreFromTrash(context, entry.trashId);
    await writeFile(
      join(context.root, "README.md"),
      "---\nid: TASK-WORKSPACE-README\nname: Guide\ntype: workspace-guide\n---\n\nguide\n",
    );
    await expect(deleteDocument(context, "TASK-WORKSPACE-README")).rejects.toThrow("structural");
  });

  test("restore refuses an occupied path and tampered or malformed trash ids", async () => {
    const context = await project();
    const group = await createTaskGroup(context, "Work");
    const task = await createTask(context, { title: "Once", group: group.id });
    const entry = await deleteTask(context, task.metadata.id);
    await mkdir(join(context.root, task.path, ".."), { recursive: true });
    await writeFile(join(context.root, task.path), "occupied");
    await expect(restoreFromTrash(context, entry.trashId)).rejects.toThrow("occupied");
    await expect(restoreFromTrash(context, "../../etc")).rejects.toThrow("Invalid trash id");
    await writeFile(join(entry.trashPath, "payload"), "tampered");
    await rm(join(context.root, task.path));
    await expect(restoreFromTrash(context, entry.trashId)).rejects.toThrow("changed");
  });

  test("never deletes through symlinked workspace ancestors", async () => {
    const context = await project();
    const group = await createTaskGroup(context, "Work");
    const task = await createTask(context, { title: "Linked", group: group.id });
    const outside = join(root, "outside");
    await mkdir(outside);
    await rm(join(context.root, "todo"), { recursive: true });
    await symlink(outside, join(context.root, "todo"));
    await expect(deleteTask(context, task.metadata.id)).rejects.toThrow();
  });
});
