import { lstat, open, realpath } from "node:fs/promises";
import { basename, join, relative, resolve, sep } from "node:path";
import { serializeMarkdown } from "@task/workspace/indexing/metadata";
import type { QualityConfig } from "@task/workspace/indexing/types";
import { resolveQuality } from "@task/workspace/operations/quality";
import {
  applyProjectSetupPlan,
  managedSection,
  type ProjectSetupPlan,
  renderTemplate,
  type SetupChange,
} from "@task/workspace/project/setup";

export type SelfDocumentationResult = {
  written: string[];
  skipped: string[];
};

async function exists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

/**
 * Writes the workspace guide and the managed "how Task works" blocks that tell agents and
 * contributors the project is managed with Task. Existing files are never replaced: the workspace
 * guide is created only when missing and project files are changed only inside their TASK-TOOL block.
 */
export async function writeSelfDocumentation(options: {
  projectRoot: string;
  workspaceRoot: string;
  quality?: QualityConfig;
}): Promise<SelfDocumentationResult> {
  const projectRoot = await realpath(options.projectRoot);
  const workspaceRoot = await realpath(options.workspaceRoot);
  const workspacePath = relative(projectRoot, workspaceRoot).split(sep).join("/") || ".";
  const data = { projectName: basename(projectRoot), workspacePath };
  const context = { root: workspaceRoot, projectRoot };
  const written: string[] = [];
  const skipped: string[] = [];

  const guidePath = join(workspaceRoot, "README.md");
  const guide = serializeMarkdown(
    {
      id: "TASK-WORKSPACE-README",
      name: "Task workspace guide",
      type: "workspace-guide",
      tags: ["task", "agent-guidance"],
      extra: { generated_by: "task init" },
    },
    await renderTemplate("workspace-readme.hbs", data, context),
  );
  try {
    const file = await open(guidePath, "wx", 0o644);
    try {
      await file.writeFile(guide, "utf8");
    } finally {
      await file.close();
    }
    written.push(guidePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    skipped.push(guidePath);
  }

  const block = managedSection(
    "task-tool",
    await renderTemplate("task-tool-guide.hbs", data, context),
  );
  const changes: SetupChange[] = [];
  for (const [path, always] of [
    ["AGENTS.md", true],
    ["CLAUDE.md", false],
    ["README.md", false],
  ] as const) {
    if (!always && !(await exists(resolve(projectRoot, path)))) continue;
    changes.push({
      path,
      content: block,
      purpose: "Tell agents and contributors that this project is managed with Task.",
      mode: "managed-section",
    });
  }
  const quality = resolveQuality({ workspace: workspacePath, quality: options.quality });
  changes.push({
    path: "rules/task-writing.md",
    content: serializeMarkdown(
      {
        id: "RULE-TASK-WRITING",
        name: "Task writing standard",
        type: "rule",
        tags: ["task", "agent-guidance"],
        extra: { generated_by: "task init" },
      },
      await renderTemplate("task-writing-rule.hbs", { ...data, ...quality }, context),
    ),
    purpose: "Teach agents how to write detailed tasks and group documents.",
    mode: "create",
  });
  const plan: ProjectSetupPlan = {
    schemaVersion: 1,
    projectRoot,
    workspaceRoot,
    inspection: { schemaVersion: 1, projectRoot, facts: [], findings: [] },
    selection: {},
    changes,
  };
  const applied = await applyProjectSetupPlan(plan);
  written.push(...applied.written);
  skipped.push(...applied.conflicts);
  return { written, skipped };
}
