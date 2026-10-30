import { afterEach, describe, expect, test } from "bun:test";
import { createLocalServer } from "./server.js";

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
    const health = await fetch(`${baseUrl}/health`);
    expect(health.status).toBe(200);
    expect(health.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await health.json()).toEqual({ status: "ok", service: "task-local" });

    const missing = await fetch(`${baseUrl}/arbitrary-file`);
    expect(missing.status).toBe(404);

    const wrongMethod = await fetch(`${baseUrl}/health`, { method: "POST" });
    expect(wrongMethod.status).toBe(404);
  });
});
