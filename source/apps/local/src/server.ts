import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { lstat, mkdir, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { homedir } from "node:os";
import { basename, isAbsolute, resolve } from "node:path";
import {
  addFileAttachment,
  addLinkAttachment,
  addTaskComment,
  archiveTask,
  archiveTaskGroup,
  autoArchiveResolvedGroups,
  buildActivity,
  buildWorkspaceIndex,
  bulkUpdateTasks,
  createDocument,
  createTask,
  createTaskFromTemplate,
  createTaskGroup,
  createTemplate,
  deleteDocument,
  deleteTask,
  deleteTaskComment,
  deleteTaskGroup,
  findDocument,
  getDocument,
  getTaskChanges,
  getTaskFileDiff,
  getWorkspaceOverview,
  type IndexChange,
  listTaskComments,
  listTaskGroups,
  listTemplates,
  listTrash,
  migrateLegacyGroups,
  moveTask,
  type Recurrence,
  type ResolvedWorkspace,
  readAttachment,
  readDocumentChecklist,
  readProjectFile,
  readWorkspaceIndex,
  removeAttachment,
  reorderTask,
  replaceDocumentBody,
  resolveAuthor,
  resolveQuality,
  resolveWorkspace,
  restoreFromTrash,
  restoreTask,
  restoreTaskGroup,
  searchWorkspace,
  setDocumentChecklist,
  type TaskLink,
  type TaskPriority,
  type TaskStatus,
  type TemplateDefaults,
  updateTask,
  updateWorkspaceOrganization,
  validateWorkspace,
  WorkspaceError,
  type WorkspaceIndex,
  type WorkspaceWatcher,
  watchWorkspaceIndex,
} from "@task/workspace";
import { parseFrontmatter } from "@task/workspace/indexing/metadata";

const host = "127.0.0.1";
type RuntimeError = {
  error: { code: "not_found" | "method_not_allowed"; message: string; requestId: string };
};

type RuntimeState = {
  workspace?: ResolvedWorkspace;
  monitor?: Awaited<ReturnType<typeof monitorWorkspace>>;
  workspaceError?: string;
  capability: string;
  maintenanceTimer?: ReturnType<typeof setInterval>;
  maintenance?: Promise<void>;
};

type TrustedProject = { path: string; addedAt: string };
type TrustedProjectRegistry = { version: 1; projects: TrustedProject[] };

const runtimeState: RuntimeState = { capability: randomBytes(32).toString("hex") };
const allowedOrigins = new Set(["http://127.0.0.1:5173", "http://localhost:5173"]);
const eventClients = new Set<ServerResponse>();
let eventCursor = 0;

function publishWorkspaceChange(change: IndexChange): void {
  const projectRoot = runtimeState.workspace?.projectRoot ?? "";
  const event = {
    type: change.type === "reset" ? "workspace.reset" : "workspace.changed",
    workspaceId: createHash("sha256").update(projectRoot).digest("hex").slice(0, 20),
    cursor: ++eventCursor,
    changedAt: new Date().toISOString(),
    changeType: change.type,
    path:
      change.type === "reset"
        ? undefined
        : change.type === "invalid"
          ? change.diagnostic.path
          : change.type === "repaired" || change.type === "removed"
            ? change.path
            : change.document.path,
    recordId:
      change.type === "added" || change.type === "updated"
        ? change.document.metadata.id
        : undefined,
  };
  const frame = `id: ${event.cursor}\nevent: workspace\ndata: ${JSON.stringify(event)}\n\n`;
  for (const client of eventClients) {
    if (client.destroyed || client.writableEnded) {
      eventClients.delete(client);
      continue;
    }
    client.write(frame);
  }
}

export async function configureWorkspace(projectRoot: string): Promise<void> {
  const selected = await resolveWorkspace({ cwd: projectRoot });
  await configureResolvedWorkspace(selected);
}

function trustedRegistryPath(): string {
  return resolve(
    process.env.XDG_CONFIG_HOME ?? resolve(process.env.HOME ?? homedir(), ".config"),
    "task",
    "trusted-projects.json",
  );
}

async function readTrustedProjects(): Promise<TrustedProject[]> {
  try {
    const registryPath = trustedRegistryPath();
    const stat = await lstat(registryPath);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new Error("Trusted project registry must be a regular file");
    }
    const parsed = JSON.parse(await readFile(registryPath, "utf8")) as TrustedProjectRegistry;
    if (
      parsed.version !== 1 ||
      !Array.isArray(parsed.projects) ||
      parsed.projects.some(
        (project) =>
          typeof project.path !== "string" ||
          !isAbsolute(project.path) ||
          typeof project.addedAt !== "string" ||
          Number.isNaN(Date.parse(project.addedAt)),
      )
    )
      throw new Error("Trusted project registry has an unsupported format");
    return parsed.projects;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
}

async function writeTrustedProjects(projects: TrustedProject[]): Promise<void> {
  const path = trustedRegistryPath();
  const directory = resolve(path, "..");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify({ version: 1, projects }, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
    flag: "wx",
  });
  await rename(temporary, path).catch(async (error: unknown) => {
    await rm(temporary, { force: true });
    throw error;
  });
}

