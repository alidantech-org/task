import { afterEach, describe, expect, test } from "bun:test";
import { createLocalServer } from "./server.js";

let server: ReturnType<typeof createLocalServer> | undefined;

afterEach(async () => {
  if (!server?.listening) return;
  await new Promise<void>((resolve, reject) => {
    server?.close((error) => (error ? reject(error) : resolve()));
  });
  server = undefined;
});

describe("local runtime HTTP boundary", () => {
  test("serves health on loopback and rejects unknown routes", async () => {
    server = createLocalServer();
    await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected TCP address");

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const health = await fetch(`${baseUrl}/health`);
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ status: "ok", service: "task-local" });

    const missing = await fetch(`${baseUrl}/arbitrary-file`);
    expect(missing.status).toBe(404);
  });
});
