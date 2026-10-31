import { randomBytes, randomUUID } from "node:crypto";
import { lstat, mkdir, open, readdir, rename, rm, rmdir, unlink } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { WorkspaceError } from "@task/workspace/errors";
import { buildWorkspaceIndex } from "@task/workspace/indexing/incremental";
import { parseFrontmatter, serializeMarkdown } from "@task/workspace/indexing/metadata";
import type {
  DocumentCreateInput,
  DocumentSummary,
  TaskCreateInput,
  TaskGroup,
  TaskStatus,
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
  const parentPath = dirname(absolute);
  const parentStat = await lstat(parentPath);
  if (!parentStat.isDirectory() || parentStat.isSymbolicLink()) {
    throw new WorkspaceError("path_not_safe", `Task parent is not a safe directory: ${path}`);
  }
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
    const currentParent = await lstat(parentPath);
    const currentTarget = await lstat(absolute);
    if (
      currentParent.dev !== parentStat.dev ||
      currentParent.ino !== parentStat.ino ||
      currentParent.isSymbolicLink()
    ) {
      throw new WorkspaceError(
        "conflict",
        `Task directory changed while you were editing: ${path}`,
      );
    }
    if (
      !currentTarget.isFile() ||
      currentTarget.dev !== stat.dev ||
      currentTarget.ino !== stat.ino
    ) {
      throw new WorkspaceError(
        "conflict",
        `Task file was replaced while you were editing: ${path}`,
      );
    }
    const latest = await Bun.file(absolute).text();
    if (new Bun.CryptoHasher("sha256").update(latest).digest("hex") !== expectedHash) {
      throw new WorkspaceError("conflict", `File changed while you were editing: ${path}`);
    }
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
  if (group.finished)
    throw new WorkspaceError("invalid_input", "Completed groups cannot accept new tasks");
  return group;
}

