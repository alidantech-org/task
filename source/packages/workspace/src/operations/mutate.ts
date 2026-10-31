import { randomBytes, randomUUID } from "node:crypto";
import { lstat, mkdir, open, readdir, rename, rm, rmdir, unlink } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { WorkspaceError } from "@task/workspace/errors";
import { buildWorkspaceIndex } from "@task/workspace/indexing/incremental";
import { parseFrontmatter, serializeMarkdown } from "@task/workspace/indexing/metadata";
import type {
  DocumentCreateInput,
  DocumentSummary,
  TaskCreateInput,
  TaskGroup,
  TaskUpdateInput,
  WorkspaceContext,
} from "@task/workspace/indexing/types";
import { findDocument, findGroup, listTaskGroups } from "@task/workspace/operations/query";
import { resolveSafeWorkspacePath } from "@task/workspace/paths/safe-path";

function id(prefix: "TSK" | "GRP" | "DOC"): string {
  return `${prefix}-${randomBytes(6).toString("hex").toUpperCase()}`;
}

function slugify(value: string): string {
  const slug = value
    .normalize("NFKD")
    .toLocaleLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) throw new WorkspaceError("invalid_input", "Name must contain letters or numbers");
  return slug;
}

function errorCode(error: unknown): string | undefined {
  return error instanceof Error && "code" in error && typeof error.code === "string"
    ? error.code
    : undefined;
}

async function createFile(context: WorkspaceContext, path: string, content: string): Promise<void> {
  const absolute = await resolveSafeWorkspacePath(context.root, path);
  await mkdir(dirname(absolute), { recursive: true });
  await resolveSafeWorkspacePath(context.root, path);
  let created = false;
  try {
    const file = await open(absolute, "wx", 0o600);
    created = true;
    try {
      await file.writeFile(content, "utf8");
      await file.sync();
    } finally {
      await file.close();
    }
  } catch (error) {
    if (created) await unlink(absolute).catch(() => undefined);
    if (errorCode(error) === "EEXIST") {
      throw new WorkspaceError("already_exists", `File already exists: ${path}`, { cause: error });
    }
    throw error;
  }
}