async function trustProject(pathInput: string): Promise<TrustedProject> {
  let projectRoot: string;
  try {
    projectRoot = await realpath(resolve(pathInput));
  } catch {
    projectRoot = "";
  }
  if (!projectRoot)
    throw new WorkspaceError("workspace_not_found", `Project path is not accessible: ${pathInput}`);
  const selected = await resolveWorkspace({ cwd: projectRoot });
  projectRoot = selected.projectRoot;
  const projects = await readTrustedProjects();
  const trusted = projects.find((entry) => entry.path === projectRoot);
  const result = trusted ?? { path: projectRoot, addedAt: new Date().toISOString() };
  if (!trusted) await writeTrustedProjects([...projects, result]);
  return result;
}

async function selectTrustedProject(pathInput: string): Promise<void> {
  const projectRoot = await realpath(resolve(pathInput));
  const projects = await readTrustedProjects();
  if (!projects.some((project) => project.path === projectRoot)) {
    throw new WorkspaceError("invalid_input", "Project must be trusted before it can be selected");
  }
  const selected = await resolveWorkspace({ cwd: projectRoot });
  await configureResolvedWorkspace(selected);
}

async function configureResolvedWorkspace(selected: ResolvedWorkspace): Promise<void> {
  const monitor = await monitorWorkspace(selected.root, publishWorkspaceChange);
  const previousMonitor = runtimeState.monitor;
  if (runtimeState.maintenanceTimer) clearInterval(runtimeState.maintenanceTimer);
  runtimeState.workspace = selected;
  runtimeState.monitor = monitor;
  runtimeState.workspaceError = undefined;
  previousMonitor?.watcher.close();
  publishWorkspaceChange({ type: "reset", index: monitor.index });
  runtimeState.maintenanceTimer = setInterval(() => void maintainWorkspace(), 60_000);
  await maintainWorkspace();
}

export function closeLocalWorkspace(): void {
  if (runtimeState.maintenanceTimer) clearInterval(runtimeState.maintenanceTimer);
  runtimeState.maintenanceTimer = undefined;
  runtimeState.monitor?.watcher.close();
  runtimeState.monitor = undefined;
  runtimeState.workspace = undefined;
  runtimeState.workspaceError = undefined;
  for (const client of eventClients) client.end();
  eventClients.clear();
}

async function maintainWorkspace(): Promise<void> {
  if (runtimeState.maintenance) return runtimeState.maintenance;
  const workspace = runtimeState.workspace;
  const monitor = runtimeState.monitor;
  if (!workspace || !monitor) return;
  runtimeState.maintenance = (async () => {
    const moved = await autoArchiveResolvedGroups(
      workspace,
      workspace.config.organization?.autoArchiveAfterDays,
    );
    if (moved.length > 0) await monitor.watcher.reconcile();
  })();
  try {
    await runtimeState.maintenance;
  } catch (error) {
    process.stderr.write(
      `Workspace maintenance failed: ${error instanceof Error ? error.message : String(error)}\n`,
    );
  } finally {
    runtimeState.maintenance = undefined;
  }
}

function authorized(
  request: IncomingMessage,
  response: ServerResponse,
  requestId: string,
): boolean {
  const origin = request.headers.origin;
  const cookieHeader = request.headers.cookie ?? "";
  const token = request.headers["x-task-capability"];
  if (origin && !allowedOrigins.has(origin)) {
    send(
      response,
      403,
      { error: { code: "forbidden", message: "Origin is not allowed", requestId } },
      requestId,
    );
    return false;
  }
  if (origin) {
    send(
      response,
      403,
      {
        error: {
          code: "forbidden",
          message: "Browser access must use the dashboard server proxy",
          requestId,
        },
      },
      requestId,
    );
    return false;
  }
  const cookieValue = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("task-capability="))
    ?.slice("task-capability=".length);
  const supplied = typeof token === "string" ? Buffer.from(token) : Buffer.from(cookieValue ?? "");
  const expected = Buffer.from(runtimeState.capability);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    send(
      response,
      401,
      {
        error: {
          code: "unauthorized",
          message: "Runtime capability is missing or invalid",
          requestId,
        },
      },
      requestId,
    );
    return false;
  }
  return true;
}

async function snapshot(index: WorkspaceIndex): Promise<object> {
  const workspace = runtimeState.workspace;
  if (!workspace) throw new Error("No workspace is selected");
  await maintainWorkspace();
  index = runtimeState.monitor?.index ?? index;
  return {
    projectName: basename(workspace.projectRoot),
    projectRoot: workspace.projectRoot,
    workspaceRoot: workspace.root,
    workspaceDirectory: workspace.config.workspace,
    quality: resolveQuality(workspace.config),
    organization: {
      weekStart: workspace.config.organization?.weekStart ?? 1,
      autoArchiveAfterDays:
        workspace.config.organization?.autoArchiveAfterDays === undefined
          ? 2
          : workspace.config.organization.autoArchiveAfterDays,
    },
    source: workspace.source,
    scannedAt: index.scannedAt,
    overview: getWorkspaceOverview(index),
    groups: await listTaskGroups(workspace),
    documents: [...index.documents.values()].map((document) => ({
      path: document.path,
      id: document.metadata.id,
      name: document.metadata.name,
      type: document.metadata.type,
      tags: document.metadata.tags,
      status: document.metadata.status,
      priority: document.metadata.priority,
      assignee: document.metadata.assignee,
      project: document.metadata.project,
      start_at: document.metadata.start_at,
      due_at: document.metadata.due_at,
      created_at: document.metadata.created_at,
      updated_at: document.metadata.updated_at,
      archived_at: document.metadata.archived_at,
      depends_on: document.metadata.depends_on,
      extra: document.metadata.extra,
      size: document.size,
      modifiedAt: document.modifiedAt,
      contentHash: document.contentHash,
      classification: document.classification,
      checklist: document.checklist,
      commentCount: document.commentCount,
      order: document.metadata.order,
      parent: document.metadata.parent,
      estimate: document.metadata.estimate,
      links: document.metadata.links,
      watchers: document.metadata.watchers,
      recurrence: document.metadata.recurrence,
      attachments: document.metadata.attachments,
    })),
    diagnostics: index.diagnostics,
  };
}