export async function createTask(
  context: WorkspaceContext,
  input: TaskCreateInput,
): Promise<DocumentSummary> {
  const title = input.title.trim();
  if (!title) throw new WorkspaceError("invalid_input", "Task title is required");
  if (input.extra && "status_history" in input.extra) {
    throw new WorkspaceError("invalid_input", "Task status history is managed automatically");
  }
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
    ...(input.startAt ? { start_at: input.startAt } : {}),
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
  expectedHash?: string,
): Promise<{ task: DocumentSummary; completedGroup?: TaskGroup }> {
  let index = await buildWorkspaceIndex(context);
  let task = findDocument(index, identifier);
  if (task.metadata.type !== "task")
    throw new WorkspaceError("invalid_input", `${identifier} is not a task`);
  if (task.path.startsWith("todo/_archived/") || task.path.startsWith("todo/_archive/"))
    throw new WorkspaceError(
      "invalid_input",
      "Restore the archived task or group before updating it",
    );
  if (
    task.path.startsWith("todo/_completed/") &&
    input.status !== undefined &&
    input.status !== "completed"
  ) {
    const group = (await listTaskGroups(context)).find(
      (candidate) => candidate.path === dirname(task.path) && candidate.finished,
    );
    if (!group) throw new WorkspaceError("not_found", "Completed task group was not found");
    await reopenCompletedGroup(context, group.id);
    index = await buildWorkspaceIndex(context);
    task = findDocument(index, identifier);
  }
  if (expectedHash !== undefined && task.contentHash !== expectedHash) {
    throw new WorkspaceError("conflict", `Task changed since it was loaded: ${task.path}`);
  }
  const path = await resolveSafeWorkspacePath(context.root, task.path);
  const content = await Bun.file(path).text();
  const parsed = parseFrontmatter(content);
  const values = { ...parsed.values };
  const previousStatus = (values.status ?? "planned") as TaskStatus;
  if (input.title !== undefined) {
    const title = input.title.trim();
    if (!title) throw new WorkspaceError("invalid_input", "Task title cannot be empty");
    values.name = title;
  }
  if (input.status !== undefined) values.status = input.status;
  if (input.priority !== undefined) values.priority = input.priority;
  if (input.assignee !== undefined) values.assignee = input.assignee;
  if (input.project !== undefined) values.project = input.project;
  if (input.startAt !== undefined) values.start_at = input.startAt;
  if (input.dueAt !== undefined) values.due_at = input.dueAt;
  if (input.tags !== undefined) values.tags = [...input.tags];
  if (input.dependsOn !== undefined) {
    await validateDependencies(context, task.metadata.id, input.dependsOn);
    values.depends_on = [...input.dependsOn];
  }
  const updatedAt = new Date().toISOString();
  const existingExtra =
    typeof values.extra === "object" && values.extra !== null && !Array.isArray(values.extra)
      ? (values.extra as Record<string, unknown>)
      : {};
  const incomingExtra = input.extra ?? {};
  if ("status_history" in incomingExtra) {
    throw new WorkspaceError("invalid_input", "Task status history is managed automatically");
  }
  const nextExtra: Record<string, unknown> = { ...existingExtra, ...incomingExtra };
  if (input.hiddenFromRecent !== undefined) {
    nextExtra.hidden_from_recent = input.hiddenFromRecent;
  }
  if (input.status !== undefined && input.status !== previousStatus) {
    const history = Array.isArray(existingExtra.status_history) ? existingExtra.status_history : [];
    nextExtra.status_history = [
      ...history,
      { from: previousStatus, to: input.status, at: updatedAt },
    ];
  }
  if (Object.keys(nextExtra).length > 0) values.extra = nextExtra;
  values.updated_at = updatedAt;
  const next = serializeMarkdown(values, parsed.body);
  try {
    parseFrontmatter(next);
  } catch (error) {
    throw new WorkspaceError(
      "validation_failed",
      error instanceof Error ? error.message : "Invalid task metadata",
      { cause: error },
    );
  }
  await replaceFile(context, task.path, next, task.contentHash);
  const updatedIndex = await buildWorkspaceIndex(context);
  let updatedTask = findDocument(updatedIndex, task.metadata.id);
  let completedGroup: TaskGroup | undefined;
  if (updatedTask.metadata.status === "completed") {
    const groupPath = dirname(updatedTask.path);
    const group = (await listTaskGroups(context)).find(
      (candidate) => candidate.path === groupPath && !candidate.archived && !candidate.finished,
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
        completedGroup = await completeGroup(context, group.id);
        updatedTask = findDocument(await buildWorkspaceIndex(context), task.metadata.id);
      } catch (error) {
        throw new WorkspaceError(
          "filesystem_error",
          `Task status was saved, but its group could not move to completed. Retry the update after checking 'task validate'.`,
          { cause: error },
        );
      }
    }
  }
  return { task: updatedTask, ...(completedGroup ? { completedGroup } : {}) };
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
  requireComplete = false,
): Promise<TaskGroup> {
  const group = await findGroup(context, identifier);
  if (group.archived) throw new WorkspaceError("invalid_input", "Task group is already archived");
  if (group.total === 0 || (requireComplete && group.completed !== group.total)) {
    throw new WorkspaceError("validation_failed", "Only non-empty groups can be archived");
  }
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const archivedAt = now.toISOString();
  const destination = datedGroupPath("_archived", day, group.slug);
  const index = await buildWorkspaceIndex(context);
  for (const task of index.documents.values()) {
    if (task.metadata.type !== "task" || !task.path.startsWith(`${group.path}/`)) continue;
    const path = await resolveSafeWorkspacePath(context.root, task.path);
    const parsed = parseFrontmatter(await Bun.file(path).text());
    parsed.values.archived_at = archivedAt;
    await replaceFile(
      context,
      task.path,
      serializeMarkdown(parsed.values, parsed.body),
      task.contentHash,
    );
  }
  await moveDirectory(context, group.path, destination);
  return { ...group, path: destination, archived: true, finished: false };
}

function datedGroupPath(folder: "_completed" | "_archived", day: string, slug: string): string {
  return `todo/${folder}/${day.slice(0, 4)}/${day.slice(5, 7)}/${day}-${slug}`;
}

