import { afterEach, describe, expect, test } from "bun:test";
import { appendFile, mkdir, mkdtemp, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getTaskChanges, getTaskFileDiff, snapshotLimits, startTracking } from "#/git/tracking";
import type { WorkspaceContext } from "#/indexing/types";
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

async function project(options: { git: boolean; tracking?: boolean }) {
  root = await mkdtemp(join(tmpdir(), "task-track-"));
  const projectRoot = join(root, "repo");
  await mkdir(join(projectRoot, "src"), { recursive: true });
  await writeFile(join(projectRoot, "src", "a.txt"), "one\ntwo\n");
  if (options.git) {
    git(projectRoot, "init", "-q");
    git(projectRoot, "add", "-A");
    git(projectRoot, "commit", "-q", "-m", "initial");
  }
  const context: WorkspaceContext = {
    root: join(projectRoot, "tasks"),
    projectRoot,
    config: {
      workspace: "tasks",
      quality: { mode: "off" },
      ...(options.tracking === false ? { tracking: { enabled: false } } : {}),
    },
  };
  await mkdir(context.root, { recursive: true });
  const group = await createTaskGroup(context, "Work");
  const task = await createTask(context, { title: "Tracked", group: group.id });
  return { context, projectRoot, taskId: task.metadata.id };
}

async function segmentsOf(context: WorkspaceContext, taskId: string) {
  return (
    findDocument(await readWorkspaceIndex(context), taskId).metadata.extra?.tracking?.segments ?? []
  );
}