function send(response: ServerResponse, status: number, body: object, requestId: string): void {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "no-referrer",
    "x-request-id": requestId,
  });
  response.end(JSON.stringify(body));
}

async function route(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const requestId = randomUUID();
  const method = request.method ?? "GET";
  const path = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
  process.stdout.write(`${new Date().toISOString()} ${requestId} ${method} ${path}\n`);

  if (path === "/health/live" || path === "/health") {
    if (method !== "GET") {
      const error: RuntimeError = {
        error: { code: "method_not_allowed", message: "Method not allowed", requestId },
      };
      send(response, 405, error, requestId);
      return;
    }
    send(response, 200, { status: "ok", service: "task-local", requestId }, requestId);
    return;
  }
  if (path === "/health/ready") {
    send(
      response,
      200,
      {
        status: "ok",
        service: "task-local",
        workspace: !!runtimeState.workspace,
        workspaceError: runtimeState.workspaceError,
        requestId,
      },
      requestId,
    );
    return;
  }
  if (path === "/internal/session" && method === "GET") {
    if (request.headers.origin) {
      send(
        response,
        403,
        {
          error: { code: "forbidden", message: "Session bootstrap is server-side only", requestId },
        },
        requestId,
      );
      return;
    }
    send(response, 200, { capability: runtimeState.capability, requestId }, requestId);
    return;
  }
  if (path === "/runtime/session" && method === "GET") {
    send(
      response,
      200,
      { status: "ok", workspace: !!runtimeState.workspace, requestId },
      requestId,
    );
    return;
  }
  if (path.startsWith("/workspace") || path.startsWith("/projects/")) {
    if (!authorized(request, response, requestId)) return;
    try {
      if (path === "/projects/trusted" && method === "GET") {
        const projects = await readTrustedProjects();
        send(
          response,
          200,
          {
            projects: projects.map((project) => ({
              ...project,
              active: project.path === runtimeState.workspace?.projectRoot,
            })),
            requestId,
          },
          requestId,
        );
        return;
      }
      if (path === "/projects/trusted" && method === "POST") {
        const input = await readJson(request);
        assertKeys(input, ["path"]);
        const project = await trustProject(stringField(input, "path"));
        send(response, 201, { project, requestId }, requestId);
        return;
      }
      if (path.startsWith("/projects/trusted/") && method === "DELETE") {
        const projectRoot = resolve(decodeURIComponent(path.slice("/projects/trusted/".length)));
        if (projectRoot === runtimeState.workspace?.projectRoot) {
          throw new WorkspaceError("invalid_input", "Select another project before removing trust");
        }
        const projects = await readTrustedProjects();
        if (!projects.some((project) => project.path === projectRoot)) {
          throw new WorkspaceError("workspace_not_found", "Project is not in the trusted registry");
        }
        await writeTrustedProjects(projects.filter((project) => project.path !== projectRoot));
        send(response, 200, { projects: await readTrustedProjects(), requestId }, requestId);
        return;
      }
      if (path === "/projects/select" && method === "POST") {
        const input = await readJson(request);
        assertKeys(input, ["path"]);
        await selectTrustedProject(stringField(input, "path"));
        const selectedMonitor = runtimeState.monitor;
        if (!selectedMonitor)
          throw new WorkspaceError("workspace_not_found", "Selected workspace is unavailable");
        send(
          response,
          200,
          {
            workspace: await snapshot(selectedMonitor.index),
            projects: (await readTrustedProjects()).map((project) => ({
              ...project,
              active: project.path === runtimeState.workspace?.projectRoot,
            })),
            requestId,
          },
          requestId,
        );
        return;
      }
      const workspace = runtimeState.workspace;
      const monitor = runtimeState.monitor;
      if (!workspace || !monitor) {
        send(
          response,
          409,
          {
            error: {
              code: "workspace_unavailable",
              message: "Start the runtime from a Task project or select a workspace",
              requestId,
            },
          },
          requestId,
        );
        return;
      }
      if (path === "/workspace" && method === "GET") {
        send(response, 200, { workspace: await snapshot(monitor.index), requestId }, requestId);
        return;
      }
      if (path === "/workspace/events" && method === "GET") {
        response.writeHead(200, {
          "content-type": "text/event-stream; charset=utf-8",
          "cache-control": "no-cache, no-transform",
          connection: "keep-alive",
          "x-accel-buffering": "no",
          "x-request-id": requestId,
        });
        response.write(
          `id: ${eventCursor}\nevent: workspace\ndata: ${JSON.stringify({
            type: "workspace.reset",
            workspaceId: createHash("sha256")
              .update(workspace.projectRoot)
              .digest("hex")
              .slice(0, 20),
            cursor: eventCursor,
            changedAt: new Date().toISOString(),
            changeType: "reset",
          })}\n\n`,
        );
        eventClients.add(response);
        const heartbeat = setInterval(() => {
          if (!response.destroyed && !response.writableEnded) response.write(": keep-alive\n\n");
        }, 15_000);
        const cleanup = () => {
          clearInterval(heartbeat);
          eventClients.delete(response);
        };
        response.on("close", cleanup);
        return;
      }
      if (path === "/workspace/settings" && method === "PATCH") {
        const input = await readJson(request);
        assertKeys(input, ["weekStart", "autoArchiveAfterDays"]);
        const weekStart =
          input.weekStart === undefined
            ? (workspace.config.organization?.weekStart ?? 1)
            : Number(input.weekStart);
        const autoArchiveAfterDays =
          input.autoArchiveAfterDays === undefined
            ? (workspace.config.organization?.autoArchiveAfterDays ?? 2)
            : input.autoArchiveAfterDays === null
              ? null
              : Number(input.autoArchiveAfterDays);
        if (!Number.isInteger(weekStart) || weekStart < 1 || weekStart > 7)
          throw new Error("weekStart must be an integer from 1 to 7");
        if (
          autoArchiveAfterDays !== null &&
          (!Number.isInteger(autoArchiveAfterDays) || autoArchiveAfterDays < 0)
        )
          throw new Error("autoArchiveAfterDays must be a non-negative integer or null");
        const updated = await updateWorkspaceOrganization(workspace, {
          weekStart,
          autoArchiveAfterDays,
        });
        await configureResolvedWorkspace(updated);
        const selectedMonitor = runtimeState.monitor;
        if (!selectedMonitor)
          throw new WorkspaceError("workspace_not_found", "Workspace monitor unavailable");
        send(
          response,
          200,
          { workspace: await snapshot(selectedMonitor.index), requestId },
          requestId,
        );
        return;
      }
      if (path === "/workspace/migrate" && method === "POST") {
        const groups = await migrateLegacyGroups(workspace);
        await monitor.watcher.reconcile();
        send(
          response,
          200,
          { groups, workspace: await snapshot(monitor.index), requestId },
          requestId,
        );
        return;
      }
      if (path === "/workspace/documents" && method === "POST") {
        const input = await readJson(request, 3_000_000);
        assertKeys(input, ["title", "path", "body", "tags"]);
        const document = await createDocument(workspace, {
          title: stringField(input, "title"),
          path: stringField(input, "path"),
          body: optionalString(input, "body"),
          tags: stringArrayField(input, "tags"),
        });
        await monitor.watcher.reconcile();
        send(
          response,
          201,
          { document, workspace: await snapshot(monitor.index), requestId },
          requestId,
        );
        return;
      }
      if (path === "/workspace/search" && method === "GET") {
        const query = new URL(request.url ?? "/", "http://127.0.0.1").searchParams.get("q") ?? "";
        if (!query.trim()) {
          send(response, 200, { results: [], requestId }, requestId);
          return;
        }
        const results = await searchWorkspace(workspace, query, { limit: 100 });
        send(
          response,
          200,
          {
            results: results.map(({ summary, snippet }) => ({
              path: summary.path,
              id: summary.metadata.id,
              name: summary.metadata.name,
              type: summary.metadata.type,
              snippet,
            })),
            requestId,
          },
          requestId,
        );
        return;
      }
      if (path === "/workspace/validate" && method === "POST") {
        const result = await validateWorkspace(workspace);
        send(response, 200, { diagnostics: result, requestId }, requestId);
        return;
      }
      const taskRoute =
        /^\/workspace\/task\/([^/]+)\/(reorder|comments|activity|attachments)(?:\/([^/]+))?$/.exec(
          path,
        );
      if (taskRoute) {
        const identifier = decodeURIComponent(taskRoute[1] ?? "");
        const part = taskRoute[2];
        const rest = taskRoute[3] === undefined ? undefined : decodeURIComponent(taskRoute[3]);
        if (part === "reorder" && method === "POST" && rest === undefined) {
          const input = await readJson(request);
          assertKeys(input, ["before", "after", "order", "expectedHash"]);
          if (input.order !== undefined && typeof input.order !== "number")
            throw new Error("order must be a number");
          const task = await reorderTask(
            workspace,
            identifier,
            {
              ...(optionalString(input, "before")
                ? { before: optionalString(input, "before") }
                : {}),
              ...(optionalString(input, "after") ? { after: optionalString(input, "after") } : {}),
              ...(typeof input.order === "number" ? { order: input.order } : {}),
            },
            optionalString(input, "expectedHash"),
          );
          await monitor.watcher.reconcile();
          send(
            response,
            200,
            { task, workspace: await snapshot(monitor.index), requestId },
            requestId,
          );
          return;
        }
        if (part === "comments" && method === "GET" && rest === undefined) {
          const comments = (await listTaskComments(workspace, identifier)).map(
            ({ start: _start, end: _end, ...entry }) => entry,
          );
          send(response, 200, { comments, requestId }, requestId);
          return;
        }
        if (part === "comments" && method === "POST" && rest === undefined) {
          const input = await readJson(request);
          assertKeys(input, ["text", "expectedHash"]);
          const result = await addTaskComment(
            workspace,
            identifier,
            stringField(input, "text"),
            undefined,
            optionalString(input, "expectedHash"),
          );
          await monitor.watcher.reconcile();
          send(
            response,
            201,
            {
              task: result.task,
              comments: result.comments.map(({ start: _start, end: _end, ...entry }) => entry),
              workspace: await snapshot(monitor.index),
              requestId,
            },
            requestId,
          );
          return;
        }
        if (part === "comments" && method === "DELETE" && rest !== undefined) {
          const result = await deleteTaskComment(workspace, identifier, Number(rest));
          await monitor.watcher.reconcile();
          send(
            response,
            200,
            {
              task: result.task,
              comments: result.comments.map(({ start: _start, end: _end, ...entry }) => entry),
              workspace: await snapshot(monitor.index),
              requestId,
            },
            requestId,
          );
          return;
        }
        if (part === "activity" && method === "GET" && rest === undefined) {
          const task = findDocument(await readWorkspaceIndex(workspace), identifier);
          const comments = await listTaskComments(workspace, identifier);
          send(
            response,
            200,
            { activity: buildActivity(task.metadata, comments), requestId },
            requestId,
          );
          return;
        }
        if (part === "attachments" && method === "GET" && rest === undefined) {
          const task = findDocument(await readWorkspaceIndex(workspace), identifier);
          send(
            response,
            200,
            { attachments: task.metadata.attachments ?? [], requestId },
            requestId,
          );
          return;
        }
        if (part === "attachments" && method === "GET" && rest !== undefined) {
          const file = await readAttachment(workspace, identifier, rest);
          response.writeHead(200, {
            "content-type": "application/octet-stream",
            "content-length": String(file.data.byteLength),
            "content-disposition": `attachment; filename="${file.name.replace(/[^A-Za-z0-9._ -]/g, "_")}"`,
            "cache-control": "no-store",
            "x-content-type-options": "nosniff",
            "x-frame-options": "DENY",
            "x-request-id": requestId,
          });
          response.end(Buffer.from(file.data));
          return;
        }
        if (part === "attachments" && method === "POST" && rest === undefined) {
          const input = await readJson(request, 1_700_000);
          assertKeys(input, ["name", "contentBase64", "url"]);
          const author = await resolveAuthor(workspace);
          const task =
            typeof input.url === "string"
              ? await addLinkAttachment(
                  workspace,
                  identifier,
                  { url: input.url, name: optionalString(input, "name") },
                  author,
                )
              : await addFileAttachment(
                  workspace,
                  identifier,
                  {
                    name: stringField(input, "name"),
                    data: new Uint8Array(
                      Buffer.from(stringField(input, "contentBase64"), "base64"),
                    ),
                  },
                  author,
                );
          await monitor.watcher.reconcile();
          send(
            response,
            201,
            { task, workspace: await snapshot(monitor.index), requestId },
            requestId,
          );
          return;
        }
        if (part === "attachments" && method === "DELETE" && rest !== undefined) {
          const task = await removeAttachment(workspace, identifier, rest);
          await monitor.watcher.reconcile();
          send(
            response,
            200,
            { task, workspace: await snapshot(monitor.index), requestId },
            requestId,
          );
          return;
        }
      }
      if (path === "/workspace/identity" && method === "GET") {
        send(response, 200, { author: await resolveAuthor(workspace), requestId }, requestId);
        return;
      }
      if (path === "/workspace/templates" && method === "GET") {
        send(response, 200, { templates: await listTemplates(workspace), requestId }, requestId);
        return;
      }
      if (path === "/workspace/templates" && method === "POST") {
        const input = await readJson(request, 300_000);
        assertKeys(input, ["name", "body", "defaults"]);
        const template = await createTemplate(workspace, {
          name: stringField(input, "name"),
          body: stringField(input, "body"),
          ...(typeof input.defaults === "object" && input.defaults !== null
            ? { defaults: input.defaults as TemplateDefaults }
            : {}),
        });
        await monitor.watcher.reconcile();
        send(
          response,
          201,
          { template, workspace: await snapshot(monitor.index), requestId },
          requestId,
        );
        return;
      }
      if (path === "/workspace/tasks/bulk" && method === "POST") {
        const input = await readJson(request, 300_000);
        assertKeys(input, ["ids", "patch"]);
        const ids = stringArrayField(input, "ids") ?? [];
        const patch =
          typeof input.patch === "object" && input.patch !== null
            ? (input.patch as Record<string, unknown>)
            : {};
        assertKeys(patch, ["status", "priority", "assignee", "tags", "group", "archive", "delete"]);
        const results = await bulkUpdateTasks(workspace, ids, {
          ...(optionalString(patch, "status")
            ? { status: optionalString(patch, "status") as TaskStatus }
            : {}),
          ...(optionalString(patch, "priority")
            ? { priority: optionalString(patch, "priority") as TaskPriority }
            : {}),
          ...(typeof patch.assignee === "string" ? { assignee: patch.assignee } : {}),
          ...(stringArrayField(patch, "tags") ? { tags: stringArrayField(patch, "tags") } : {}),
          ...(optionalString(patch, "group") ? { group: optionalString(patch, "group") } : {}),
          ...(patch.archive === true ? { archive: true } : {}),
          ...(patch.delete === true ? { delete: true } : {}),
        });
        await monitor.watcher.reconcile();
        send(
          response,
          200,
          { results, workspace: await snapshot(monitor.index), requestId },
          requestId,
        );
        return;
      }
      const checklistRoute = /^\/workspace\/(?:task|document)\/([^/]+)\/checklist$/.exec(path);
      if (checklistRoute && (method === "GET" || method === "POST")) {
        const identifier = decodeURIComponent(checklistRoute[1] ?? "");
        if (method === "GET") {
          const { document, checklist } = await readDocumentChecklist(workspace, identifier);
          send(
            response,
            200,
            {
              id: document.metadata.id,
              contentHash: document.contentHash,
              ...checklist,
              requestId,
            },
            requestId,
          );
          return;
        }
        const input = await readJson(request);
        assertKeys(input, ["items", "section", "all", "checked", "expectedHash"]);
        if (typeof input.checked !== "boolean") throw new Error("checked must be a boolean");
        const items = Array.isArray(input.items) ? input.items : undefined;
        if (items?.some((value) => !Number.isInteger(value) || Number(value) < 0))
          throw new Error("items must be non-negative integers");
        const result = await setDocumentChecklist(
          workspace,
          identifier,
          {
            ...(items ? { items: items.map(Number) } : {}),
            ...(typeof input.section === "string" ? { section: input.section } : {}),
            ...(input.all === true ? { all: true } : {}),
          },
          input.checked,
          optionalString(input, "expectedHash"),
        );
        await monitor.watcher.reconcile();
        send(
          response,
          200,
          {
            changed: result.changed,
            document: result.document,
            workspace: await snapshot(monitor.index),
            requestId,
          },
          requestId,
        );
        return;
      }
      if (path.startsWith("/workspace/document/") && method === "PATCH") {
        const input = await readJson(request, 3_000_000);
        assertKeys(input, ["body", "expectedHash"]);
        if (typeof input.body !== "string") throw new Error("body must be a string");
        const identifier = decodeURIComponent(path.slice("/workspace/document/".length));
        const document = await replaceDocumentBody(
          workspace,
          identifier,
          input.body,
          stringField(input, "expectedHash"),
        );
        await monitor.watcher.reconcile();
        const result = await getDocument(workspace, identifier);
        const parsed = parseFrontmatter(result.body);
        send(
          response,
          200,
          {
            document: {
              path: document.path,
              contentHash: document.contentHash,
              body: parsed.body,
            },
            workspace: await snapshot(monitor.index),
            requestId,
          },
          requestId,
        );
        return;
      }
      if (path.startsWith("/workspace/document/") && method === "GET") {
        const identifier = decodeURIComponent(path.slice("/workspace/document/".length));
        const result = await getDocument(workspace, identifier);
        const parsed = parseFrontmatter(result.body);
        send(
          response,
          200,
          {
            document: {
              path: result.summary.path,
              contentHash: result.summary.contentHash,
              body: parsed.body,
            },
            requestId,
          },
          requestId,
        );
        return;
      }
      if (path === "/workspace/refresh" && method === "POST") {
        await monitor.watcher.reconcile();
        send(response, 200, { workspace: await snapshot(monitor.index), requestId }, requestId);
        return;
      }
      if (path === "/workspace/task-groups" && method === "POST") {
        const input = await readJson(request);
        assertKeys(input, ["name"]);
        const name = stringField(input, "name");
        const group = await createTaskGroup(workspace, name);
        await monitor.watcher.reconcile();
        send(
          response,
          201,
          { group, workspace: await snapshot(monitor.index), requestId },
          requestId,
        );
        return;
      }
      if (path.startsWith("/workspace/task-groups/") && method === "POST") {
        const suffix = path.endsWith("/archive")
          ? "/archive"
          : path.endsWith("/restore")
            ? "/restore"
            : "";
        if (!suffix) throw new WorkspaceError("not_found", "Task group action not found");
        const identifier = decodeURIComponent(
          path.slice("/workspace/task-groups/".length, -suffix.length),
        );
        const group =
          suffix === "/archive"
            ? await archiveTaskGroup(workspace, identifier)
            : await restoreTaskGroup(workspace, identifier);
        await monitor.watcher.reconcile();
        send(
          response,
          200,
          { group, workspace: await snapshot(monitor.index), requestId },
          requestId,
        );
        return;
      }
      if (path === "/workspace/tasks" && method === "POST") {
        const input = await readJson(request);
        assertKeys(input, [
          "title",
          "group",
          "description",
          "startAt",
          "dueAt",
          "priority",
          "assignee",
          "tags",
          "estimate",
          "parent",
          "template",
        ]);
        const create = optionalString(input, "template")
          ? (value: Parameters<typeof createTask>[1]) =>
              createTaskFromTemplate(workspace, optionalString(input, "template") ?? "", value)
          : (value: Parameters<typeof createTask>[1]) => createTask(workspace, value);
        const task = await create({
          title: stringField(input, "title"),
          group: stringField(input, "group"),
          ...(optionalString(input, "description")
            ? { description: optionalString(input, "description") }
            : {}),
          ...(optionalString(input, "startAt")
            ? { startAt: optionalString(input, "startAt") }
            : {}),
          ...(optionalString(input, "dueAt") ? { dueAt: optionalString(input, "dueAt") } : {}),
          ...(optionalString(input, "priority")
            ? { priority: optionalString(input, "priority") as TaskPriority }
            : {}),
          ...(optionalString(input, "assignee")
            ? { assignee: optionalString(input, "assignee") }
            : {}),
          ...(stringArrayField(input, "tags") ? { tags: stringArrayField(input, "tags") } : {}),
          ...(typeof input.estimate === "number" ? { estimate: input.estimate } : {}),
          ...(optionalString(input, "parent") ? { parent: optionalString(input, "parent") } : {}),
        });
        await monitor.watcher.reconcile();
        send(
          response,
          201,
          { task, workspace: await snapshot(monitor.index), requestId },
          requestId,
        );
        return;
      }
      if (path.startsWith("/workspace/task/") && method === "PATCH") {
        const input = await readJson(request);
        assertKeys(input, [
          "status",
          "dueAt",
          "priority",
          "hiddenFromRecent",
          "track",
          "order",
          "assignee",
          "tags",
          "startAt",
          "estimate",
          "parent",
          "links",
          "watchers",
          "recurrence",
          "group",
          "expectedHash",
        ]);
        for (const key of ["order", "estimate"] as const)
          if (input[key] !== undefined && input[key] !== null && typeof input[key] !== "number")
            throw new Error(`${key} must be a number or null`);
        if (input.parent !== undefined && input.parent !== null && typeof input.parent !== "string")
          throw new Error("parent must be a task id or null");
        if (input.assignee !== undefined && typeof input.assignee !== "string")
          throw new Error("assignee must be a string");
        if (input.links !== undefined && !Array.isArray(input.links))
          throw new Error("links must be an array");
        if (
          input.recurrence !== undefined &&
          input.recurrence !== null &&
          (typeof input.recurrence !== "object" || Array.isArray(input.recurrence))
        )
          throw new Error("recurrence must be an object or null");
        if (input.track !== undefined && typeof input.track !== "boolean")
          throw new Error("track must be a boolean");
        if (input.dueAt !== undefined && input.dueAt !== null && typeof input.dueAt !== "string") {
          throw new Error("dueAt must be a date string or null");
        }
        if (input.hiddenFromRecent !== undefined && typeof input.hiddenFromRecent !== "boolean") {
          throw new Error("hiddenFromRecent must be a boolean");
        }
        if (
          input.priority !== undefined &&
          !["low", "medium", "high"].includes(String(input.priority))
        ) {
          throw new Error("priority must be low, medium, or high");
        }
        const identifier = decodeURIComponent(path.slice("/workspace/task/".length));
        const task = await updateTask(
          workspace,
          identifier,
          {
            ...(optionalString(input, "status")
              ? {
                  status: optionalString(input, "status") as
                    | "planned"
                    | "in-progress"
                    | "blocked"
                    | "completed"
                    | "archived",
                }
              : {}),
            ...(optionalString(input, "priority")
              ? { priority: optionalString(input, "priority") as TaskPriority }
              : {}),
            ...(input.dueAt === null
              ? { dueAt: null }
              : optionalString(input, "dueAt")
                ? { dueAt: optionalString(input, "dueAt") }
                : {}),
            ...(typeof input.hiddenFromRecent === "boolean"
              ? { hiddenFromRecent: input.hiddenFromRecent }
              : {}),
            ...(input.track === true ? { track: true } : {}),
            ...(input.order !== undefined ? { order: input.order as number | null } : {}),
            ...(input.estimate !== undefined ? { estimate: input.estimate as number | null } : {}),
            ...(input.parent !== undefined ? { parent: input.parent as string | null } : {}),
            ...(typeof input.assignee === "string" ? { assignee: input.assignee } : {}),
            ...(stringArrayField(input, "tags") ? { tags: stringArrayField(input, "tags") } : {}),
            ...(optionalString(input, "startAt")
              ? { startAt: optionalString(input, "startAt") }
              : {}),
            ...(input.links !== undefined ? { links: input.links as TaskLink[] } : {}),
            ...(stringArrayField(input, "watchers")
              ? { watchers: stringArrayField(input, "watchers") }
              : {}),
            ...(input.recurrence !== undefined
              ? { recurrence: input.recurrence as Recurrence | null }
              : {}),
          },
          stringField(input, "expectedHash"),
        );
        const movedTask = optionalString(input, "group")
          ? await moveTask(workspace, identifier, optionalString(input, "group") ?? "")
          : undefined;
        await monitor.watcher.reconcile();
        send(
          response,
          200,
          {
            task: movedTask ?? task.task,
            ...(task.warnings ? { warnings: task.warnings } : {}),
            workspace: await snapshot(monitor.index),
            requestId,
          },
          requestId,
        );
        return;
      }
      if (path.startsWith("/workspace/task/") && method === "POST") {
        const suffix = path.endsWith("/archive")
          ? "/archive"
          : path.endsWith("/restore")
            ? "/restore"
            : "";
        if (!suffix) throw new WorkspaceError("not_found", "Task action not found");
        const input = await readJson(request);
        assertKeys(input, ["expectedHash"]);
        const identifier = decodeURIComponent(
          path.slice("/workspace/task/".length, -suffix.length),
        );
        const task =
          suffix === "/archive"
            ? await archiveTask(workspace, identifier, stringField(input, "expectedHash"))
            : await restoreTask(workspace, identifier, stringField(input, "expectedHash"));
        await monitor.watcher.reconcile();
        send(
          response,
          200,
          { task, workspace: await snapshot(monitor.index), requestId },
          requestId,
        );
        return;
      }
      if (path === "/workspace/project-file" && method === "GET") {
        const query = new URL(request.url ?? "/", "http://127.0.0.1").searchParams;
        const file = await readProjectFile(workspace, query.get("path") ?? "");
        send(response, 200, { file, requestId }, requestId);
        return;
      }
      const changesRoute = /^\/workspace\/task\/([^/]+)\/changes(\/diff)?$/.exec(path);
      if (changesRoute && method === "GET") {
        const identifier = decodeURIComponent(changesRoute[1] ?? "");
        const task = findDocument(await readWorkspaceIndex(workspace), identifier);
        const segments = task.metadata.extra?.tracking?.segments ?? [];
        if (changesRoute[2]) {
          const query = new URL(request.url ?? "/", "http://127.0.0.1").searchParams;
          const diff = await getTaskFileDiff(
            workspace,
            segments,
            Number(query.get("segment") ?? segments.length - 1),
            query.get("path") ?? "",
          );
          send(response, 200, { ...diff, requestId }, requestId);
          return;
        }
        send(
          response,
          200,
          {
            changes: await getTaskChanges(workspace, segments),
            tracked: segments.length > 0,
            requestId,
          },
          requestId,
        );
        return;
      }
      const deleteTarget = /^\/workspace\/(task|document|task-groups)\/(.+)$/.exec(path);
      if (deleteTarget && method === "DELETE") {
        const query = new URL(request.url ?? "/", "http://127.0.0.1").searchParams;
        const options = {
          force: query.get("force") === "1",
          cascade: query.get("cascade") === "1",
        };
        const identifier = decodeURIComponent(deleteTarget[2] ?? "");
        const entry =
          deleteTarget[1] === "task"
            ? await deleteTask(workspace, identifier, options)
            : deleteTarget[1] === "document"
              ? await deleteDocument(workspace, identifier)
              : await deleteTaskGroup(workspace, identifier, options);
        await monitor.watcher.reconcile();
        send(
          response,
          200,
          { trash: entry, workspace: await snapshot(monitor.index), requestId },
          requestId,
        );
        return;
      }
      if (path === "/workspace/trash" && method === "GET") {
        send(response, 200, { entries: await listTrash(workspace), requestId }, requestId);
        return;
      }
      if (path.startsWith("/workspace/trash/") && path.endsWith("/restore") && method === "POST") {
        const trashId = decodeURIComponent(
          path.slice("/workspace/trash/".length, -"/restore".length),
        );
        const entry = await restoreFromTrash(workspace, trashId);
        await monitor.watcher.reconcile();
        send(
          response,
          200,
          { trash: entry, workspace: await snapshot(monitor.index), requestId },
          requestId,
        );
        return;
      }
    } catch (error) {
      const code = error instanceof WorkspaceError ? error.code : "invalid_input";
      const status =
        code === "conflict"
          ? 409
          : code === "not_found"
            ? 404
            : code === "already_exists"
              ? 409
              : code === "validation_failed"
                ? 422
                : 400;
      send(
        response,
        status,
        {
          error: {
            code,
            message: error instanceof Error ? error.message : "Workspace request failed",
            requestId,
          },
        },
        requestId,
      );
      return;
    }
  }
  const error: RuntimeError = {
    error: { code: "not_found", message: "Route not found", requestId },
  };
  send(response, 404, error, requestId);
}