async function moveDirectory(
  context: WorkspaceContext,
  source: string,
  destination: string,
): Promise<void> {
  const sourcePath = await resolveSafeWorkspacePath(context.root, source);
  const destinationPath = await resolveSafeWorkspacePath(context.root, destination);
  await mkdir(dirname(destinationPath), { recursive: true });
  await resolveSafeWorkspacePath(context.root, destination);
  try {
    await lstat(destinationPath);
    throw new WorkspaceError("already_exists", `Destination already exists: ${destination}`);
  } catch (error) {
    if (error instanceof WorkspaceError) throw error;
    if (errorCode(error) !== "ENOENT") throw error;
  }
  await rename(sourcePath, destinationPath);
}

export async function completeGroup(
  context: WorkspaceContext,
  identifier: string,
): Promise<TaskGroup> {
  const group = await findGroup(context, identifier);
  if (group.archived || group.finished)
    throw new WorkspaceError("invalid_input", "Only active groups can be completed");
  if (group.total === 0 || group.completed !== group.total) {
    throw new WorkspaceError("validation_failed", "Every task must be completed first");
  }
  const day = new Date().toISOString().slice(0, 10);
  const destination = datedGroupPath("_completed", day, group.slug);
  await moveDirectory(context, group.path, destination);
  return { ...group, path: destination, finished: true };
}

async function reopenCompletedGroup(
  context: WorkspaceContext,
  identifier: string,
): Promise<TaskGroup> {
  const group = await findGroup(context, identifier);
  if (!group.finished)
    throw new WorkspaceError("invalid_input", "Task group is not in completed storage");
  const destination = `todo/${group.slug}`;
  await moveDirectory(context, group.path, destination);
  return { ...group, path: destination, finished: false };
}

export async function restoreGroup(
  context: WorkspaceContext,
  identifier: string,
): Promise<TaskGroup> {
  const group = await findGroup(context, identifier);
  if (!group.archived) throw new WorkspaceError("invalid_input", "Task group is not archived");
  const index = await buildWorkspaceIndex(context);
  const tasks = [...index.documents.values()].filter(
    (task) => task.metadata.type === "task" && task.path.startsWith(`${group.path}/`),
  );
  const finished = tasks.length > 0 && tasks.every((task) => task.metadata.status === "completed");
  const archivedDay = basename(group.path).match(/^(\d{4}-\d{2}-\d{2})-/)?.[1];
  const restoreDay = archivedDay ?? new Date().toISOString().slice(0, 10);
  const destination = finished
    ? datedGroupPath("_completed", restoreDay, group.slug)
    : `todo/${group.slug}`;
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
  for (const task of index.documents.values()) {
    if (task.metadata.type !== "task" || !task.path.startsWith(`${group.path}/`)) continue;
    const path = await resolveSafeWorkspacePath(context.root, task.path);
    const parsed = parseFrontmatter(await Bun.file(path).text());
    delete parsed.values.archived_at;
    await replaceFile(
      context,
      task.path,
      serializeMarkdown(parsed.values, parsed.body),
      task.contentHash,
    );
  }
  await rename(sourcePath, destinationPath);
  return { ...group, path: destination, archived: false, finished };
}

export async function archiveTaskGroup(
  context: WorkspaceContext,
  identifier: string,
): Promise<TaskGroup> {
  return archiveGroup(context, identifier, false);
}

