import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLocalServer, monitorWorkspace } from "@/server";

let server: ReturnType<typeof createLocalServer> | undefined;

afterEach(async () => {
  const currentServer = server;
  server = undefined;
  if (!currentServer?.listening) return;
  await new Promise<void>((resolve, reject) => {
    currentServer.close((error) => (error ? reject(error) : resolve()));
  });
});

describe("local runtime HTTP boundary", () => {
  test("serves health on loopback and rejects unknown routes", async () => {
    const currentServer = createLocalServer();
    server = currentServer;
    await new Promise<void>((resolve) => currentServer.listen(0, "127.0.0.1", resolve));
    const address = currentServer.address();
    if (!address || typeof address === "string") throw new Error("Expected TCP address");

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const health = await fetch(`${baseUrl}/health/live`);
    expect(health.status).toBe(200);
    expect(health.headers.get("x-request-id")).toBeTruthy();
    expect(health.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await health.json()).toEqual(
      expect.objectContaining({ status: "ok", service: "task-local" }),
    );

    const missing = await fetch(`${baseUrl}/arbitrary-file`);
    expect(missing.status).toBe(404);
    expect(await missing.json()).toMatchObject({ error: { code: "not_found" } });

    const wrongMethod = await fetch(`${baseUrl}/health/live`, { method: "POST" });
    expect(wrongMethod.status).toBe(405);
  });

  test("runtime can maintain the shared index without exposing it through HTTP", async () => {
    const root = await mkdtemp(join(tmpdir(), "task-runtime-index-"));
    try {
      await mkdir(join(root, "tasks"), { recursive: true });
      await writeFile(join(root, "tasks", "one.md"), "---\nid: T-1\nname: One\ntype: task\n---\n");
      const monitor = await monitorWorkspace(root);
      expect(monitor.index.documents.size).toBe(1);
      monitor.watcher.close();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
