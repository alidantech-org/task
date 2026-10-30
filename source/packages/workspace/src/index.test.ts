import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, symlink, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import {
  buildWorkspaceIndex,
  readWorkspaceDocument,
  reconcileWorkspaceIndex,
  resolveSafeWorkspacePath,
  resolveWorkspacePath,
  watchWorkspaceIndex,
} from "#/index";

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

function markdown(id: string, name: string, type = "task"): string {
  return `---\nid: ${id}\nname: ${name}\ntype: ${type}\ntags:\n  - foundation\nstatus: active\n---\n\n# ${name}\n`;
}

describe("shared workspace index", () => {
  test("discovers nested Markdown summaries and ignores generated directories and symlinks", async () => {
    const workspace = await makeWorkspace();
    await mkdir(join(workspace, "tasks", "docs", "architecture"), { recursive: true });
    await mkdir(join(workspace, "tasks", "node_modules"), { recursive: true });
    await writeFile(join(workspace, "tasks", "one.md"), markdown("TASK-1", "One"));
    await writeFile(
      join(workspace, "tasks", "docs", "architecture", "overview.md"),
      markdown("DOC-1", "Overview", "documentation"),
    );
    await writeFile(
      join(workspace, "tasks", "node_modules", "ignored.md"),
      markdown("X", "Ignored"),
    );
    await symlink(join(workspace, "tasks", "one.md"), join(workspace, "tasks", "linked.md"));

    const index = await buildWorkspaceIndex({ root: workspace });
    expect([...index.documents.keys()]).toEqual([
      "tasks/docs/architecture/overview.md",
      "tasks/one.md",
    ]);
    expect(index.documents.get("tasks/docs/architecture/overview.md")?.metadata.type).toBe(
      "documentation",
    );
    expect(index.documents.get("tasks/docs/architecture/overview.md")?.classification).toBe(
      "document",
    );
    expect(index.documents.get("tasks/one.md")?.classification).toBe("task-record");
    expect(index.documents.get("tasks/one.md")?.metadata.status).toBe("active");
    expect(index.diagnostics).toEqual([]);
  });

  test("keeps malformed and missing frontmatter as diagnostics while indexing valid files", async () => {
    const workspace = await makeWorkspace();
    await writeFile(join(workspace, "tasks", "valid.md"), markdown("TASK-1", "Valid"));
    await writeFile(join(workspace, "tasks", "missing.md"), "# No metadata\n");
    await writeFile(join(workspace, "tasks", "malformed.md"), "---\nid: [broken\n---\n");
    const index = await buildWorkspaceIndex({ root: workspace });
    expect(index.documents.size).toBe(1);
    expect(index.diagnostics.map(({ path }) => path).sort()).toEqual([
      "tasks/malformed.md",
      "tasks/missing.md",
    ]);
  });

  test("requires an existing workspace directory", async () => {
    const workspace = await makeWorkspace();
    await expect(buildWorkspaceIndex({ root: join(workspace, "missing") })).rejects.toThrow();
  });

  test("reconciles additions, changes, removals and edits with restored modification times", async () => {
    const workspace = await makeWorkspace();
    const path = join(workspace, "tasks", "one.md");
    const unchangedPath = join(workspace, "tasks", "unchanged.md");
    await writeFile(path, markdown("TASK-1", "One"));
    await writeFile(unchangedPath, markdown("TASK-2", "Unchanged"));
    const initial = await buildWorkspaceIndex({ root: workspace });
    const oldStat = await Bun.file(path).stat();
    await writeFile(path, markdown("TASK-1", "Two"));
    await utimes(path, oldStat.atime, oldStat.mtime);
    await writeFile(join(workspace, "tasks", "new.md"), markdown("TASK-2", "New"));
    const updated = await reconcileWorkspaceIndex(initial);
    expect(updated.documents.get("tasks/one.md")?.metadata.name).toBe("Two");
    expect(updated.documents.get("tasks/unchanged.md")).toBe(
      initial.documents.get("tasks/unchanged.md"),
    );
    expect(updated.documents.has("tasks/new.md")).toBe(true);
    await rm(path);
    const finalIndex = await reconcileWorkspaceIndex(updated);
    expect(finalIndex.documents.has("tasks/one.md")).toBe(false);
    expect(finalIndex.documents.has("tasks/new.md")).toBe(true);
  });

  test("reads full bodies only on demand and rejects unsafe document paths", async () => {
    const workspace = await makeWorkspace();
    await writeFile(join(workspace, "tasks", "one.md"), markdown("TASK-1", "One"));
    expect(await readWorkspaceDocument({ root: workspace }, "tasks/one.md")).toContain("# One");
    await expect(readWorkspaceDocument({ root: workspace }, "../outside.md")).rejects.toThrow(
      "outside the selected workspace",
    );
  });

  test("watcher reports changes and closes cleanly", async () => {
    const workspace = await makeWorkspace();
    const initial = await buildWorkspaceIndex({ root: workspace });
    const events: string[] = [];
    const watcher = watchWorkspaceIndex(
      { root: workspace },
      initial,
      (event) => events.push(event.type),
      { debounceMs: 20 },
    );
    await writeFile(join(workspace, "tasks", "added.md"), markdown("TASK-1", "Added"));
    await new Promise((resolve) => setTimeout(resolve, 150));
    watcher.close();
    expect(events).toContain("added");
  });

  test("requested reconciliation converges after an external change", async () => {
    const workspace = await makeWorkspace();
    const initial = await buildWorkspaceIndex({ root: workspace });
    const events: string[] = [];
    const watcher = watchWorkspaceIndex({ root: workspace }, initial, (event) =>
      events.push(event.type),
    );
    await writeFile(join(workspace, "tasks", "external.md"), markdown("TASK-1", "External"));
    const reconciled = await watcher.reconcile();
    watcher.close();
    expect(reconciled.documents.has("tasks/external.md")).toBe(true);
    expect(events.some((event) => event === "reset" || event === "added")).toBe(true);
  });

  test("watcher reports invalid metadata and repair transitions", async () => {
    const workspace = await makeWorkspace();
    const initial = await buildWorkspaceIndex({ root: workspace });
    const events: string[] = [];
    const watcher = watchWorkspaceIndex(
      { root: workspace },
      initial,
      (event) => events.push(event.type),
      { debounceMs: 20 },
    );
    const path = join(workspace, "tasks", "draft.md");
    await writeFile(path, "# Draft without frontmatter\n");
    await new Promise((resolve) => setTimeout(resolve, 120));
    await writeFile(path, markdown("TASK-1", "Draft"));
    await new Promise((resolve) => setTimeout(resolve, 120));
    watcher.close();
    expect(events).toContain("invalid");
    expect(events).toContain("repaired");
  });
});
