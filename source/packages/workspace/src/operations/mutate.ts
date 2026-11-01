import { randomBytes, randomUUID } from "node:crypto";
import { lstat, mkdir, open, readdir, rename, rm, rmdir, unlink } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { type ChecklistSelector, setChecklistItems } from "@task/workspace/documents/checklist";
import { WorkspaceError } from "@task/workspace/errors";
import { endTracking, startTracking, trackingEnabled } from "@task/workspace/git/tracking";
import { buildWorkspaceIndex } from "@task/workspace/indexing/incremental";
import { parseFrontmatter, serializeMarkdown } from "@task/workspace/indexing/metadata";
import type {
  DocumentCreateInput,
  DocumentSummary,
  TaskCreateInput,
  TaskGroup,
  TaskStatus,
  TaskTracking,
  TaskUpdateInput,
  WorkspaceContext,
} from "@task/workspace/indexing/types";
import { formatFindings, resolveQuality } from "@task/workspace/operations/quality";
import { taskQualityFindings } from "@task/workspace/operations/quality-check";
import { findDocument, findGroup, listTaskGroups } from "@task/workspace/operations/query";
import { resolveSafeWorkspacePath } from "@task/workspace/paths/safe-path";

function existingTracking(extra: Record<string, unknown>): TaskTracking | undefined {
  const tracking = extra.tracking;
  return typeof tracking === "object" && tracking !== null && "segments" in tracking
    ? (tracking as TaskTracking)
    : undefined;
}

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

function taskBody(title: string, description?: string, body?: string): string {
  if (body?.trim()) return `${body.trimEnd()}\n`;
  return [
    `# ${title}`,
    "",
    "## Goal",
    "",
    ...(description?.trim() ? [description.trim(), ""] : []),
    "<!-- Why this work matters and the outcome it must produce. Write full sentences. -->",
    "",
    "## Context",
    "",
    "<!-- Background, constraints, related documents and decisions. -->",
    "",
    "## Acceptance checklist",
    "",
    '<!-- One concrete "- [ ]" step per deliverable. Keep all steps in this one file. -->',
    "",
  ].join("\n");
}

function groupScaffold(name: string, kind: "goal" | "plan"): string {
  return kind === "goal"
    ? `# ${name} goal\n\n## Goal\n\n<!-- What this group of work achieves and why. -->\n\n## Success criteria\n\n<!-- Observable results that mean the goal is met. -->\n\n## Scope\n\n<!-- What is in and out of scope. -->\n`
    : `# ${name} plan\n\n## Approach\n\n<!-- How the work will be done. -->\n\n## Milestones\n\n<!-- Ordered steps or phases. -->\n\n## Risks and open questions\n\n<!-- Unknowns and how to resolve them. -->\n`;
}

export function getTaskGroupWeekPath(
  date: Date,
  weekStart = 1,
  currentYear = new Date().getUTCFullYear(),
): string {
  if (!Number.isInteger(weekStart) || weekStart < 1 || weekStart > 7) {
    throw new WorkspaceError("invalid_input", "Week start must be an integer from 1 to 7");
  }
  const weekday = (date.getUTCDay() + 6) % 7;
  const startOffset = (weekday - (weekStart - 1) + 7) % 7;
  const start = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - startOffset),
  );
  const anchor = new Date(start);
  anchor.setUTCDate(anchor.getUTCDate() + ((4 - weekStart + 7) % 7));
  const year = anchor.getUTCFullYear();
  const first = new Date(Date.UTC(year, 0, 1));
  first.setUTCDate(first.getUTCDate() + ((4 - first.getUTCDay() + 7) % 7));
  const firstOffset = (first.getUTCDay() + 6 - (weekStart - 1) + 7) % 7;
  first.setUTCDate(first.getUTCDate() - firstOffset);
  const number = Math.floor((start.getTime() - first.getTime()) / 604_800_000) + 1;
  const prefix = year === currentYear ? "" : `${year}/`;
  return `todo/work/${prefix}W${String(number).padStart(2, "0")}`;
}

