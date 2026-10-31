import { basename, dirname, sep } from "node:path";
import { discoverMarkdown } from "@task/workspace/discovery/scan";
import { readWorkspaceDocument } from "@task/workspace/documents/read";
import { WorkspaceError } from "@task/workspace/errors";
import { buildWorkspaceIndex } from "@task/workspace/indexing/incremental";
import type {
  DocumentSummary,
  TaskGroup,
  TaskPriority,
  TaskStatus,
  WorkspaceContext,
  WorkspaceIndex,
} from "@task/workspace/indexing/types";

export type TaskFilters = {
  status?: TaskStatus;
  priority?: TaskPriority;
  assignee?: string;
  tag?: string;
  project?: string;
  group?: string;
  archived?: boolean;
  limit?: number;
};

export async function readWorkspaceIndex(context: WorkspaceContext): Promise<WorkspaceIndex> {
  return buildWorkspaceIndex(context);
}

export function listDocuments(index: WorkspaceIndex): DocumentSummary[] {
  return [...index.documents.values()].filter((document) => document.metadata.type !== "task");
}

export function getWorkspaceOverview(index: WorkspaceIndex): {
  tasks: number;
  planned: number;
  inProgress: number;
  blocked: number;
  completed: number;
  documents: number;
  diagnostics: number;
  recent: DocumentSummary[];
} {
  const tasks = listTasks(index, { archived: false });
  const completed = listTasks(index, { archived: false, status: "completed" });
  return {
    tasks: tasks.length,
    planned: tasks.filter((task) => task.metadata.status === "planned").length,
    inProgress: tasks.filter((task) => task.metadata.status === "in-progress").length,
    blocked: tasks.filter((task) => task.metadata.status === "blocked").length,
    completed: completed.length,
    documents: listDocuments(index).length,
    diagnostics: index.diagnostics.length,
    recent: [...index.documents.values()]
      .sort((left, right) => right.modifiedAt - left.modifiedAt)
      .slice(0, 8),
  };
}

export function listTasks(index: WorkspaceIndex, filters: TaskFilters = {}): DocumentSummary[] {
  const tasks = [...index.documents.values()].filter(
    (document) => document.metadata.type === "task",
  );
  const filtered = tasks.filter((task) => {
    const archived =
      task.path.startsWith(`todo${sep}_archived${sep}`) ||
      task.path.startsWith("todo/_archived/") ||
      task.path.startsWith(`todo${sep}_archive${sep}`) ||
      task.path.startsWith("todo/_archive/");
    if (filters.archived !== undefined && archived !== filters.archived) return false;
    const completedStorage =
      task.path.startsWith(`todo${sep}_completed${sep}`) ||
      task.path.startsWith("todo/_completed/");
    if (completedStorage && filters.status !== "completed") return false;
    if (filters.status && task.metadata.status !== filters.status) return false;
    if (filters.priority && task.metadata.priority !== filters.priority) return false;
    if (
      filters.assignee &&
      task.metadata.assignee?.toLowerCase() !== filters.assignee.toLowerCase()
    )
      return false;
    if (
      filters.tag &&
      !task.metadata.tags.some((tag) => tag.toLowerCase() === filters.tag?.toLowerCase())
    )
      return false;
    if (filters.project && task.metadata.project?.toLowerCase() !== filters.project.toLowerCase())
      return false;
    if (filters.group) {
      const groupDocument = [...index.documents.values()].find(
        (document) =>
          document.metadata.id === filters.group && document.metadata.id.startsWith("GRP-"),
      );
      const taskGroupPath = dirname(task.path);
      const groupPath = groupDocument ? dirname(groupDocument.path) : undefined;
      const folderName = basename(taskGroupPath);
      const groupSlug =
        task.path.startsWith("todo/_archived/") ||
        task.path.startsWith("todo/_archive/") ||
        task.path.startsWith("todo/_completed/")
          ? folderName.replace(/^\d{4}-\d{2}-\d{2}-/, "")
          : folderName;
      if (
        groupPath !== taskGroupPath &&
        filters.group !== taskGroupPath &&
        filters.group !== groupSlug
      )
        return false;
    }
    return true;
  });
  return filtered.slice(0, filters.limit);
}

