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
  test("task and tc share workspace operations with machine-readable output", async () => {
    root = await mkdtemp(join(tmpdir(), "task-cli-e2e-"));
    const workspace = join(root, "tasks");
    await mkdir(workspace);
    const overview = await cli(workspace, "--json");
    expect(overview.exitCode).toBe(0);
    expect(JSON.parse(overview.stdout.toString()).tasks).toBe(0);
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
    expect(completion.status).toBe("completed");
    const archived = await cli(workspace, "archive", group.id, "--json");
    expect(JSON.parse(archived.stdout.toString()).path).toMatch(/^todo\/_archived\//);
    const archivedList = await cli(workspace, "list", "--archived", "--json");
    expect(JSON.parse(archivedList.stdout.toString())).toHaveLength(1);
    const restored = await cli(workspace, "restore", group.id, "--json");
    expect(JSON.parse(restored.stdout.toString()).path).toMatch(/^todo\/work\//);
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

  test("quiet mode retains requested results and help while suppressing routine output", async () => {
    root = await mkdtemp(join(tmpdir(), "task-cli-quiet-"));
    const workspace = join(root, "tasks");
    await mkdir(workspace);
    const help = await cli(workspace, "--quiet", "--help");
    expect(help.exitCode).toBe(0);
    expect(help.stdout.toString()).toContain("Usage: task");
    const overview = await cli(workspace, "--quiet");
    expect(overview.exitCode).toBe(0);
    expect(overview.stdout.toString()).toBe("");
    const groupResult = await cli(workspace, "group", "create", "--title", "Quiet group", "--json");
    const group = JSON.parse(groupResult.stdout.toString());
    const taskResult = await cli(
      workspace,
      "create",
      "--title",
      "Visible task",
      "--group",
      group.id,
      "--json",
    );
    const task = JSON.parse(taskResult.stdout.toString());
    const list = await cli(workspace, "--quiet", "list");
    expect(list.stdout.toString()).toContain("Visible task");
    const show = await cli(workspace, "--quiet", "show", task.id);
    expect(show.stdout.toString()).toContain("Visible task");
  });

  test("JSON output stays on stdout and unsupported watch fails", async () => {
    root = await mkdtemp(join(tmpdir(), "task-cli-json-"));
    const workspace = join(root, "tasks");
    await mkdir(workspace);
    const result = await cli(workspace, "--json", "--quiet");
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout.toString())).toMatchObject({ tasks: 0, groups: 0 });
    expect(result.stderr.toString()).toBe("");
    const unsupported = await cli(workspace, "--watch");
    expect(unsupported.exitCode).toBe(1);
    expect(unsupported.stderr.toString()).toContain("Unknown option: --watch");
  });

  test("delete moves items to the temp trash, requires --yes and can be undone", async () => {
    root = await mkdtemp(join(tmpdir(), "task-cli-delete-"));
    const workspace = join(root, "tasks");
    await mkdir(workspace);
    process.env.TASK_TRASH_DIR = join(root, "trash");
    try {
      const group = JSON.parse(
        (await cli(workspace, "group", "create", "--title", "Doomed", "--json")).stdout.toString(),
      );
      const task = JSON.parse(
        (
          await cli(workspace, "create", "--title", "Doomed task", "--group", group.id, "--json")
        ).stdout.toString(),
      );
      const refused = await cli(workspace, "delete", task.id, "--json");
      expect(refused.exitCode).toBe(1);
      expect(refused.stderr.toString() + refused.stdout.toString()).toContain("--yes");
      const deleted = await cli(workspace, "delete", task.id, "--yes", "--json");
      expect(deleted.exitCode).toBe(0);
      const entry = JSON.parse(deleted.stdout.toString());
      expect(entry.trashPath.startsWith(join(root, "trash"))).toBe(true);
      const listed = JSON.parse(
        (await cli(workspace, "trash", "list", "--json")).stdout.toString(),
      );
      expect(listed.map((item: { trashId: string }) => item.trashId)).toEqual([entry.trashId]);
      const blocked = await cli(workspace, "delete", group.id, "--yes", "--json");
      expect(blocked.exitCode).toBe(0);
      const groupEntry = JSON.parse(blocked.stdout.toString());
      expect(groupEntry.kind).toBe("task-group");
      const restored = await cli(workspace, "undelete", groupEntry.trashId, "--json");
      expect(restored.exitCode).toBe(0);
      const missing = await cli(workspace, "undelete", "20200101T000000Z-TSK-000000", "--json");
      expect(missing.exitCode).toBe(1);
    } finally {
      delete process.env.TASK_TRASH_DIR;
    }
  });

  test("start --track records git changes until the task leaves in-progress", async () => {
    root = await mkdtemp(join(tmpdir(), "task-cli-track-"));
    const workspace = join(root, "tasks");
    await mkdir(workspace);
    const git = (...args: string[]) =>
      Bun.spawnSync(["git", "-c", "user.name=T", "-c", "user.email=t@example.com", ...args], {
        cwd: root,
        stdout: "pipe",
        stderr: "pipe",
      });
    git("init", "-q");
    await Bun.write(join(root, "app.txt"), "base\n");
    git("add", "-A");
    git("commit", "-q", "-m", "base");
    const group = JSON.parse(
      (await cli(workspace, "group", "create", "--title", "Track", "--json")).stdout.toString(),
    );
    const task = JSON.parse(
      (
        await cli(workspace, "create", "--title", "Tracked", "--group", group.id, "--json")
      ).stdout.toString(),
    );
    expect((await cli(workspace, "changes", task.id, "--json")).exitCode).toBe(1);
    expect((await cli(workspace, "start", task.id, "--track", "--json")).exitCode).toBe(0);
    await Bun.write(join(root, "app.txt"), "base\nchanged\n");
    await Bun.write(join(root, "added.txt"), "x\n");
    const live = JSON.parse((await cli(workspace, "changes", task.id, "--json")).stdout.toString());
    expect(live.segments[0].live).toBe(true);
    expect(live.totals.files).toBe(2);
    expect(
      (await cli(workspace, "update", task.id, "--status", "completed", "--json")).exitCode,
    ).toBe(0);
    const done = JSON.parse((await cli(workspace, "changes", task.id, "--json")).stdout.toString());
    expect(done.segments[0].live).toBe(false);
    expect(done.files.map((file: { path: string }) => file.path)).toEqual(["added.txt", "app.txt"]);
    const diff = await cli(workspace, "changes", task.id, "--diff", "app.txt");
    expect(diff.stdout.toString()).toContain("+changed");
    const text = await cli(workspace, "changes", task.id);
    expect(text.stdout.toString()).toContain("2 file(s)");
  });

  test("init configures a fresh project and supports a custom workspace", async () => {
    root = await mkdtemp(join(tmpdir(), "task-cli-init-"));
    const project = join(root, "custom-project");
    await mkdir(project);
    const initialized = await Bun.spawnSync(
      ["bun", "run", join(import.meta.dir, "index.ts"), "init", "--workspace", ".tasks", "--json"],
      { cwd: project, stdout: "pipe", stderr: "pipe" },
    );
    expect(initialized.exitCode).toBe(0);
    expect(JSON.parse(initialized.stdout.toString()).workspace).toBe(join(project, ".tasks"));
    const config = await Bun.file(join(project, "task.yaml")).text();
    expect(config).toContain('\nworkspace: ".tasks"\n');
    expect(config).toContain("managed with Task");
    const guide = await Bun.file(join(project, ".tasks", "README.md")).text();
    expect(guide.startsWith("---\n")).toBe(true);
    expect(guide).toContain("type: workspace-guide");
    const agents = await Bun.file(join(project, "AGENTS.md")).text();
    expect(agents).toContain("<!-- BEGIN TASK MANAGED TASK-TOOL -->");
    expect(agents).toContain(".tasks/README.md");
    const overview = await Bun.spawnSync(
      ["bun", "run", join(import.meta.dir, "index.ts"), "--json"],
      { cwd: project, stdout: "pipe", stderr: "pipe" },
    );
    expect(overview.exitCode).toBe(0);
    expect(JSON.parse(overview.stdout.toString()).workspace).toBe(join(project, ".tasks"));
    const repeated = await Bun.spawnSync(
      ["bun", "run", join(import.meta.dir, "index.ts"), "init"],
      { cwd: project, stdout: "pipe", stderr: "pipe" },
    );
    expect(repeated.exitCode).toBe(1);
    expect(repeated.stderr.toString()).toContain("already exists");
    expect(await Bun.file(join(project, "task.yaml")).text()).toBe(config);
    await Bun.write(join(project, "AGENTS.md"), `# Mine\n\n${agents}\n\nKeep this.\n`);
    const refreshed = Bun.spawnSync(
      ["bun", "run", join(import.meta.dir, "index.ts"), "init", "--refresh-docs", "--json"],
      { cwd: project, stdout: "pipe", stderr: "pipe" },
    );
    expect(refreshed.exitCode).toBe(0);
    const refreshedAgents = await Bun.file(join(project, "AGENTS.md")).text();
    expect(refreshedAgents.match(/BEGIN TASK MANAGED TASK-TOOL/g)).toHaveLength(1);
    expect(refreshedAgents).toContain("Keep this.");
    expect(JSON.parse(refreshed.stdout.toString()).documentation.skipped).toContain(
      join(project, ".tasks", "README.md"),
    );
  });

  test("accepts the project root as an explicit workspace", async () => {
    root = await mkdtemp(join(tmpdir(), "task-cli-root-workspace-"));
    const result = await Bun.spawnSync(
      ["bun", "run", join(import.meta.dir, "index.ts"), "--workspace", ".", "--json"],
      { cwd: root, stdout: "pipe", stderr: "pipe" },
    );
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout.toString()).workspace).toBe(root);
  });

  test("requires a TTY for full-screen mode", async () => {
    root = await mkdtemp(join(tmpdir(), "task-cli-fullscreen-"));
    const workspace = join(root, "tasks");
    await mkdir(workspace);
    const result = await cli(workspace, "-f");
    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain("requires an interactive terminal");
  });

  test("project inspection is read-only and setup emits an explicit JSON plan", async () => {
    root = await mkdtemp(join(tmpdir(), "task-cli-setup-"));
    const workspace = join(root, "tasks");
    await mkdir(workspace);
    await Bun.write(join(root, "package.json"), JSON.stringify({ scripts: { test: "bun test" } }));
    const inspection = await cli(workspace, "project", "inspect", "--json");
    expect(inspection.exitCode).toBe(0);
    expect(JSON.parse(inspection.stdout.toString()).facts).toContainEqual({
      key: "manifest",
      value: "package.json",
      evidence: ["package.json"],
    });
    expect(await Bun.file(join(root, "AGENTS.md")).exists()).toBe(false);
    const planResult = await cli(
      workspace,
      "setup",
      "plan",
      "--docs",
      "repository-map",
      "--rules",
      "testing",
      "--agents",
      "codex",
      "--json",
    );
    expect(planResult.exitCode).toBe(0);
    const plan = JSON.parse(planResult.stdout.toString());
    expect(plan.changes.map((change: { path: string }) => change.path)).toContain("AGENTS.md");
    expect(await Bun.file(join(root, "AGENTS.md")).exists()).toBe(false);
    const planPath = join(root, "setup-plan.json");
    await Bun.write(planPath, JSON.stringify(plan));
    const applied = await cli(workspace, "setup", "apply", "--path", planPath, "--json");
    expect(applied.exitCode).toBe(0);
    expect(JSON.parse(applied.stdout.toString()).written).toContain("AGENTS.md");
    expect(await Bun.file(join(root, "AGENTS.md")).exists()).toBe(true);
  });

  test("setup refuses to place generated adapter Markdown inside a project-root workspace", async () => {
    root = await mkdtemp(join(tmpdir(), "task-cli-root-setup-"));
    await Bun.write(join(root, "package.json"), "{}");
    const result = await Bun.spawnSync(
      [
        "bun",
        "run",
        join(import.meta.dir, "index.ts"),
        "setup",
        "plan",
        "--workspace",
        ".",
        "--docs",
        "repository-map",
        "--json",
      ],
      { cwd: root, stdout: "pipe", stderr: "pipe" },
    );
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.toString()).toContain("needs a nested Task workspace");
    expect(await Bun.file(join(root, "README.md")).exists()).toBe(false);
  });
});
