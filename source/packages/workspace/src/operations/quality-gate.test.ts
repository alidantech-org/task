import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveWorkspace, updateWorkspaceOrganization } from "#/config/resolve";
import type { WorkspaceContext } from "#/indexing/types";
import { createTask, createTaskGroup, replaceDocumentBody, updateTask } from "#/operations/mutate";
import { findDocument, listTaskGroups, readWorkspaceIndex } from "#/operations/query";
import { isErrorDiagnostic, validateWorkspace } from "#/operations/validate";

let root = "";
afterEach(async () => {
  if (root) await rm(root, { recursive: true, force: true });
  root = "";
});

const prose = (count: number) =>
  Array.from({ length: count }, (_, index) => `detail${index}`).join(" ");
const detailedTask = [
  "# Importer",
  "",
  "## Goal",
  prose(110),
  "",
  "## Context",
  prose(40),
  "",
  "## Acceptance checklist",
  "- [ ] Parse the input format completely",
  "- [ ] Report every invalid row clearly",
  "- [ ] Document usage and add tests",
].join("\n");
const detailedGroupDoc = (title: string) => `# ${title}\n\n## Details\n${prose(120)}\n`;

async function workspace(mode: "reject" | "warn" | "off" | undefined) {
  root = await mkdtemp(join(tmpdir(), "task-quality-"));
  const context: WorkspaceContext = {
    root: join(root, "tasks"),
    projectRoot: root,
    ...(mode ? { config: { workspace: "tasks", quality: { mode } } } : {}),
  };
  await mkdir(context.root, { recursive: true });
  const group = await createTaskGroup(context, "Import work");
  const task = await createTask(context, { title: "Importer", group: group.id });
  return { context, group, task };
}

async function fill(context: WorkspaceContext, groupPath: string, taskId: string) {
  const index = await readWorkspaceIndex(context);
  for (const [id, body] of [
    [`GOAL-${findDocument(index, `${groupPath}/plan.md`).metadata.id}`, detailedGroupDoc("Goal")],
    [findDocument(index, `${groupPath}/plan.md`).metadata.id, detailedGroupDoc("Plan")],
    [taskId, detailedTask],
  ] as const) {
    const current = findDocument(await readWorkspaceIndex(context), id);
    await replaceDocumentBody(context, id, body, current.contentHash);
  }
}

describe("content-quality gate", () => {
  test("creating a group writes goal.md and plan.md and exposes the goal id", async () => {
    const { context, group } = await workspace("reject");
    const index = await readWorkspaceIndex(context);
    expect(index.documents.has(`${group.path}/goal.md`)).toBe(true);
    expect(index.documents.has(`${group.path}/plan.md`)).toBe(true);
    expect((await listTaskGroups(context))[0]?.goalId).toBe(`GOAL-${group.id}`);
  });

  test("rejects starting a scaffold-only task and explains every problem", async () => {
    const { context, task } = await workspace(undefined);
    const error = await updateTask(context, task.metadata.id, { status: "in-progress" }).then(
      () => undefined,
      (reason: unknown) => reason as Error,
    );
    expect(error?.message).toContain("not detailed enough");
    expect(error?.message).toContain("words");
    expect(error?.message).toContain("goal.md");
    expect(error?.message).toContain("task edit");
    const unchanged = findDocument(await readWorkspaceIndex(context), task.metadata.id);
    expect(unchanged.metadata.status).toBe("planned");
  });

  test("allows progress once the task and its group documents are detailed", async () => {
    const { context, group, task } = await workspace("reject");
    await fill(context, group.path, task.metadata.id);
    const result = await updateTask(context, task.metadata.id, { status: "in-progress" });
    expect(result.task.metadata.status).toBe("in-progress");
    expect(result.warnings).toBeUndefined();
  });

  test("warn mode proceeds with warnings and off mode is silent", async () => {
    const warn = await workspace("warn");
    const warned = await updateTask(warn.context, warn.task.metadata.id, { status: "in-progress" });
    expect(warned.task.metadata.status).toBe("in-progress");
    expect(warned.warnings?.length).toBeGreaterThan(0);
    await rm(root, { recursive: true, force: true });
    const off = await workspace("off");
    const quiet = await updateTask(off.context, off.task.metadata.id, { status: "completed" });
    expect(quiet.warnings).toBeUndefined();
  });

  test("validate reports weak work as errors in reject mode and warnings in warn mode", async () => {
    const { context } = await workspace("reject");
    const errors = (await validateWorkspace(context)).filter((item) => item.category === "quality");
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.every(isErrorDiagnostic)).toBe(true);
    const warn = { ...context, config: { workspace: "tasks", quality: { mode: "warn" as const } } };
    const warnings = (await validateWorkspace(warn)).filter((item) => item.category === "quality");
    expect(warnings.every((item) => item.severity === "warning")).toBe(true);
  });

  test("completed tasks are exempt from quality findings", async () => {
    const { context } = await workspace("off");
    const group = (await listTaskGroups(context))[0];
    const task = await createTask(context, {
      title: "Done already",
      group: group?.id ?? "",
      status: "completed",
    });
    const diagnostics = await validateWorkspace({
      ...context,
      config: { workspace: "tasks", quality: { mode: "reject" } },
    });
    expect(diagnostics.some((item) => item.path === task.path)).toBe(false);
  });

  test("task.yaml quality settings parse, validate and survive settings updates", async () => {
    root = await mkdtemp(join(tmpdir(), "task-quality-config-"));
    await mkdir(join(root, "tasks"));
    await writeFile(
      join(root, "task.yaml"),
      'workspace: "tasks"\nquality:\n  mode: warn\n  minTaskWords: 40\ntracking:\n  enabled: false\n',
    );
    const resolved = await resolveWorkspace({ cwd: root });
    expect(resolved.config.quality).toEqual({ mode: "warn", minTaskWords: 40 });
    expect(resolved.config.tracking).toEqual({ enabled: false });
    await updateWorkspaceOrganization(resolved, { weekStart: 2 });
    const text = await readFile(join(root, "task.yaml"), "utf8");
    expect(text).toContain("mode: warn");
    expect(text).toContain("enabled: false");
    await writeFile(join(root, "task.yaml"), 'workspace: "tasks"\nquality:\n  mode: strict\n');
    await expect(resolveWorkspace({ cwd: root })).rejects.toThrow("quality.mode");
  });
});
