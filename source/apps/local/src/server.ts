import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import {
  buildWorkspaceIndex,
  type WorkspaceIndex,
  type WorkspaceWatcher,
  watchWorkspaceIndex,
} from "@task/workspace";

const host = "127.0.0.1";
type RuntimeError = {
  error: { code: "not_found" | "method_not_allowed"; message: string; requestId: string };
};

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

function route(request: IncomingMessage, response: ServerResponse): void {
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
    send(response, 200, { status: "ok", service: "task-local", requestId }, requestId);
    return;
  }
  const error: RuntimeError = {
    error: { code: "not_found", message: "Route not found", requestId },
  };
  send(response, 404, error, requestId);
}

export function createLocalServer(): Server {
  return createServer(route);
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
  const workspaceMonitor = workspaceRoot ? await monitorWorkspace(workspaceRoot) : undefined;
  const server = createLocalServer();
  server.listen(port, host, () =>
    process.stdout.write(`Task local runtime listening on http://${host}:${port}\n`),
  );
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      workspaceMonitor?.watcher.close();
      server.close(() => process.exit(0));
    });
  }
}