async function replaceFile(
  context: WorkspaceContext,
  path: string,
  content: string,
  expectedHash: string,
): Promise<void> {
  const absolute = await resolveSafeWorkspacePath(context.root, path);
  const stat = await lstat(absolute);
  if (!stat.isFile()) throw new WorkspaceError("path_not_safe", `Not a regular file: ${path}`);
  const current = await Bun.file(absolute).text();
  const hash = new Bun.CryptoHasher("sha256").update(current).digest("hex");
  if (hash !== expectedHash)
    throw new WorkspaceError("conflict", `File changed while you were editing: ${path}`);
  const temporaryPath = `${absolute}.task-${randomUUID()}.tmp`;
  await resolveSafeWorkspacePath(
    context.root,
    temporaryPath.slice(resolve(context.root).length + 1),
  );
  try {
    const temporary = await open(temporaryPath, "wx", 0o600);
    try {
      await temporary.writeFile(content, "utf8");
      await temporary.sync();
    } finally {
      await temporary.close();
    }
    await resolveSafeWorkspacePath(context.root, path);
    await rename(temporaryPath, absolute);
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

function taskBody(title: string, description?: string): string {
  return `# ${title}\n${description?.trim() ? `\n${description.trim()}\n` : "\n"}`;
}

async function validateDependencies(
  context: WorkspaceContext,
  currentId: string | undefined,
  dependencies: readonly string[],
): Promise<void> {
  const index = await buildWorkspaceIndex(context);
  const tasks = new Map(
    [...index.documents.values()]
      .filter((document) => document.metadata.type === "task")
      .map((document) => [document.metadata.id, document]),
  );
  for (const dependency of dependencies) {
    if (dependency === currentId)
      throw new WorkspaceError("validation_failed", "A task cannot depend on itself");
    if (!tasks.has(dependency))
      throw new WorkspaceError("validation_failed", `Unknown dependency task ID: ${dependency}`);
  }
  if (!currentId) return;
  const graph = new Map(
    [...tasks].map(([taskId, document]) => [taskId, [...(document.metadata.depends_on ?? [])]]),
  );
  graph.set(currentId, [...dependencies]);
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (taskId: string): boolean => {
    if (visiting.has(taskId)) return false;
    if (visited.has(taskId)) return true;
    visiting.add(taskId);
    for (const child of graph.get(taskId) ?? []) if (!visit(child)) return false;
    visiting.delete(taskId);
    visited.add(taskId);
    return true;
  };
  for (const taskId of graph.keys()) {
    if (!visit(taskId))
      throw new WorkspaceError("validation_failed", "Task dependencies cannot contain cycles");
  }
}

export async function createTaskGroup(context: WorkspaceContext, name: string): Promise<TaskGroup> {
  const cleanName = name.trim();
  if (!cleanName) throw new WorkspaceError("invalid_input", "Group name is required");
  const slug = slugify(cleanName);
  const relativePath = `todo/${slug}`;
  const groupPath = await resolveSafeWorkspacePath(context.root, relativePath);
  await mkdir(dirname(groupPath), { recursive: true });
  try {
    await mkdir(groupPath);
  } catch (error) {
    if (errorCode(error) === "EEXIST")
      throw new WorkspaceError("already_exists", `Task group already exists: ${slug}`);
    throw error;
  }
  const groupId = id("GRP");
  const plan = {
    id: groupId,
    name: cleanName,
    type: "documentation",
  };
  try {
    await createFile(
      context,
      `${relativePath}/plan.md`,
      serializeMarkdown(plan, `# ${cleanName}\n\n## Goal\n\n## Scope\n\n## Notes\n`),
    );
  } catch (error) {
    await rm(join(groupPath, "plan.md"), { force: true });
    await rmdir(groupPath).catch(() => undefined);
    throw error;
  }
  return {
    id: groupId,
    name: cleanName,
    slug,
    path: relativePath,
    archived: false,
    total: 0,
    completed: 0,
  };
}

async function activeGroup(context: WorkspaceContext, identifier: string): Promise<TaskGroup> {
  const group = await findGroup(context, identifier);
  if (group.archived)
    throw new WorkspaceError("invalid_input", "Cannot add or update tasks in an archived group");
  return group;
}

export async function createTask(
  context: WorkspaceContext,
  input: TaskCreateInput,
): Promise<DocumentSummary> {
  const title = input.title.trim();
  if (!title) throw new WorkspaceError("invalid_input", "Task title is required");
  const group = await activeGroup(context, input.group);
  const taskId = id("TSK");
  const dependencies = input.dependsOn ?? [];
  await validateDependencies(context, undefined, dependencies);
  const directory = resolve(context.root, group.path);
  const entries = await readdir(directory, { withFileTypes: true });
  const numbers = entries
    .map((entry) => /^(\d+)-.*\.md$/i.exec(entry.name))
    .filter((match) => match !== null)
    .map((match) => Number(match[1]));
  let sequence = Math.max(0, ...numbers) + 1;
  const fileSlug = slugify(title);
  const createdAt = new Date().toISOString();
  const values: Record<string, unknown> = {
    id: taskId,
    name: title,
    type: "task",
    status: input.status ?? "planned",
    priority: input.priority ?? "medium",
    created_at: createdAt,
    updated_at: createdAt,
    ...(input.tags?.length ? { tags: [...input.tags] } : {}),
    ...(input.assignee ? { assignee: input.assignee } : {}),
    ...(input.project ? { project: input.project } : {}),
    ...(input.dueAt ? { due_at: input.dueAt } : {}),
    ...(dependencies.length ? { depends_on: [...dependencies] } : {}),
    ...(input.extra ? { extra: { ...input.extra } } : {}),
  };
  while (true) {
    const filename = `${String(sequence).padStart(3, "0")}-${fileSlug}.md`;
    const path = `${group.path}/${filename}`;
    try {
      await createFile(
        context,
        path,
        serializeMarkdown(values, taskBody(title, input.description)),
      );
      const index = await buildWorkspaceIndex(context);
      const summary = index.documents.get(path);
      if (!summary)
        throw new WorkspaceError(
          "validation_failed",
          `Created task failed workspace validation: ${path}`,
        );
      return summary;
    } catch (error) {
      if (error instanceof WorkspaceError && error.code === "already_exists") {
        sequence += 1;
        continue;
      }
      throw error;
    }
  }
}

export async function updateTask(
  context: WorkspaceContext,
  identifier: string,
  input: TaskUpdateInput,
): Promise<{ task: DocumentSummary; archivedGroup?: TaskGroup }> {
  const index = await buildWorkspaceIndex(context);
  const task = findDocument(index, identifier);
  if (task.metadata.type !== "task")
    throw new WorkspaceError("invalid_input", `${identifier} is not a task`);
  if (task.path.startsWith("archive/"))
    throw new WorkspaceError(
      "invalid_input",
      "Restore the archived group before updating its tasks",
    );
  const path = await resolveSafeWorkspacePath(context.root, task.path);
  const content = await Bun.file(path).text();
  const parsed = parseFrontmatter(content);
  const values = { ...parsed.values };
  if (input.title !== undefined) {
    const title = input.title.trim();
    if (!title) throw new WorkspaceError("invalid_input", "Task title cannot be empty");
    values.name = title;
  }
  if (input.status !== undefined) values.status = input.status;
  if (input.priority !== undefined) values.priority = input.priority;
  if (input.assignee !== undefined) values.assignee = input.assignee;
  if (input.project !== undefined) values.project = input.project;
  if (input.dueAt !== undefined) values.due_at = input.dueAt;
  if (input.tags !== undefined) values.tags = [...input.tags];
  if (input.dependsOn !== undefined) {
    await validateDependencies(context, task.metadata.id, input.dependsOn);
    values.depends_on = [...input.dependsOn];
  }
  if (input.extra !== undefined) values.extra = { ...input.extra };
  values.updated_at = new Date().toISOString();
  const next = serializeMarkdown(values, parsed.body);
  await replaceFile(context, task.path, next, task.contentHash);
  const updatedIndex = await buildWorkspaceIndex(context);
  let updatedTask = findDocument(updatedIndex, task.metadata.id);
  let archivedGroup: TaskGroup | undefined;
  if (updatedTask.metadata.status === "completed") {
    const groupPath = dirname(updatedTask.path);
    const group = (await listTaskGroups(context)).find(
      (candidate) => candidate.path === groupPath && !candidate.archived,
    );
    const groupTasks = [...updatedIndex.documents.values()].filter(
      (document) => document.metadata.type === "task" && dirname(document.path) === groupPath,
    );
    if (
      group &&
      groupTasks.length > 0 &&
      groupTasks.every((record) => record.metadata.status === "completed")
    ) {
      try {
        archivedGroup = await archiveGroup(context, group.id, true);
        updatedTask = findDocument(await buildWorkspaceIndex(context), task.metadata.id);
      } catch (error) {
        throw new WorkspaceError(
          "filesystem_error",
          `Task status was saved, but its group could not be archived. Retry with 'task archive ${group.slug}'.`,
          { cause: error },
        );
      }
    }
  }
  return { task: updatedTask, ...(archivedGroup ? { archivedGroup } : {}) };
}

export async function replaceDocumentBody(
  context: WorkspaceContext,
  identifier: string,
  body: string,
  expectedHash: string,
): Promise<DocumentSummary> {
  const index = await buildWorkspaceIndex(context);
  const document = findDocument(index, identifier);
  const path = await resolveSafeWorkspacePath(context.root, document.path);
  const current = await Bun.file(path).text();
  const parsed = parseFrontmatter(current);
  await replaceFile(context, document.path, serializeMarkdown(parsed.values, body), expectedHash);
  return findDocument(await buildWorkspaceIndex(context), identifier);
}

export async function createDocument(
  context: WorkspaceContext,
  input: DocumentCreateInput,
): Promise<DocumentSummary> {
  if (!input.path.toLowerCase().endsWith(".md"))
    throw new WorkspaceError("invalid_input", "Document path must end in .md");
  const title = input.title.trim();
  if (!title) throw new WorkspaceError("invalid_input", "Document title is required");
  const values: Record<string, unknown> = {
    id: id("DOC"),
    name: title,
    type: "documentation",
    ...(input.tags?.length ? { tags: [...input.tags] } : {}),
    ...(input.extra ? { extra: { ...input.extra } } : {}),
  };
  await createFile(context, input.path, serializeMarkdown(values, input.body ?? `# ${title}\n`));
  return findDocument(await buildWorkspaceIndex(context), input.path);
}

export async function archiveGroup(
  context: WorkspaceContext,
  identifier: string,
  requireComplete = true,
): Promise<TaskGroup> {
  const group = await findGroup(context, identifier);
  if (group.archived) throw new WorkspaceError("invalid_input", "Task group is already archived");
  if (group.total === 0 || (requireComplete && group.completed !== group.total)) {
    throw new WorkspaceError(
      "validation_failed",
      "Only non-empty groups with all tasks completed can be archived",
    );
  }
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const destination = `archive/${day.slice(0, 4)}/${day.slice(5, 7)}/${day}-${group.slug}`;
  const sourcePath = await resolveSafeWorkspacePath(context.root, group.path);
  const destinationPath = await resolveSafeWorkspacePath(context.root, destination);
  await mkdir(dirname(destinationPath), { recursive: true });
  await resolveSafeWorkspacePath(context.root, destination);
  try {
    await lstat(destinationPath);
    throw new WorkspaceError(
      "already_exists",
      `Archive destination already exists: ${destination}`,
    );
  } catch (error) {
    if (error instanceof WorkspaceError) throw error;
    if (errorCode(error) !== "ENOENT") throw error;
  }
  await rename(sourcePath, destinationPath);
  return { ...group, path: destination, archived: true };
}

export async function restoreGroup(
  context: WorkspaceContext,
  identifier: string,
): Promise<TaskGroup> {
  const group = await findGroup(context, identifier);
  if (!group.archived) throw new WorkspaceError("invalid_input", "Task group is not archived");
  const destination = `todo/${group.slug}`;
  const sourcePath = await resolveSafeWorkspacePath(context.root, group.path);
  const destinationPath = await resolveSafeWorkspacePath(context.root, destination);
  await mkdir(dirname(destinationPath), { recursive: true });
  await resolveSafeWorkspacePath(context.root, destination);
  try {
    await lstat(destinationPath);
    throw new WorkspaceError("already_exists", `An active group already exists at ${destination}`);
  } catch (error) {
    if (error instanceof WorkspaceError) throw error;
    if (errorCode(error) !== "ENOENT") throw error;
  }
  await rename(sourcePath, destinationPath);
  return { ...group, path: destination, archived: false };
}

export async function archiveTaskGroup(
  context: WorkspaceContext,
  identifier: string,
): Promise<TaskGroup> {
  return archiveGroup(context, identifier, true);
}

export async function restoreTaskGroup(
  context: WorkspaceContext,
  identifier: string,
): Promise<TaskGroup> {
  const group = (await listTaskGroups(context)).find((entry) => entry.id === identifier);
  if (!group) throw new WorkspaceError("not_found", `No task group found for ${identifier}`);
  return restoreGroup(context, group.id);
}
