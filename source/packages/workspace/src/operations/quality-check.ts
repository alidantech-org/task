import { readWorkspaceDocument } from "@task/workspace/documents/read";
import { buildWorkspaceIndex } from "@task/workspace/indexing/incremental";
import { parseFrontmatter } from "@task/workspace/indexing/metadata";
import type {
  DocumentSummary,
  TaskGroup,
  ValidationDiagnostic,
  WorkspaceContext,
} from "@task/workspace/indexing/types";
import {
  assessGroupDocBody,
  assessTaskBody,
  type QualityFinding,
  type ResolvedQuality,
  resolveQuality,
} from "@task/workspace/operations/quality";
import { listTaskGroups } from "@task/workspace/operations/query";

async function bodyOf(context: WorkspaceContext, path: string): Promise<string> {
  return parseFrontmatter(await readWorkspaceDocument(context, path)).body;
}

/** Findings for a group's goal.md and plan.md; finished and archived groups are exempt. */
export async function groupQualityFindings(
  context: WorkspaceContext,
  group: TaskGroup,
  quality: ResolvedQuality = resolveQuality(context.config),
): Promise<QualityFinding[]> {
  if (group.archived || group.finished) return [];
  const index = await buildWorkspaceIndex(context);
  const findings: QualityFinding[] = [];
  for (const [file, missing] of [
    ["goal.md", "missing_goal_doc"],
    ["plan.md", "missing_plan_doc"],
  ] as const) {
    const path = `${group.path}/${file}`;
    if (!index.documents.has(path)) {
      findings.push({
        code: missing,
        message: `The group "${group.name}" needs ${file}: write its ${file === "goal.md" ? "goal and success criteria" : "plan, milestones and risks"}.`,
      });
      continue;
    }
    findings.push(
      ...assessGroupDocBody(await bodyOf(context, path), quality, `${group.name}/${file}`),
    );
  }
  return findings;
}

/** Findings that must be resolved before a planned task can start: its own body plus its group's documents. */
export async function taskQualityFindings(
  context: WorkspaceContext,
  task: DocumentSummary,
  body: string,
  quality: ResolvedQuality = resolveQuality(context.config),
): Promise<QualityFinding[]> {
  const findings = assessTaskBody(body, quality);
  const directory = task.path.slice(0, Math.max(0, task.path.lastIndexOf("/")));
  const group = (await listTaskGroups(context)).find((candidate) => candidate.path === directory);
  if (group) findings.push(...(await groupQualityFindings(context, group, quality)));
  return findings;
}

/** Diagnostics for `task validate`: weak planned/in-progress tasks and weak group documents. */
export async function qualityDiagnostics(
  context: WorkspaceContext,
): Promise<ValidationDiagnostic[]> {
  const quality = resolveQuality(context.config);
  if (quality.mode === "off") return [];
  const severity = quality.mode === "reject" ? "error" : "warning";
  const index = await buildWorkspaceIndex(context);
  const diagnostics: ValidationDiagnostic[] = [];
  for (const task of index.documents.values()) {
    const status = task.metadata.status;
    if (task.metadata.type !== "task" || status === "completed" || status === "archived") continue;
    if (/(^|\/)_(completed|archived?)\//.test(task.path)) continue;
    for (const finding of assessTaskBody(await bodyOf(context, task.path), quality))
      diagnostics.push({
        path: task.path,
        message: finding.message,
        category: "quality",
        severity,
      });
  }
  for (const group of await listTaskGroups(context))
    for (const finding of await groupQualityFindings(context, group, quality))
      diagnostics.push({
        path: group.path,
        message: finding.message,
        category: "quality",
        severity,
      });
  return diagnostics;
}
