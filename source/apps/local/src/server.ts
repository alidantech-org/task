import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { basename } from "node:path";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import {
  buildWorkspaceIndex,
  getWorkspaceOverview,
  resolveWorkspace,
  searchWorkspace,
  validateWorkspace,
  getDocument,
  type WorkspaceIndex,
  type WorkspaceWatcher,
  watchWorkspaceIndex,
} from "@task/workspace";
import type { ResolvedWorkspace } from "@task/workspace";

const host = "127.0.0.1";
type RuntimeError = {
  error: { code: "not_found" | "method_not_allowed"; message: string; requestId: string };
};

type RuntimeState = {
  workspace?: ResolvedWorkspace;
  monitor?: Awaited<ReturnType<typeof monitorWorkspace>>;
  capability: string;
};

const runtimeState: RuntimeState = { capability: randomBytes(32).toString("hex") };
const allowedOrigins = new Set(["http://127.0.0.1:5173", "http://localhost:5173"]);

export async function configureWorkspace(root: string): Promise<void> {
  const selected = await resolveWorkspace({ workspaceOverride: root });
  if (runtimeState.monitor) runtimeState.monitor.watcher.close();
  runtimeState.workspace = selected;
  runtimeState.monitor = await monitorWorkspace(selected.root);
}

export function closeLocalWorkspace(): void {
  runtimeState.monitor?.watcher.close();
  runtimeState.monitor = undefined;
  runtimeState.workspace = undefined;
}

function authorized(request: IncomingMessage, response: ServerResponse, requestId: string): boolean {
  const origin = request.headers.origin;
  const cookieHeader = request.headers.cookie ?? "";
  const token = request.headers["x-task-capability"];
  if (origin && !allowedOrigins.has(origin)) {
    send(response, 403, { error: { code: "forbidden", message: "Origin is not allowed", requestId } }, requestId);
    return false;
  }
  if (origin) {
    send(response, 403, { error: { code: "forbidden", message: "Browser access must use the dashboard server proxy", requestId } }, requestId);
    return false;
  }
  const cookieValue = cookieHeader.split(";").map((part) => part.trim()).find((part) => part.startsWith("task-capability="))?.slice("task-capability=".length);
  const supplied = typeof token === "string" ? Buffer.from(token) : Buffer.from(cookieValue ?? "");
  const expected = Buffer.from(runtimeState.capability);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    send(response, 401, { error: { code: "unauthorized", message: "Runtime capability is missing or invalid", requestId } }, requestId);
    return false;
  }
  return true;
}

function snapshot(index: WorkspaceIndex): object {
  const workspace = runtimeState.workspace;
  if (!workspace) throw new Error("No workspace is selected");
  return {
    projectName: basename(workspace.projectRoot),
    projectRoot: workspace.projectRoot,
    workspaceRoot: workspace.root,
    workspaceDirectory: workspace.config.workspace,
    source: workspace.source,
    scannedAt: index.scannedAt,
    overview: getWorkspaceOverview(index),
    groups: [],
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
      size: document.size,
      modifiedAt: document.modifiedAt,
      contentHash: document.contentHash,
      classification: document.classification,
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
    send(response, 200, { status: "ok", service: "task-local", workspace: !!runtimeState.workspace, requestId }, requestId);
    return;
  }
  if (path === "/internal/session" && method === "GET") {
    if (request.headers.origin) {
      send(response, 403, { error: { code: "forbidden", message: "Session bootstrap is server-side only", requestId } }, requestId);
      return;
    }
    send(response, 200, { capability: runtimeState.capability, requestId }, requestId);
    return;
  }
  if (path === "/runtime/session" && method === "GET") {
    send(response, 200, { status: "ok", workspace: !!runtimeState.workspace, requestId }, requestId);
    return;
  }
  if (path.startsWith("/workspace")) {
    if (!authorized(request, response, requestId)) return;
    const workspace = runtimeState.workspace;
    const monitor = runtimeState.monitor;
    if (!workspace || !monitor) {
      send(response, 409, { error: { code: "workspace_unavailable", message: "Start the runtime from a Task project or select a workspace", requestId } }, requestId);
      return;
    }
    try {
      if (path === "/workspace" && method === "GET") {
        send(response, 200, { workspace: snapshot(monitor.index), requestId }, requestId);
        return;
      }
      if (path === "/workspace/search" && method === "GET") {
        const query = new URL(request.url ?? "/", "http://127.0.0.1").searchParams.get("q") ?? "";
        if (!query.trim()) {
          send(response, 200, { results: [], requestId }, requestId);
          return;
        }
        const results = await searchWorkspace(workspace, query, { limit: 100 });
        send(response, 200, { results: results.map(({ summary, snippet }) => ({ path: summary.path, id: summary.metadata.id, name: summary.metadata.name, type: summary.metadata.type, snippet })), requestId }, requestId);
        return;
      }
      if (path === "/workspace/validate" && method === "POST") {
        const result = await validateWorkspace(workspace);
        send(response, 200, { diagnostics: result, requestId }, requestId);
        return;
      }
      if (path.startsWith("/workspace/document/") && method === "GET") {
        const identifier = decodeURIComponent(path.slice("/workspace/document/".length));
        const result = await getDocument(workspace, identifier);
        send(response, 200, { document: { path: result.summary.path, contentHash: result.summary.contentHash, body: result.body }, requestId }, requestId);
        return;
      }
      if (path === "/workspace/refresh" && method === "POST") {
        await monitor.watcher.reconcile();
        send(response, 200, { workspace: snapshot(monitor.index), requestId }, requestId);
        return;
      }
    } catch (error) {
      send(response, 400, { error: { code: "workspace_error", message: error instanceof Error ? error.message : "Workspace request failed", requestId } }, requestId);
      return;
    }
  }
  const error: RuntimeError = {
    error: { code: "not_found", message: "Route not found", requestId },
  };
  send(response, 404, error, requestId);
}

export function createLocalServer(): Server {
  return createServer((request, response) => void route(request, response));
}

export async function monitorWorkspace(root: string): Promise<{
  get index(): WorkspaceIndex;
  watcher: WorkspaceWatcher;
}> {
  const index = await buildWorkspaceIndex({ root });
  const watcher = watchWorkspaceIndex({ root }, index, () => undefined, {
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
  if (workspaceRoot) await configureWorkspace(workspaceRoot);
  else {
    try {
      const selected = await resolveWorkspace();
      await configureWorkspace(selected.projectRoot);
    } catch {
      // The runtime remains available for health checks when started outside a project.
    }
  }
  const workspaceMonitor = runtimeState.monitor;
  const server = createLocalServer();
  server.listen(port, host, () =>
    process.stdout.write(`Task local runtime listening on http://${host}:${port}; capability=${runtimeState.capability}\n`),
  );
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      workspaceMonitor?.watcher.close();
      server.close(() => process.exit(0));
    });
  }
}
