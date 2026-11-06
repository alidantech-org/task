import { lstat, open, readFile, realpath } from "node:fs/promises";
import { basename, join, relative, sep } from "node:path";
import { hashContent, parseFrontmatter, serializeMarkdown } from "#/indexing/metadata";
import { replaceDocumentBody } from "#/operations/mutate";
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

/**
 * Writes the workspace guide and the managed Task instructions in AGENTS.md. Generated workspace
 * guides can be refreshed; custom guides and all other project README files are left alone.
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
  const guideBody = await renderTemplate("workspace-readme.hbs", data, context);
  const guide = serializeMarkdown(
    {
      id: "TASK-WORKSPACE-README",
      name: "Task workspace guide",
      type: "workspace-guide",
      tags: ["task", "agent-guidance"],
      extra: { generated_by: "task init" },
    },
    guideBody,
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
    const stat = await lstat(guidePath);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new Error(`Workspace guide is not a regular file: ${guidePath}`);
    }
    const current = await readFile(guidePath, "utf8");
    let parsed: ReturnType<typeof parseFrontmatter> | undefined;
    try {
      parsed = parseFrontmatter(current);
    } catch {
      skipped.push(guidePath);
    }
    const extra = parsed?.values.extra;
    const generatedBy =
      typeof extra === "object" && extra !== null && !Array.isArray(extra)
        ? extra.generated_by
        : undefined;
    if (
      parsed?.metadata.id === "TASK-WORKSPACE-README" &&
      parsed.metadata.type === "workspace-guide" &&
      generatedBy === "task init"
    ) {
      if (parsed.body === guideBody) {
        skipped.push(guidePath);
      } else {
        await replaceDocumentBody(
          context,
          "TASK-WORKSPACE-README",
          guideBody,
          hashContent(current),
        );
        written.push(guidePath);
      }
    } else if (parsed) {
      skipped.push(guidePath);
    }
  }

  const block = managedSection(
    "task-tool",
    await renderTemplate("task-tool-guide.hbs", data, context),
  );
  const changes: SetupChange[] = [
    {
      path: "AGENTS.md",
      content: block,
      purpose: "Tell agents and contributors that this project is managed with Task.",
      mode: "managed-section",
    },
  ];
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
