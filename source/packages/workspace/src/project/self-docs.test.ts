import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildWorkspaceIndex } from "#/indexing/incremental";
import { writeSelfDocumentation } from "#/project/self-docs";
import { applyProjectSetupPlan, createProjectSetupPlan } from "#/project/setup";

let root = "";
afterEach(async () => {
  if (root) await rm(root, { recursive: true, force: true });
  root = "";
});

async function fixture(): Promise<{ projectRoot: string; workspaceRoot: string }> {
  root = await mkdtemp(join(tmpdir(), "task-self-docs-"));
  const projectRoot = join(root, "repo");
  const workspaceRoot = join(projectRoot, "tasks");
  await mkdir(workspaceRoot, { recursive: true });
  return { projectRoot, workspaceRoot };
}

describe("self documentation", () => {
  test("creates a valid workspace guide and an AGENTS.md block, leaving optional files alone", async () => {
    const { projectRoot, workspaceRoot } = await fixture();
    const result = await writeSelfDocumentation({ projectRoot, workspaceRoot });
    expect(result.written).toContain(join(workspaceRoot, "README.md"));
    expect(result.written).toContain("AGENTS.md");
    expect(await Bun.file(join(projectRoot, "CLAUDE.md")).exists()).toBe(false);
    expect(await Bun.file(join(projectRoot, "README.md")).exists()).toBe(false);
    const index = await buildWorkspaceIndex({ root: workspaceRoot, projectRoot });
    expect(index.diagnostics).toEqual([]);
    expect([...index.documents.values()].map((document) => document.metadata.id)).toContain(
      "TASK-WORKSPACE-README",
    );
  });

  test("is idempotent, preserves surrounding text and updates only its own block", async () => {
    const { projectRoot, workspaceRoot } = await fixture();
    await writeFile(join(projectRoot, "AGENTS.md"), "# Mine\n\nKeep this.\n");
    await writeFile(join(projectRoot, "README.md"), "# Repo\n");
    await writeSelfDocumentation({ projectRoot, workspaceRoot });
    await writeFile(join(workspaceRoot, "README.md"), "custom guide\n");
    const second = await writeSelfDocumentation({ projectRoot, workspaceRoot });
    expect(second.skipped).toContain(join(workspaceRoot, "README.md"));
    expect(await readFile(join(workspaceRoot, "README.md"), "utf8")).toBe("custom guide\n");
    const agents = await readFile(join(projectRoot, "AGENTS.md"), "utf8");
    expect(agents.startsWith("# Mine\n\nKeep this.\n")).toBe(true);
    expect(agents.match(/BEGIN TASK MANAGED TASK-TOOL/g)).toHaveLength(1);
    expect(await readFile(join(projectRoot, "README.md"), "utf8")).toContain(
      "BEGIN TASK MANAGED TASK-TOOL",
    );
  });

  test("coexists with blocks written by task setup", async () => {
    const { projectRoot, workspaceRoot } = await fixture();
    await writeFile(join(projectRoot, "package.json"), JSON.stringify({ scripts: {} }));
    const context = { root: workspaceRoot, projectRoot };
    const selection = { agents: ["codex"], documentation: [] };
    await applyProjectSetupPlan(await createProjectSetupPlan(context, selection));
    await writeSelfDocumentation({ projectRoot, workspaceRoot });
    await applyProjectSetupPlan(await createProjectSetupPlan(context, selection));
    const agents = await readFile(join(projectRoot, "AGENTS.md"), "utf8");
    expect(agents.match(/BEGIN TASK MANAGED AGENTS\.MD/g)).toHaveLength(1);
    expect(agents.match(/BEGIN TASK MANAGED TASK-TOOL/g)).toHaveLength(1);
  });

  test("refuses to write through a symlinked AGENTS.md", async () => {
    const { projectRoot, workspaceRoot } = await fixture();
    const outside = join(root, "outside.md");
    await writeFile(outside, "outside\n");
    await symlink(outside, join(projectRoot, "AGENTS.md"));
    await expect(writeSelfDocumentation({ projectRoot, workspaceRoot })).rejects.toThrow(
      "not a regular file",
    );
    expect(await readFile(outside, "utf8")).toBe("outside\n");
  });
});
