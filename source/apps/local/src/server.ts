import { createServer, type Server } from "node:http";

const host = "127.0.0.1";

export function createLocalServer(): Server {
  return createServer((request, response) => {
    if (request.method === "GET" && request.url === "/health") {
      response.writeHead(200, {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      });
      response.end(JSON.stringify({ status: "ok", service: "task-local" }));
      return;
    }

    response.writeHead(404, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    });
    response.end(JSON.stringify({ error: "not_found" }));
  });
}

if (import.meta.main) {
  const port = Number(process.env.TASK_LOCAL_PORT ?? 4317);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("TASK_LOCAL_PORT must be an integer between 1 and 65535");
  }

  const server = createLocalServer();
  server.listen(port, host, () => {
    process.stdout.write(`Task local runtime listening on http://${host}:${port}\n`);
  });

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => server.close(() => process.exit(0)));
  }
}