describe("automatic change tracking in the private store", () => {
  test("starts on entering in-progress, records only changes made since, and never touches the project's .git", async () => {
    const { context, projectRoot, taskId } = await project({ git: true });
    await appendFile(join(projectRoot, "src", "a.txt"), "before start\n");
    const objects = git(projectRoot, "count-objects", "-v");
    const commits = git(projectRoot, "rev-list", "--count", "HEAD");
    await updateTask(context, taskId, { status: "in-progress" });
    expect((await segmentsOf(context, taskId))[0]?.base_ref).toStartWith("refs/tracking/");

    await appendFile(join(projectRoot, "src", "a.txt"), "three\nfour\n");
    await writeFile(join(projectRoot, "src", "b.txt"), "new file\n");
    await writeFile(join(projectRoot, ".env"), "SECRET=1\n");
    const live = await getTaskChanges(context, await segmentsOf(context, taskId));
    expect(live.available && live.segments[0]?.live).toBe(true);

    await updateTask(context, taskId, { status: "completed" });
    const segments = await segmentsOf(context, taskId);
    expect(segments).toHaveLength(1);
    expect(segments[0]?.end_ref).toStartWith("refs/tracking/");
    expect(segments[0]?.summary).toMatchObject({ files: 3 });

    const changes = await getTaskChanges(context, segments);
    if (!changes.available) throw new Error("expected changes");
    expect(changes.files.map((file) => file.path)).toEqual([".env", "src/a.txt", "src/b.txt"]);
    expect(changes.files.find((file) => file.path === "src/a.txt")).toMatchObject({
      insertions: 2,
      deletions: 0,
      status: "modified",
    });
    expect(changes.files.find((file) => file.path === ".env")?.denied).toBe(true);
    expect(changes.files.some((file) => file.path.startsWith("tasks/todo"))).toBe(false);
    expect(changes.byDirectory.src?.files).toBe(2);

    const diff = await getTaskFileDiff(context, segments, 0, "src/a.txt");
    expect(diff.diff).toContain("+three");
    expect(diff.diff).not.toContain("+before start");
    await expect(getTaskFileDiff(context, segments, 0, ".env")).rejects.toThrow("protected");
    await expect(getTaskFileDiff(context, segments, 0, "src/missing.txt")).rejects.toThrow(
      "did not change",
    );

    expect(git(projectRoot, "count-objects", "-v")).toBe(objects);
    expect(git(projectRoot, "rev-list", "--count", "HEAD")).toBe(commits);
    expect(git(projectRoot, "diff", "--cached", "--name-only")).toBe("");
    expect(git(projectRoot, "for-each-ref")).not.toContain("refs/task");
  });

  test("works in a project without git, honours .gitignore and stores data outside the project", async () => {
    const { context, projectRoot, taskId } = await project({ git: false });
    await writeFile(join(projectRoot, ".gitignore"), "secret-build/\n");
    await updateTask(context, taskId, { status: "in-progress" });
    await mkdir(join(projectRoot, "secret-build"));
    await writeFile(join(projectRoot, "secret-build", "out.js"), "ignored\n");
    await mkdir(join(projectRoot, "node_modules", "pkg"), { recursive: true });
    await writeFile(join(projectRoot, "node_modules", "pkg", "index.js"), "vendor\n");
    await writeFile(join(projectRoot, "src", "new.txt"), "hello\n");
    await updateTask(context, taskId, { status: "blocked" });
    const changes = await getTaskChanges(context, await segmentsOf(context, taskId));
    if (!changes.available) throw new Error("expected changes");
    expect(changes.files.map((file) => file.path)).toEqual(["src/new.txt"]);
    expect(Bun.spawnSync(["ls", "-A", projectRoot]).stdout.toString()).not.toContain(".git\n");
    const projects = join(process.env.TASK_DATA_DIR ?? "", "projects");
    expect((await stat(projects)).mode & 0o777).toBe(0o700);
  });

  test("a second in-progress window adds a segment", async () => {
    const { context, taskId } = await project({ git: false });
    await updateTask(context, taskId, { status: "in-progress" });
    await updateTask(context, taskId, { status: "blocked" });
    await updateTask(context, taskId, { status: "in-progress" });
    const segments = await segmentsOf(context, taskId);
    expect(segments).toHaveLength(2);
    expect(segments[0]?.ended_at).toBeDefined();
    expect(segments[1]?.ended_at).toBeUndefined();
  });

  test("tracking can be disabled in task.yaml settings", async () => {
    const { context, taskId } = await project({ git: false, tracking: false });
    const result = await updateTask(context, taskId, { status: "in-progress" });
    expect(result.task.metadata.extra?.tracking).toBeUndefined();
  });

  test("large files are skipped and the segment is marked truncated", async () => {
    const { context, projectRoot, taskId } = await project({ git: false });
    const previous = snapshotLimits.maxFileBytes;
    snapshotLimits.maxFileBytes = 10;
    try {
      await writeFile(join(projectRoot, "big.bin"), "x".repeat(100));
      await updateTask(context, taskId, { status: "in-progress" });
      expect((await segmentsOf(context, taskId))[0]?.truncated).toBe(true);
    } finally {
      snapshotLimits.maxFileBytes = previous;
    }
  });

  test("segments recorded under the old project-ref scheme stay readable", async () => {
    const { context, projectRoot } = await project({ git: true });
    const base = git(projectRoot, "rev-parse", "HEAD").trim();
    await appendFile(join(projectRoot, "src", "a.txt"), "legacy\n");
    git(projectRoot, "commit", "-q", "-am", "legacy change");
    const end = git(projectRoot, "rev-parse", "HEAD").trim();
    git(projectRoot, "update-ref", "refs/task/tracking/T/1-start", base);
    git(projectRoot, "update-ref", "refs/task/tracking/T/1-end", end);
    const changes = await getTaskChanges(context, [
      {
        base_ref: "refs/task/tracking/T/1-start",
        end_ref: "refs/task/tracking/T/1-end",
        started_at: "2026-11-01T00:00:00.000Z",
        ended_at: "2026-11-01T01:00:00.000Z",
      },
    ]);
    if (!changes.available) throw new Error("expected changes");
    expect(changes.files.map((file) => file.path)).toEqual(["src/a.txt"]);
  });

  test("refuses a tracking store whose directory is a symlink", async () => {
    const { context, taskId } = await project({ git: false });
    const previous = process.env.TASK_DATA_DIR;
    const data = join(root, "data");
    const elsewhere = join(root, "elsewhere");
    await mkdir(data, { recursive: true });
    await mkdir(elsewhere);
    await symlink(elsewhere, join(data, "projects"));
    process.env.TASK_DATA_DIR = data;
    try {
      await expect(startTracking(context, taskId)).rejects.toThrow("plain directory");
      const result = await updateTask(context, taskId, { status: "in-progress" });
      expect(result.warnings?.[0]).toContain("unavailable");
      expect(result.task.metadata.status).toBe("in-progress");
    } finally {
      process.env.TASK_DATA_DIR = previous;
    }
  });
});
