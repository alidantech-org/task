import { afterEach, describe, expect, test } from "bun:test";
import { appendFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getTaskChanges, getTaskFileDiff } from "#/git/tracking";
import { createTask, createTaskGroup, updateTask } from "#/operations/mutate";
import { findDocument, readWorkspaceIndex } from "#/operations/query";

let root = "";
afterEach(async () => {
  if (root) await rm(root, { recursive: true, force: true });
  root = "";
});

function git(cwd: string, ...args: string[]): string {
  const result = Bun.spawnSync(
    ["git", "-c", "user.name=Test", "-c", "user.email=test@example.com", ...args],
    { cwd, stdout: "pipe", stderr: "pipe" },
  );
  if (result.exitCode !== 0) throw new Error(result.stderr.toString());
  return result.stdout.toString();
}

async function repository(): Promise<{ root: string; projectRoot: string; taskId: string }> {
  root = await mkdtemp(join(tmpdir(), "task-git-"));
  const projectRoot = join(root, "repo");
  await mkdir(join(projectRoot, "src"), { recursive: true });
  git(projectRoot, "init", "-q");
  await writeFile(join(projectRoot, "src", "a.txt"), "one\ntwo\n");
  git(projectRoot, "add", "-A");
  git(projectRoot, "commit", "-q", "-m", "initial");
  const context = {
    root: join(projectRoot, "tasks"),
    projectRoot,
    config: { workspace: "tasks", quality: { mode: "off" as const } },
  };
  await mkdir(context.root, { recursive: true });
  const group = await createTaskGroup(context, "Work");
  const task = await createTask(context, { title: "Tracked", group: group.id });
  return { root: context.root, projectRoot, taskId: task.metadata.id };
}

describe("git change tracking", () => {
  test("records only changes made while in progress and excludes the todo folder", async () => {
    const { root: workspace, projectRoot, taskId } = await repository();
    const context = {
      root: workspace,
      projectRoot,
      config: { workspace: "tasks", quality: { mode: "off" as const } },
    };
    await appendFile(join(projectRoot, "src", "a.txt"), "before start\n");
    const before = git(projectRoot, "rev-list", "--count", "HEAD");
    await updateTask(context, taskId, { status: "in-progress", track: true });

    await appendFile(join(projectRoot, "src", "a.txt"), "three\nfour\n");
    await writeFile(join(projectRoot, "src", "b.txt"), "new file\n");
    await writeFile(join(projectRoot, ".env"), "SECRET=1\n");
    const live = await getTaskChanges(
      context,
      findDocument(await readWorkspaceIndex(context), taskId).metadata.extra?.tracking?.segments ??
        [],
    );
    expect(live.available && live.segments[0]?.live).toBe(true);

    await updateTask(context, taskId, { status: "completed" });
    const task = findDocument(await readWorkspaceIndex(context), taskId);
    const segments = task.metadata.extra?.tracking?.segments ?? [];
    expect(segments).toHaveLength(1);
    expect(segments[0]?.end_ref).toStartWith("refs/task/tracking/");
    expect(segments[0]?.summary).toMatchObject({ files: 3 });

    const changes = await getTaskChanges(context, segments);
    if (!changes.available) throw new Error("expected changes");
    expect(changes.files.map((file) => file.path)).toEqual([".env", "src/a.txt", "src/b.txt"]);
    const a = changes.files.find((file) => file.path === "src/a.txt");
    expect(a).toMatchObject({ insertions: 2, deletions: 0, status: "modified" });
    expect(changes.files.find((file) => file.path === ".env")?.denied).toBe(true);
    expect(changes.files.some((file) => file.path.startsWith("tasks/todo"))).toBe(false);
    expect(changes.byDirectory.src?.files).toBe(2);
    expect(changes.byExtension[".txt"]?.files).toBe(2);

    const diff = await getTaskFileDiff(context, segments, 0, "src/a.txt");
    expect(diff.diff).toContain("+three");
    expect(diff.diff).not.toContain("+before start");
    await expect(getTaskFileDiff(context, segments, 0, ".env")).rejects.toThrow("protected");
    await expect(getTaskFileDiff(context, segments, 0, "src/missing.txt")).rejects.toThrow(
      "did not change",
    );

    expect(git(projectRoot, "rev-list", "--count", "HEAD")).toBe(before);
    expect(git(projectRoot, "diff", "--cached", "--name-only")).toBe("");
    expect(git(projectRoot, "for-each-ref", "refs/task/").trim().split("\n")).toHaveLength(2);
  });

  test("a second in-progress window adds a segment", async () => {
    const { root: workspace, projectRoot, taskId } = await repository();
    const context = {
      root: workspace,
      projectRoot,
      config: { workspace: "tasks", quality: { mode: "off" as const } },
    };
    await updateTask(context, taskId, { status: "in-progress", track: true });
    await updateTask(context, taskId, { status: "blocked" });
    await updateTask(context, taskId, { status: "in-progress", track: true });
    const segments =
      findDocument(await readWorkspaceIndex(context), taskId).metadata.extra?.tracking?.segments ??
      [];
    expect(segments).toHaveLength(2);
    expect(segments[0]?.ended_at).toBeDefined();
    expect(segments[1]?.ended_at).toBeUndefined();
  });

  test("tracking requires a git repository and untracked tasks stay untracked", async () => {
    root = await mkdtemp(join(tmpdir(), "task-nogit-"));
    const context = {
      root: join(root, "tasks"),
      projectRoot: root,
      config: { workspace: "tasks", quality: { mode: "off" as const } },
    };
    await mkdir(context.root, { recursive: true });
    const group = await createTaskGroup(context, "Work");
    const task = await createTask(context, { title: "Plain", group: group.id });
    await expect(
      updateTask(context, task.metadata.id, { status: "in-progress", track: true }),
    ).rejects.toThrow("git repository");
    const plain = await updateTask(context, task.metadata.id, { status: "in-progress" });
    expect(plain.task.metadata.extra?.tracking).toBeUndefined();
  });
});