async function readJson(
  request: IncomingMessage,
  maxSize = 64_000,
): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxSize) throw new Error("Request body is too large");
    chunks.push(buffer);
  }
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed))
    throw new Error("Request body must be a JSON object");
  return parsed as Record<string, unknown>;
}

function stringField(input: Record<string, unknown>, key: string): string {
  const value = input[key];
  if (typeof value !== "string" || !value.trim())
    throw new Error(`${key} must be a non-empty string`);
  return value;
}

function assertKeys(input: Record<string, unknown>, allowed: readonly string[]): void {
  for (const key of Object.keys(input)) {
    if (!allowed.includes(key)) throw new Error(`Unsupported request field: ${key}`);
  }
}

function optionalString(input: Record<string, unknown>, key: string): string | undefined {
  const value = input[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new Error(`${key} must be a string`);
  return value;
}

function stringArrayField(
  input: Record<string, unknown>,
  key: string,
): readonly string[] | undefined {
  const value = input[key];
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${key} must be an array of strings`);
  }
  return value;
}

export function createLocalServer(): Server {
  return createServer((request, response) => void route(request, response));
}

export async function monitorWorkspace(
  root: string,
  listener: (change: IndexChange) => void = () => undefined,
): Promise<{
  get index(): WorkspaceIndex;
  watcher: WorkspaceWatcher;
}> {
  const index = await buildWorkspaceIndex({ root });
  const watcher = watchWorkspaceIndex({ root }, index, listener, {
    reconcileEveryMs: 30_000,
    onError: (error) =>
      process.stderr.write(`Workspace index reconciliation failed: ${error.message}\n`),
  });
  return {
    get index() {
      return watcher.getSnapshot();
    },
    watcher,
  };
}

if (import.meta.main) {
  const port = Number(process.env.TASK_LOCAL_PORT ?? 4317);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("TASK_LOCAL_PORT must be an integer between 1 and 65535");
  }
  const workspaceRoot = process.env.TASK_WORKSPACE_ROOT;
  try {
    if (workspaceRoot) {
      await configureResolvedWorkspace(
        await resolveWorkspace({ workspaceOverride: workspaceRoot }),
      );
    } else {
      const selected = await resolveWorkspace();
      await configureResolvedWorkspace(selected);
    }
  } catch (error) {
    runtimeState.workspaceError =
      error instanceof Error ? error.message : "Workspace discovery failed";
    process.stderr.write(`Task local workspace discovery failed: ${runtimeState.workspaceError}\n`);
  }
  const workspaceMonitor = runtimeState.monitor;
  const server = createLocalServer();
  server.listen(port, host, () =>
    process.stdout.write(
      `Task local runtime listening on http://${host}:${port}; capability=${runtimeState.capability}\n`,
    ),
  );
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      workspaceMonitor?.watcher.close();
      server.close(() => process.exit(0));
    });
  }
}