export function findDocument(index: WorkspaceIndex, identifier: string): DocumentSummary {
  const byId = [...index.documents.values()].filter(
    (document) => document.metadata.id === identifier,
  );
  if (byId.length > 1)
    throw new WorkspaceError("validation_failed", `Duplicate document ID: ${identifier}`);
  if (byId[0]) return byId[0];
  const byPath = index.documents.get(identifier);
  if (byPath) return byPath;
  throw new WorkspaceError("not_found", `No document found for ${identifier}`);
}

export async function getDocument(
  context: WorkspaceContext,
  identifier: string,
): Promise<{
  summary: DocumentSummary;
  body: string;
}> {
  const index = await readWorkspaceIndex(context);
  const summary = findDocument(index, identifier);
  return { summary, body: await readWorkspaceDocument(context, summary.path) };
}

export async function searchWorkspace(
  context: WorkspaceContext,
  query: string,
  options: { in?: "tasks" | "docs" | "all"; type?: "task" | "document"; limit?: number } = {},
): Promise<Array<{ summary: DocumentSummary; snippet: string }>> {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) throw new WorkspaceError("invalid_input", "Search query cannot be empty");
  const index = await readWorkspaceIndex(context);
  const matches: Array<{ summary: DocumentSummary; snippet: string }> = [];
  for (const summary of index.documents.values()) {
    const isTask = summary.metadata.type === "task";
    if (options.in === "tasks" && !isTask) continue;
    if (options.in === "docs" && isTask) continue;
    if (options.type === "task" && !isTask) continue;
    if (options.type === "document" && isTask) continue;
    const body = await readWorkspaceDocument(context, summary.path);
    const haystack = `${JSON.stringify(summary.metadata)}\n${body}`;
    const matchIndex = haystack.toLocaleLowerCase().indexOf(needle);
    if (matchIndex < 0) continue;
    const start = Math.max(0, matchIndex - 45);
    matches.push({
      summary,
      snippet: haystack
        .slice(start, Math.min(haystack.length, matchIndex + needle.length + 90))
        .replaceAll("\n", " ")
        .trim(),
    });
  }
  matches.sort((left, right) => left.summary.path.localeCompare(right.summary.path));
  return matches.slice(0, options.limit);
}

export async function listTaskGroups(context: WorkspaceContext): Promise<TaskGroup[]> {
  const index = await readWorkspaceIndex(context);
  const plans = [...index.documents.values()].filter(
    (document) => document.metadata.id.startsWith("GRP-") && basename(document.path) === "plan.md",
  );
  return plans.map((plan) => {
    const archived =
      plan.path.startsWith(`todo${sep}_archived${sep}`) ||
      plan.path.startsWith("todo/_archived/") ||
      plan.path.startsWith(`todo${sep}_archive${sep}`) ||
      plan.path.startsWith("todo/_archive/");
    const finished =
      plan.path.startsWith(`todo${sep}_completed${sep}`) ||
      plan.path.startsWith("todo/_completed/");
    const groupPath = dirname(plan.path);
    const last = basename(groupPath);
    const slug = archived || finished ? last.replace(/^\d{4}-\d{2}-\d{2}-/, "") : last;
    const tasks = [...index.documents.values()].filter(
      (document) => document.metadata.type === "task" && dirname(document.path) === groupPath,
    );
    return {
      id: plan.metadata.id,
      name: plan.metadata.name,
      slug,
      path: groupPath,
      archived,
      finished,
      total: tasks.length,
      completed: tasks.filter((task) => task.metadata.status === "completed").length,
    };
  });
}

export async function findGroup(context: WorkspaceContext, identifier: string): Promise<TaskGroup> {
  const matches = (await listTaskGroups(context)).filter(
    (group) => group.id === identifier || group.slug === identifier || group.path === identifier,
  );
  if (matches.length > 1)
    throw new WorkspaceError(
      "invalid_input",
      `Group name is ambiguous: ${identifier}; use its group ID`,
    );
  if (!matches[0]) throw new WorkspaceError("not_found", `No task group found for ${identifier}`);
  return matches[0];
}

export async function listWorkspaceTree(context: WorkspaceContext): Promise<string[]> {
  return discoverMarkdown(context.root);
}