export async function migrateLegacyGroups(context: WorkspaceContext): Promise<TaskGroup[]> {
  const index = await buildWorkspaceIndex(context);
  const moved: TaskGroup[] = [];
  for (const group of await listTaskGroups(context)) {
    if (!/^todo\/[^/]+$/.test(group.path)) continue;
    const plan = index.documents.get(`${group.path}/plan.md`);
    const created = plan?.metadata.extra?.created_at;
    const createdAt =
      typeof created === "string" ? new Date(created) : new Date(plan?.modifiedAt ?? Date.now());
    const destination = `${getTaskGroupWeekPath(createdAt, context.config?.organization?.weekStart ?? 1)}/${group.slug}--${group.id.slice(-6).toLowerCase()}`;
    await moveDirectory(context, group.path, destination);
    moved.push({ ...group, path: destination });
  }
  return moved;
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

export async function createTaskGroup(
  context: WorkspaceContext,
  name: string,
  options: { goal?: string; plan?: string } = {},
): Promise<TaskGroup> {
  const cleanName = name.trim();
  if (!cleanName) throw new WorkspaceError("invalid_input", "Group name is required");
  const slug = slugify(cleanName);
  const groupId = id("GRP");
  const weekPath = getTaskGroupWeekPath(new Date(), context.config?.organization?.weekStart ?? 1);
  const relativePath = `${weekPath}/${slug}--${groupId.slice(-6).toLowerCase()}`;
  const groupPath = await resolveSafeWorkspacePath(context.root, relativePath);
  await mkdir(dirname(groupPath), { recursive: true });
  try {
    await mkdir(groupPath);
  } catch (error) {
    if (errorCode(error) === "EEXIST")
      throw new WorkspaceError("already_exists", `Task group already exists: ${slug}`);
    throw error;
  }
  const plan = {
    id: groupId,
    name: cleanName,
    type: "documentation",
    extra: { created_at: new Date().toISOString() },
  };
  const goalId = `GOAL-${groupId}`;
  const goal = {
    id: goalId,
    name: `${cleanName} goal`,
    type: "documentation",
    extra: { created_at: new Date().toISOString(), group: groupId },
  };
  try {
    await createFile(
      context,
      `${relativePath}/plan.md`,
      serializeMarkdown(
        plan,
        options.plan?.trim() ? `${options.plan.trimEnd()}\n` : groupScaffold(cleanName, "plan"),
      ),
    );
    await createFile(
      context,
      `${relativePath}/goal.md`,
      serializeMarkdown(
        goal,
        options.goal?.trim() ? `${options.goal.trimEnd()}\n` : groupScaffold(cleanName, "goal"),
      ),
    );
  } catch (error) {
    await rm(join(groupPath, "plan.md"), { force: true });
    await rm(join(groupPath, "goal.md"), { force: true });
    await rmdir(groupPath).catch(() => undefined);
    throw error;
  }
  return {
    id: groupId,
    name: cleanName,
    slug,
    path: relativePath,
    goalId,
    archived: false,
    total: 0,
    completed: 0,
    archivedTasks: 0,
    resolved: 0,
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
        serializeMarkdown(values, taskBody(title, input.description, input.body)),
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
): Promise<{ task: DocumentSummary; completedGroup?: TaskGroup; warnings?: string[] }> {
  const index = await buildWorkspaceIndex(context);
  const task = findDocument(index, identifier);
  if (task.metadata.type !== "task")
    throw new WorkspaceError("invalid_input", `${identifier} is not a task`);
  if (expectedHash !== undefined && task.contentHash !== expectedHash) {
    throw new WorkspaceError("conflict", `Task changed since it was loaded: ${task.path}`);
  }
  const path = await resolveSafeWorkspacePath(context.root, task.path);
  const content = await Bun.file(path).text();
  const parsed = parseFrontmatter(content);
  const values = { ...parsed.values };
  const previousStatus = (values.status ?? "planned") as TaskStatus;
  let warnings: string[] | undefined;
  if (
    input.status !== undefined &&
    previousStatus === "planned" &&
    ["in-progress", "blocked", "completed"].includes(input.status)
  ) {
    const quality = resolveQuality(context.config);
    if (quality.mode !== "off") {
      const findings = await taskQualityFindings(context, task, parsed.body, quality);
      if (findings.length > 0) {
        if (quality.mode === "reject")
          throw new WorkspaceError(
            "validation_failed",
            formatFindings(`Task ${task.metadata.id}`, findings),
          );
        warnings = findings.map((finding) => finding.message);
      }
    }
  }
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
  if (input.dueAt === null) delete values.due_at;
  else if (input.dueAt !== undefined) values.due_at = input.dueAt;
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
  const nextStatus = input.status ?? previousStatus;
  const segments = [...(existingTracking(existingExtra)?.segments ?? [])];
  const open = segments.at(-1);
  if (open && !open.ended_at && nextStatus !== "in-progress") {
    segments[segments.length - 1] = await endTracking(context, task.metadata.id, open);
    nextExtra.tracking = { segments };
  } else if (
    nextStatus === "in-progress" &&
    !(open && !open.ended_at) &&
    trackingEnabled(context) &&
    ((input.status === "in-progress" && previousStatus !== "in-progress") || input.track === true)
  ) {
    try {
      segments.push(await startTracking(context, task.metadata.id));
      nextExtra.tracking = { segments };
    } catch (error) {
      warnings = [
        ...(warnings ?? []),
        `Change tracking is unavailable: ${error instanceof Error ? error.message : String(error)}`,
      ];
    }
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
  let updatedIndex = await buildWorkspaceIndex(context);
  let updatedTask = findDocument(updatedIndex, task.metadata.id);
  if (
    (task.path.startsWith("todo/_archived/") || task.path.startsWith("todo/_completed/")) &&
    input.status !== undefined &&
    !["completed", "archived"].includes(input.status)
  ) {
    const group = (await listTaskGroups(context)).find(
      (candidate) => candidate.path === dirname(task.path),
    );
    if (group?.archived) {
      await restoreGroup(context, group.id);
      updatedIndex = await buildWorkspaceIndex(context);
      updatedTask = findDocument(updatedIndex, task.metadata.id);
    } else if (group && task.path.startsWith("todo/_completed/")) {
      const destination = `${getTaskGroupWeekPath(new Date(), context.config?.organization?.weekStart ?? 1)}/${group.slug}--${group.id.slice(-6).toLowerCase()}`;
      await moveDirectory(context, group.path, destination);
      updatedIndex = await buildWorkspaceIndex(context);
      updatedTask = findDocument(updatedIndex, task.metadata.id);
    } else if (task.path.startsWith("todo/_archived/")) {
      const originalPath = task.metadata.extra?.archived_from;
      if (typeof originalPath === "string" && originalPath.startsWith("todo/")) {
        const source = await resolveSafeWorkspacePath(context.root, task.path);
        const destination = await resolveSafeWorkspacePath(context.root, originalPath);
        await mkdir(dirname(destination), { recursive: true });
        await resolveSafeWorkspacePath(context.root, originalPath);
        try {
          await lstat(destination);
          throw new WorkspaceError(
            "already_exists",
            `Restore destination already exists: ${originalPath}`,
          );
        } catch (error) {
          if (error instanceof WorkspaceError) throw error;
          if (errorCode(error) !== "ENOENT") throw error;
        }
        const currentText = await Bun.file(source).text();
        const restoredMetadata = parseFrontmatter(currentText);
        delete restoredMetadata.values.archived_at;
        const extra = restoredMetadata.values.extra as Record<string, unknown> | undefined;
        if (extra) {
          delete extra.archived_from;
          if (Object.keys(extra).length === 0) delete restoredMetadata.values.extra;
        }
        await replaceFile(
          context,
          task.path,
          serializeMarkdown(restoredMetadata.values, restoredMetadata.body),
          updatedTask.contentHash,
        );
        await rename(source, destination);
        updatedIndex = await buildWorkspaceIndex(context);
        updatedTask = findDocument(updatedIndex, task.metadata.id);
      }
    }
  }
  return { task: updatedTask, ...(warnings ? { warnings } : {}) };
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

/** Checks or unchecks checklist items in a document body and saves it with an optimistic hash check. */
export async function setDocumentChecklist(
  context: WorkspaceContext,
  identifier: string,
  selector: ChecklistSelector,
  checked: boolean,
  expectedHash?: string,
): Promise<{ document: DocumentSummary; changed: number; selected: number }> {
  const document = findDocument(await buildWorkspaceIndex(context), identifier);
  const path = await resolveSafeWorkspacePath(context.root, document.path);
  const parsed = parseFrontmatter(await Bun.file(path).text());
  let result: ReturnType<typeof setChecklistItems>;
  try {
    result = setChecklistItems(parsed.body, selector, checked);
  } catch (error) {
    throw new WorkspaceError(
      "invalid_input",
      error instanceof Error ? error.message : "Invalid checklist selection",
      { cause: error },
    );
  }
  if (result.changed === 0) return { document, changed: 0, selected: result.selected };
  const updated = await replaceDocumentBody(
    context,
    identifier,
    result.body,
    expectedHash ?? document.contentHash,
  );
  return { document: updated, changed: result.changed, selected: result.selected };
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
  void requireComplete;
  const group = await findGroup(context, identifier);
  if (group.archived) throw new WorkspaceError("invalid_input", "Task group is already archived");
  if (group.total === 0 || group.resolved !== group.total) {
    throw new WorkspaceError(
      "validation_failed",
      "Only groups with completed or archived tasks can be archived",
    );
  }
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const archivedAt = now.toISOString();
  const destination = datedGroupPath(
    "_archived",
    day,
    `${group.slug}--${group.id.slice(-6).toLowerCase()}`,
  );
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
  return archiveGroup(context, identifier, true);
}

export async function restoreGroup(
  context: WorkspaceContext,
  identifier: string,
): Promise<TaskGroup> {
  const group = await findGroup(context, identifier);
  if (!group.archived) throw new WorkspaceError("invalid_input", "Task group is not archived");
  const index = await buildWorkspaceIndex(context);
  const destination = `${getTaskGroupWeekPath(new Date(), context.config?.organization?.weekStart ?? 1)}/${group.slug}--${group.id.slice(-6).toLowerCase()}`;
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
  return { ...group, path: destination, archived: false, finished: group.resolved === group.total };
}

export async function archiveTaskGroup(
  context: WorkspaceContext,
  identifier: string,
): Promise<TaskGroup> {
  return archiveGroup(context, identifier, false);
}

export async function autoArchiveResolvedGroups(
  context: WorkspaceContext,
  afterDays: number | null | undefined,
): Promise<TaskGroup[]> {
  const delay = afterDays === null ? null : (afterDays ?? 2);
  if (delay !== null && (!Number.isInteger(delay) || delay < 0)) {
    throw new WorkspaceError(
      "invalid_input",
      "Auto-archive delay must be a non-negative integer or null",
    );
  }
  const index = await buildWorkspaceIndex(context);
  const archived: TaskGroup[] = [];
  const currentYear = new Date().getUTCFullYear();
  for (const group of await listTaskGroups(context)) {
    const match = /^todo\/work\/(W\d{2})\/([^/]+)$/.exec(group.path);
    if (!match) continue;
    const plan = index.documents.get(`${group.path}/plan.md`);
    const createdAtValue = plan?.metadata.extra?.created_at;
    const createdAt =
      typeof createdAtValue === "string"
        ? Date.parse(createdAtValue)
        : (plan?.modifiedAt ?? Number.NaN);
    const groupYear = Number.isFinite(createdAt)
      ? new Date(createdAt).getUTCFullYear()
      : currentYear;
    if (groupYear >= currentYear) continue;
    if (group.total > 0 && group.resolved === group.total) {
      archived.push(await archiveGroup(context, group.id));
      continue;
    }
    const destination = `todo/work/${groupYear}/${match[1]}/${match[2]}`;
    await moveDirectory(context, group.path, destination);
  }
  if (delay === null) return archived;
  for (const group of await listTaskGroups(context)) {
    if (group.archived || group.total === 0 || group.resolved !== group.total) continue;
    const tasks = [...index.documents.values()].filter(
      (document) => document.metadata.type === "task" && dirname(document.path) === group.path,
    );
    const resolutionTimes = tasks.map((task) => {
      const changes = task.metadata.extra?.status_history ?? [];
      const resolved = [...changes]
        .reverse()
        .find((change) => change.to === "completed" || change.to === "archived");
      return Date.parse(resolved?.at ?? task.metadata.updated_at ?? task.metadata.created_at ?? "");
    });
    if (resolutionTimes.some((time) => !Number.isFinite(time))) continue;
    const lastResolved = Math.max(...resolutionTimes);
    if (Date.now() - lastResolved < delay * 86_400_000) continue;
    archived.push(await archiveGroup(context, group.id));
  }
  return archived;
}

export async function archiveTask(
  context: WorkspaceContext,
  identifier: string,
  expectedHash?: string,
): Promise<DocumentSummary> {
  return (await updateTask(context, identifier, { status: "archived" }, expectedHash)).task;
}

export async function restoreTask(
  context: WorkspaceContext,
  identifier: string,
  expectedHash?: string,
): Promise<DocumentSummary> {
  const task = findDocument(await buildWorkspaceIndex(context), identifier);
  if (
    task.metadata.type === "task" &&
    task.metadata.status === "archived" &&
    !task.path.startsWith("todo/_archived/") &&
    !task.path.startsWith("todo/_archive/")
  ) {
    const archivedTransition = [...(task.metadata.extra?.status_history ?? [])]
      .reverse()
      .find((change) => change.to === "archived");
    return (
      await updateTask(
        context,
        identifier,
        { status: archivedTransition?.from ?? "planned" },
        expectedHash,
      )
    ).task;
  }
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
