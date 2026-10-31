import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildWorkspaceIndex } from "#/indexing/incremental";
import { applyProjectSetupPlan, createProjectSetupPlan, inspectProject } from "#/project/setup";

let root = "";
afterEach(async () => {
  if (root) await rm(root, { recursive: true, force: true });
  root = "";
});

async function fixture(): Promise<{ projectRoot: string; workspaceRoot: string }> {
  root = await mkdtemp(join(tmpdir(), "task-project-setup-"));
  const projectRoot = join(root, "repo");
  const workspaceRoot = join(projectRoot, "tasks");
  await mkdir(workspaceRoot, { recursive: true });
  await writeFile(
    join(projectRoot, "package.json"),
    JSON.stringify({ scripts: { test: "bun test" }, devDependencies: { next: "*" } }),
  );
  await writeFile(join(projectRoot, ".gitignore"), "ignored.txt\ngenerated/**\n");
  await writeFile(join(projectRoot, "ignored.txt"), "skip");
  await mkdir(join(projectRoot, "generated"));
  await writeFile(join(projectRoot, "generated", "source.ts"), "skip");
  await mkdir(join(projectRoot, "src"));
  await writeFile(join(projectRoot, "src", "index.ts"), "not executed");
  await writeFile(join(projectRoot, "src", ".gitignore"), "*.local.ts\n");
  await writeFile(join(projectRoot, "src", "secret.local.ts"), "skip");
  return { projectRoot, workspaceRoot };
}

describe("project inspection and guided setup", () => {
  test("inspects static facts and skips ignored files without executing project code", async () => {
    const { projectRoot } = await fixture();
    const inspection = await inspectProject(projectRoot);
    expect(inspection.facts).toContainEqual({
      key: "framework",
      value: "Next.js",
      evidence: ["package.json"],
    });
    expect(inspection.facts.some((fact) => fact.key === "tests")).toBe(false);
    expect(inspection.facts.some((fact) => fact.evidence.includes("ignored.txt"))).toBe(false);
    expect(inspection.facts.some((fact) => fact.evidence.includes("src/secret.local.ts"))).toBe(
      false,
    );
    expect(await readFile(join(projectRoot, "src/index.ts"), "utf8")).toBe("not executed");
  });

  test("plans native agent formats and managed Task documents without writing", async () => {
    const { projectRoot, workspaceRoot } = await fixture();
    const plan = await createProjectSetupPlan(
      { root: workspaceRoot, projectRoot },
      {
        documentation: ["project-overview"],
        rules: ["testing", "git"],
        agents: ["codex", "claude", "copilot", "cursor", "skill"],
      },
    );
    expect(
      plan.changes.some(
        (change) => change.path === "rules/testing.md" && change.content.startsWith("---\n"),
      ),
    ).toBe(true);
    expect(
      plan.changes.some(
        (change) => change.path.endsWith(".mdc") && change.content.includes("alwaysApply: false"),
      ),
    ).toBe(true);
    expect(
      plan.changes.find((change) => change.path.endsWith(".mdc"))?.content.startsWith("---\n"),
    ).toBe(true);
    expect(
      plan.changes.some(
        (change) =>
          change.path.endsWith("SKILL.md") && change.content.includes("name: project-guide"),
      ),
    ).toBe(true);
    expect(await Bun.file(join(projectRoot, "AGENTS.md")).exists()).toBe(false);
  });

  test("applies reviewed plans preserving README and existing agent text, then reruns idempotently", async () => {
    const { projectRoot, workspaceRoot } = await fixture();
    await writeFile(join(projectRoot, "README.md"), "# Keep this\n");
    await writeFile(join(projectRoot, "AGENTS.md"), "# User section\n");
    const context = { root: workspaceRoot, projectRoot };
    const plan = await createProjectSetupPlan(context, {
      documentation: ["project-overview"],
      agents: ["codex"],
    });
    await Bun.write(
      join(projectRoot, "README.md"),
      "# Keep this\n\nUser edit after plan generation.\n",
    );
    expect((await applyProjectSetupPlan(plan)).conflicts).toEqual([]);
    const readme = await readFile(join(projectRoot, "README.md"), "utf8");
    expect(readme).toContain("# Keep this");
    expect(readme).toContain("User edit after plan generation.");
    expect(readme).toContain("BEGIN TASK MANAGED LINKS");
    const agents = await readFile(join(projectRoot, "AGENTS.md"), "utf8");
    expect(agents).toContain("# User section");
    expect(agents).toContain("BEGIN TASK MANAGED");
    const index = await buildWorkspaceIndex(context);
    expect(index.diagnostics).toEqual([]);
    expect([...index.documents.values()].map((document) => document.metadata.type)).toContain(
      "agent-profile",
    );
    expect((await applyProjectSetupPlan(plan)).conflicts).toEqual([
      "docs/project-overview.md",
      "agents/project-guide.md",
    ]);
    expect(
      (await readFile(join(projectRoot, "AGENTS.md"), "utf8")).match(/BEGIN TASK MANAGED/g),
    ).toHaveLength(1);
  });

  test("rejects symlinked output directories", async () => {
    const { projectRoot, workspaceRoot } = await fixture();
    const outside = join(root, "outside");
    await mkdir(outside);
    await symlink(outside, join(projectRoot, ".github"), "dir");
    const plan = await createProjectSetupPlan(
      { root: workspaceRoot, projectRoot },
      { agents: ["copilot"] },
    );
    await expect(applyProjectSetupPlan(plan)).rejects.toMatchObject({ code: "path_not_safe" });
  });
});
