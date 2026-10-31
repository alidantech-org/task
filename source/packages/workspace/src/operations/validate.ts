import { access } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { readWorkspaceDocument } from "@task/workspace/documents/read";
import { buildWorkspaceIndex } from "@task/workspace/indexing/incremental";
import type {
  ValidationCategory,
  ValidationDiagnostic,
  WorkspaceContext,
} from "@task/workspace/indexing/types";

export type ValidationScope = "all" | "tasks" | "docs" | "links" | "references";

function within(root: string, candidate: string): boolean {
  const path = relativePath(root, candidate);
  return path === "" || (!isAbsolute(path) && path !== ".." && !path.startsWith(`..${sep}`));
}

function relativePath(root: string, candidate: string): string {
  return relative(root, candidate);
}

function push(
  diagnostics: ValidationDiagnostic[],
  path: string,
  message: string,
  category: ValidationCategory,
): void {
  diagnostics.push({ path, message, category });
}

export async function validateWorkspace(
  context: WorkspaceContext,
  scope: ValidationScope = "all",
): Promise<ValidationDiagnostic[]> {
  const index = await buildWorkspaceIndex(context);
  const diagnostics: ValidationDiagnostic[] = [...index.diagnostics];
  const documents = [...index.documents.values()];
  const byId = new Map<string, typeof documents>();
  for (const document of documents) {
    const records = byId.get(document.metadata.id) ?? [];
    records.push(document);
    byId.set(document.metadata.id, records);
  }
  for (const [id, records] of byId) {
    if (records.length > 1) {
      for (const record of records)
        push(diagnostics, record.path, `Duplicate document ID: ${id}`, "identity");
    }
  }

  const tasks = documents.filter((document) => document.metadata.type === "task");
  const taskIds = new Map(tasks.map((task) => [task.metadata.id, task]));
  for (const task of tasks) {
    for (const dependency of task.metadata.depends_on ?? []) {
      if (!taskIds.has(dependency)) {
        push(diagnostics, task.path, `Unknown dependency task ID: ${dependency}`, "reference");
      }
    }
  }
  const visitState = new Map<string, "visiting" | "visited">();
  const visit = (taskId: string, stack: string[]): void => {
    const state = visitState.get(taskId);
    if (state === "visited") return;
    if (state === "visiting") {
      const cycle = [...stack.slice(stack.indexOf(taskId)), taskId].join(" → ");
      const task = taskIds.get(taskId);
      if (task) push(diagnostics, task.path, `Dependency cycle: ${cycle}`, "dependency");
      return;
    }
    visitState.set(taskId, "visiting");
    for (const dependency of taskIds.get(taskId)?.metadata.depends_on ?? []) {
      if (taskIds.has(dependency)) visit(dependency, [...stack, taskId]);
    }
    visitState.set(taskId, "visited");
  };
  for (const taskId of taskIds.keys()) visit(taskId, []);

  const groups = new Map<string, typeof tasks>();
  for (const task of tasks) {
    const groupPath = dirname(task.path);
    const records = groups.get(groupPath) ?? [];
    records.push(task);
    groups.set(groupPath, records);
    if (!/^(todo|archive)\//.test(task.path)) {
      push(
        diagnostics,
        task.path,
        "Task records must be inside a todo or archive work group",
        "group",
      );
    }
    if (!/^(todo|archive)\/.*\/\d{3,}-[a-z0-9-]+\.md$/i.test(task.path)) {
      push(
        diagnostics,
        task.path,
        "Task filenames must use a numeric sequence and title slug",
        "group",
      );
    }
  }
  for (const document of documents) {
    if (document.metadata.id.startsWith("GRP-") && !document.path.endsWith("/plan.md")) {
      push(diagnostics, document.path, "Work-group metadata must be stored in plan.md", "group");
    }
  }
  for (const [groupPath, groupTasks] of groups) {
    const plan = index.documents.get(`${groupPath}/plan.md`);
    if (!plan?.metadata.id.startsWith("GRP-")) {
      for (const task of groupTasks)
        push(
          diagnostics,
          task.path,
          "Task group must have a plan.md with a GRP- group ID",
          "group",
        );
    }
    if (
      groupPath.startsWith("todo/") &&
      groupTasks.length > 0 &&
      groupTasks.every((task) => task.metadata.status === "completed")
    ) {
      push(
        diagnostics,
        groupPath,
        "All tasks are completed; archive this group with task archive",
        "group",
      );
    }
  }

  const projectRoot = resolve(context.projectRoot ?? dirname(index.root));
  const workspaceRoot = resolve(index.root);
  for (const document of documents.filter((record) => record.metadata.type !== "task")) {
    const body = await readWorkspaceDocument(context, document.path);
    const links = body.matchAll(/!?\[[^\]]*\]\(([^)\s]+)(?:\s+[^)]*)?\)/g);
    for (const match of links) {
      const rawTarget = match[1].split(/[?#]/, 1)[0];
      if (!rawTarget || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(rawTarget)) continue;
      let target: string;
      try {
        target = resolve(
          dirname(resolve(workspaceRoot, document.path)),
          decodeURIComponent(rawTarget),
        );
      } catch {
        push(diagnostics, document.path, `Malformed Markdown link: ${rawTarget}`, "link");
        continue;
      }
      if (!within(projectRoot, target)) {
        push(diagnostics, document.path, `Markdown link escapes the project: ${rawTarget}`, "path");
        continue;
      }
      try {
        await access(target);
      } catch {
        push(diagnostics, document.path, `Broken Markdown link: ${rawTarget}`, "link");
      }
    }
  }

  if (scope === "all") return diagnostics;
  if (scope === "tasks")
    return diagnostics.filter((diagnostic) => {
      const document = index.documents.get(diagnostic.path);
      return (
        diagnostic.category !== "link" &&
        (document?.metadata.type === "task" ||
          diagnostic.category === "group" ||
          diagnostic.category === "dependency" ||
          diagnostic.category === "reference")
      );
    });
  if (scope === "docs")
    return diagnostics.filter((diagnostic) => {
      const document = index.documents.get(diagnostic.path);
      return (
        document?.metadata.type !== "task" &&
        diagnostic.category !== "dependency" &&
        diagnostic.category !== "reference"
      );
    });
  if (scope === "links")
    return diagnostics.filter(
      (diagnostic) => diagnostic.category === "link" || diagnostic.category === "path",
    );
  return diagnostics.filter(
    (diagnostic) => diagnostic.category === "reference" || diagnostic.category === "dependency",
  );
}
