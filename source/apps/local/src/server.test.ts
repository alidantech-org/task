import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  closeLocalWorkspace,
  configureWorkspace,
  createLocalServer,
  monitorWorkspace,
} from "@/server";

let server: ReturnType<typeof createLocalServer> | undefined;

afterEach(async () => {
  const currentServer = server;
  server = undefined;
  if (currentServer?.listening) {
    await new Promise<void>((resolve, reject) => {
      currentServer.close((error) => (error ? reject(error) : resolve()));
    });
  }
  closeLocalWorkspace();
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

  test("serves authorized workspace snapshots and rejects browser-origin access", async () => {
    const root = await mkdtemp(join(tmpdir(), "task-runtime-index-"));
    try {
      await mkdir(join(root, "tasks"), { recursive: true });
      await writeFile(join(root, "tasks", "one.md"), "---\nid: T-1\nname: One\ntype: task\n---\n");
      await configureWorkspace(root);
      const monitor = await monitorWorkspace(root);
      expect(monitor.index.documents.size).toBe(1);
      monitor.watcher.close();

      const currentServer = createLocalServer();
      server = currentServer;
      await new Promise<void>((resolve) => currentServer.listen(0, "127.0.0.1", resolve));
      const address = currentServer.address();
      if (!address || typeof address === "string") throw new Error("Expected TCP address");
      const baseUrl = `http://127.0.0.1:${address.port}`;
      const ready = await fetch(`${baseUrl}/health/ready`);
      expect(await ready.json()).toMatchObject({ workspace: true });
      const session = await fetch(`${baseUrl}/internal/session`);
      const { capability } = (await session.json()) as { capability: string };
      const denied = await fetch(`${baseUrl}/workspace`, {
        headers: { origin: "https://evil.example", "x-task-capability": capability },
      });
      expect(denied.status).toBe(403);
      const unauthorized = await fetch(`${baseUrl}/workspace`);
      expect(unauthorized.status).toBe(401);
      const snapshot = await fetch(`${baseUrl}/workspace`, {
        headers: { "x-task-capability": capability },
      });
      expect(snapshot.status).toBe(200);
      expect(await snapshot.json()).toMatchObject({
        workspace: {
          projectRoot: root,
          workspaceRoot: join(root, "tasks"),
          workspaceDirectory: "tasks",
          documents: [{ id: "T-1", name: "One" }],
        },
      });

      const originalDocument = await fetch(`${baseUrl}/workspace/document/T-1`, {
        headers: { "x-task-capability": capability },
      });
      const document = (await originalDocument.json()) as {
        document: { contentHash: string };
      };
      const savedDocument = await fetch(`${baseUrl}/workspace/document/T-1`, {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-task-capability": capability },
        body: JSON.stringify({
          body: "Updated from the dashboard.\n",
          expectedHash: document.document.contentHash,
        }),
      });
      expect(savedDocument.status).toBe(200);
      expect(await savedDocument.json()).toMatchObject({
        document: { body: "\nUpdated from the dashboard.\n" },
      });
      const staleDocument = await fetch(`${baseUrl}/workspace/document/T-1`, {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-task-capability": capability },
        body: JSON.stringify({
          body: "Stale overwrite\n",
          expectedHash: document.document.contentHash,
        }),
      });
      expect(staleDocument.status).toBe(409);

      const createdGroup = await fetch(`${baseUrl}/workspace/task-groups`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-task-capability": capability },
        body: JSON.stringify({ name: "Dashboard" }),
      });
      expect(createdGroup.status).toBe(201);
      const groupPayload = (await createdGroup.json()) as {
        group: { id: string };
        workspace: { groups: Array<{ id: string }> };
      };
      expect(groupPayload.workspace.groups).toHaveLength(1);
      const createdTask = await fetch(`${baseUrl}/workspace/tasks`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-task-capability": capability },
        body: JSON.stringify({
          title: "Created locally",
          group: groupPayload.group.id,
          dueAt: "2026-11-05",
        }),
      });
      expect(createdTask.status).toBe(201);
      const taskPayload = (await createdTask.json()) as {
        task: { metadata: { id: string; due_at: string }; contentHash: string };
      };
      expect(taskPayload.task.metadata.due_at).toBe("2026-11-05");
      const moved = await fetch(`${baseUrl}/workspace/task/${taskPayload.task.metadata.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-task-capability": capability },
        body: JSON.stringify({ status: "in-progress", expectedHash: taskPayload.task.contentHash }),
      });
      expect(moved.status).toBe(200);
      const conflict = await fetch(`${baseUrl}/workspace/task/${taskPayload.task.metadata.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-task-capability": capability },
        body: JSON.stringify({ status: "blocked", expectedHash: taskPayload.task.contentHash }),
      });
      expect(conflict.status).toBe(409);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("switches only to explicitly trusted accessible projects and retains the active project on failure", async () => {
    const root = await mkdtemp(join(tmpdir(), "task-runtime-projects-"));
    const previousConfigHome = process.env.XDG_CONFIG_HOME;
    const first = join(root, "first");
    const second = join(root, "second");
    const missing = join(root, "missing");
    try {
      process.env.XDG_CONFIG_HOME = join(root, "config");
      await mkdir(join(first, "tasks"), { recursive: true });
      await mkdir(join(second, "tasks"), { recursive: true });
      await writeFile(
        join(first, "tasks", "first.md"),
        "---\nid: D-1\nname: First\ntype: documentation\n---\n",
      );
      await writeFile(
        join(second, "tasks", "second.md"),
        "---\nid: D-2\nname: Second\ntype: documentation\n---\n",
      );
      await configureWorkspace(first);

      const currentServer = createLocalServer();
      server = currentServer;
      await new Promise<void>((resolve) => currentServer.listen(0, "127.0.0.1", resolve));
      const address = currentServer.address();
      if (!address || typeof address === "string") throw new Error("Expected TCP address");
      const baseUrl = `http://127.0.0.1:${address.port}`;
      const session = await fetch(`${baseUrl}/internal/session`);
      const { capability } = (await session.json()) as { capability: string };
      const headers = { "content-type": "application/json", "x-task-capability": capability };

      const untrustedSwitch = await fetch(`${baseUrl}/projects/select`, {
        method: "POST",
        headers,
        body: JSON.stringify({ path: second }),
      });
      expect(untrustedSwitch.status).toBe(400);
      const activeAfterDenied = await fetch(`${baseUrl}/workspace`, {
        headers: { "x-task-capability": capability },
      });
      expect(await activeAfterDenied.json()).toMatchObject({ workspace: { projectRoot: first } });

      const trust = await fetch(`${baseUrl}/projects/trusted`, {
        method: "POST",
        headers,
        body: JSON.stringify({ path: second }),
      });
      expect(trust.status).toBe(201);
      const trustFirst = await fetch(`${baseUrl}/projects/trusted`, {
        method: "POST",
        headers,
        body: JSON.stringify({ path: first }),
      });
      expect(trustFirst.status).toBe(201);
      const missingTrust = await fetch(`${baseUrl}/projects/trusted`, {
        method: "POST",
        headers,
        body: JSON.stringify({ path: missing }),
      });
      expect(missingTrust.status).toBe(400);

      closeLocalWorkspace();
      const selected = await fetch(`${baseUrl}/projects/select`, {
        method: "POST",
        headers,
        body: JSON.stringify({ path: second }),
      });
      expect(selected.status).toBe(200);
      expect(await selected.json()).toMatchObject({ workspace: { projectRoot: second } });

      const removeActive = await fetch(
        `${baseUrl}/projects/trusted/${encodeURIComponent(second)}`,
        {
          method: "DELETE",
          headers: { "x-task-capability": capability },
        },
      );
      expect(removeActive.status).toBe(400);
      await rm(first, { recursive: true, force: true });
      const removeInactive = await fetch(
        `${baseUrl}/projects/trusted/${encodeURIComponent(first)}`,
        {
          method: "DELETE",
          headers: { "x-task-capability": capability },
        },
      );
      expect(removeInactive.status).toBe(200);
      expect(await removeInactive.json()).toMatchObject({
        projects: [expect.objectContaining({ path: second })],
      });
    } finally {
      if (previousConfigHome === undefined) delete process.env.XDG_CONFIG_HOME;
      else process.env.XDG_CONFIG_HOME = previousConfigHome;
      await rm(root, { recursive: true, force: true });
    }
  });
});