export async function archiveTask(
  context: WorkspaceContext,
  identifier: string,
  expectedHash?: string,
): Promise<DocumentSummary> {
  const task = findDocument(await buildWorkspaceIndex(context), identifier);
  if (task.metadata.type !== "task")
    throw new WorkspaceError("invalid_input", `${identifier} is not a task`);
  if (task.path.startsWith("todo/_archived/") || task.path.startsWith("todo/_archive/"))
    throw new WorkspaceError("invalid_input", "Task is already archived");
  if (expectedHash !== undefined && task.contentHash !== expectedHash)
    throw new WorkspaceError("conflict", `Task changed since it was loaded: ${task.path}`);
  const day = new Date().toISOString().slice(0, 10);
  const destination = `${datedGroupPath("_archived", day, `task-${task.metadata.id.toLowerCase()}`)}/${basename(task.path)}`;
  const currentPath = await resolveSafeWorkspacePath(context.root, task.path);
  const content = await Bun.file(currentPath).text();
  const parsed = parseFrontmatter(content);
  const existingExtra =
    typeof parsed.values.extra === "object" &&
    parsed.values.extra !== null &&
    !Array.isArray(parsed.values.extra)
      ? (parsed.values.extra as Record<string, unknown>)
      : {};
  parsed.values.extra = { ...existingExtra, archived_from: task.path };
  parsed.values.archived_at = new Date().toISOString();
  await replaceFile(
    context,
    task.path,
    serializeMarkdown(parsed.values, parsed.body),
    task.contentHash,
  );
  const updated = findDocument(await buildWorkspaceIndex(context), task.metadata.id);
  const absoluteDestination = await resolveSafeWorkspacePath(context.root, destination);
  await mkdir(dirname(absoluteDestination), { recursive: true });
  await resolveSafeWorkspacePath(context.root, destination);
  await rename(currentPath, absoluteDestination);
  return findDocument(await buildWorkspaceIndex(context), updated.metadata.id);
}

export async function restoreTask(
  context: WorkspaceContext,
  identifier: string,
  expectedHash?: string,
): Promise<DocumentSummary> {
  const task = findDocument(await buildWorkspaceIndex(context), identifier);
  if (
    task.metadata.type !== "task" ||
    (!task.path.startsWith("todo/_archived/") && !task.path.startsWith("todo/_archive/"))
  ) {
    throw new WorkspaceError("invalid_input", "Task is not archived");
  }
  if (expectedHash !== undefined && task.contentHash !== expectedHash)
    throw new WorkspaceError("conflict", `Task changed since it was loaded: ${task.path}`);
  const originalPath = task.metadata.extra?.archived_from;
  if (typeof originalPath !== "string") {
    const group = (await listTaskGroups(context)).find(
      (candidate) => candidate.path === dirname(task.path) && candidate.archived,
    );
    if (!group)
      throw new WorkspaceError("validation_failed", "Archived task has no valid restore path");
    await restoreGroup(context, group.id);
    return findDocument(await buildWorkspaceIndex(context), task.metadata.id);
  }
  if (!originalPath.startsWith("todo/"))
    throw new WorkspaceError("validation_failed", "Archived task has no valid restore path");
  const sourcePath = await resolveSafeWorkspacePath(context.root, task.path);
  const destinationPath = await resolveSafeWorkspacePath(context.root, originalPath);
  await mkdir(dirname(destinationPath), { recursive: true });
  await resolveSafeWorkspacePath(context.root, originalPath);
  try {
    await lstat(destinationPath);
    throw new WorkspaceError(
      "already_exists",
      `Restore destination already exists: ${originalPath}`,
    );
  } catch (error) {
    if (error instanceof WorkspaceError) throw error;
    if (errorCode(error) !== "ENOENT") throw error;
  }
  const parsed = parseFrontmatter(await Bun.file(sourcePath).text());
  delete parsed.values.archived_at;
  const extra = parsed.values.extra as Record<string, unknown> | undefined;
  if (extra) {
    delete extra.archived_from;
    if (Object.keys(extra).length === 0) delete parsed.values.extra;
  }
  await replaceFile(
    context,
    task.path,
    serializeMarkdown(parsed.values, parsed.body),
    task.contentHash,
  );
  await rename(sourcePath, destinationPath);
  return findDocument(await buildWorkspaceIndex(context), task.metadata.id);
}

export async function restoreTaskGroup(
  context: WorkspaceContext,
  identifier: string,
): Promise<TaskGroup> {
  const group = (await listTaskGroups(context)).find((entry) => entry.id === identifier);
  if (!group) throw new WorkspaceError("not_found", `No task group found for ${identifier}`);
  return restoreGroup(context, group.id);
}
