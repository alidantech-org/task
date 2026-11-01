import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTask, createTaskGroup } from "@task/workspace";
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

  test("deletes a document into the temp trash and restores it with capability protection", async () => {
    const root = await mkdtemp(join(tmpdir(), "task-runtime-delete-"));
    const previousTrash = process.env.TASK_TRASH_DIR;
    process.env.TASK_TRASH_DIR = join(root, "trash");
    try {
      await mkdir(join(root, "tasks"), { recursive: true });
      const documentPath = join(root, "tasks", "gone.md");
      await writeFile(
        documentPath,
        "---\nid: D-GONE\nname: Gone\ntype: documentation\n---\n\nbody\n",
      );
      await configureWorkspace(root);
      const currentServer = createLocalServer();
      server = currentServer;
      await new Promise<void>((resolve) => currentServer.listen(0, "127.0.0.1", resolve));
      const address = currentServer.address();
      if (!address || typeof address === "string") throw new Error("Expected TCP address");
      const baseUrl = `http://127.0.0.1:${address.port}`;
      const { capability } = (await (await fetch(`${baseUrl}/internal/session`)).json()) as {
        capability: string;
      };
      const headers = { "x-task-capability": capability };

      const unauthorised = await fetch(`${baseUrl}/workspace/document/D-GONE`, {
        method: "DELETE",
      });
      expect(unauthorised.status).toBe(401);
      expect(await Bun.file(documentPath).exists()).toBe(true);

      const deleted = await fetch(`${baseUrl}/workspace/document/D-GONE`, {
        method: "DELETE",
        headers,
      });
      expect(deleted.status).toBe(200);
      const { trash } = (await deleted.json()) as { trash: { trashId: string; trashPath: string } };
      expect(trash.trashPath.startsWith(join(root, "trash"))).toBe(true);
      expect(await Bun.file(documentPath).exists()).toBe(false);

      const listed = (await (await fetch(`${baseUrl}/workspace/trash`, { headers })).json()) as {
        entries: { trashId: string }[];
      };
      expect(listed.entries.map((entry) => entry.trashId)).toEqual([trash.trashId]);

      const missing = await fetch(`${baseUrl}/workspace/document/NOPE`, {
        method: "DELETE",
        headers,
      });
      expect(missing.status).toBe(404);

      const restored = await fetch(`${baseUrl}/workspace/trash/${trash.trashId}/restore`, {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: "{}",
      });
      expect(restored.status).toBe(200);
      expect(await readFile(documentPath, "utf8")).toContain("id: D-GONE");
    } finally {
      if (previousTrash === undefined) delete process.env.TASK_TRASH_DIR;
      else process.env.TASK_TRASH_DIR = previousTrash;
      await rm(root, { recursive: true, force: true });
    }
  });

  test("serves tracked git changes and hides protected diffs", async () => {
    const root = await mkdtemp(join(tmpdir(), "task-runtime-changes-"));
    try {
      const git = (...args: string[]) =>
        Bun.spawnSync(["git", "-c", "user.name=T", "-c", "user.email=t@example.com", ...args], {
          cwd: root,
          stdout: "pipe",
          stderr: "pipe",
        });
      git("init", "-q");
      await writeFile(join(root, "app.txt"), "base\n");
      git("add", "-A");
      git("commit", "-q", "-m", "base");
      const context = { root: join(root, "tasks"), projectRoot: root };
      await mkdir(context.root, { recursive: true });
      const group = await createTaskGroup(context, "Work");
      const task = await createTask(context, { title: "Tracked", group: group.id });
      await configureWorkspace(root);
      const currentServer = createLocalServer();
      server = currentServer;
      await new Promise<void>((resolve) => currentServer.listen(0, "127.0.0.1", resolve));
      const address = currentServer.address();
      if (!address || typeof address === "string") throw new Error("Expected TCP address");
      const baseUrl = `http://127.0.0.1:${address.port}`;
      const { capability } = (await (await fetch(`${baseUrl}/internal/session`)).json()) as {
        capability: string;
      };
      const headers = { "x-task-capability": capability, "content-type": "application/json" };
      const hash = task.contentHash;
      const started = await fetch(`${baseUrl}/workspace/task/${task.metadata.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status: "in-progress", track: true, expectedHash: hash }),
      });
      expect(started.status).toBe(200);
      await writeFile(join(root, "app.txt"), "base\nchanged\n");
      await writeFile(join(root, ".env"), "SECRET=1\n");
      const changes = (await (
        await fetch(`${baseUrl}/workspace/task/${task.metadata.id}/changes`, { headers })
      ).json()) as { tracked: boolean; changes: { files: { path: string; denied: boolean }[] } };
      expect(changes.tracked).toBe(true);
      expect(changes.changes.files.map((file) => file.path)).toEqual([".env", "app.txt"]);
      const diff = await fetch(
        `${baseUrl}/workspace/task/${task.metadata.id}/changes/diff?path=app.txt`,
        { headers },
      );
      expect(((await diff.json()) as { diff: string }).diff).toContain("+changed");
      const protectedDiff = await fetch(
        `${baseUrl}/workspace/task/${task.metadata.id}/changes/diff?path=.env`,
        { headers },
      );
      expect(protectedDiff.status).toBe(400);
      const unauthorised = await fetch(`${baseUrl}/workspace/task/${task.metadata.id}/changes`);
      expect(unauthorised.status).toBe(401);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("serves project files read-only and refuses protected or escaping paths", async () => {
    const root = await mkdtemp(join(tmpdir(), "task-runtime-files-"));
    try {
      await mkdir(join(root, "tasks"), { recursive: true });
      await mkdir(join(root, "src"), { recursive: true });
      await writeFile(join(root, "src", "app.ts"), "export const a = 1;\n");
      await writeFile(join(root, ".env"), "SECRET=1\n");
      await configureWorkspace(root);
      const currentServer = createLocalServer();
      server = currentServer;
      await new Promise<void>((resolve) => currentServer.listen(0, "127.0.0.1", resolve));
      const address = currentServer.address();
      if (!address || typeof address === "string") throw new Error("Expected TCP address");
      const baseUrl = `http://127.0.0.1:${address.port}`;
      const { capability } = (await (await fetch(`${baseUrl}/internal/session`)).json()) as {
        capability: string;
      };
      const headers = { "x-task-capability": capability };
      const get = (path: string, init: RequestInit = { headers }) =>
        fetch(`${baseUrl}/workspace/project-file?path=${encodeURIComponent(path)}`, init);
      const ok = await get("src/app.ts");
      expect(ok.status).toBe(200);
      expect(((await ok.json()) as { file: { language: string } }).file.language).toBe(
        "typescript",
      );
      expect((await get(".env")).status).toBe(400);
      expect((await get("../outside")).status).toBe(400);
      expect((await get("missing.ts")).status).toBe(404);
      expect((await get("src/app.ts", {})).status).toBe(401);
      expect((await get("src/app.ts", { method: "POST", headers })).status).toBe(404);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("streams external workspace edits to live dashboard subscribers", async () => {
    const root = await mkdtemp(join(tmpdir(), "task-runtime-live-"));
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    try {
      await mkdir(join(root, "tasks"), { recursive: true });
      const documentPath = join(root, "tasks", "live.md");
      await writeFile(documentPath, "---\nid: D-LIVE\nname: Before\ntype: documentation\n---\n");
      await configureWorkspace(root);

      const currentServer = createLocalServer();
      server = currentServer;
      await new Promise<void>((resolve) => currentServer.listen(0, "127.0.0.1", resolve));
      const address = currentServer.address();
      if (!address || typeof address === "string") throw new Error("Expected TCP address");
      const baseUrl = `http://127.0.0.1:${address.port}`;
      const session = await fetch(`${baseUrl}/internal/session`);
      const { capability } = (await session.json()) as { capability: string };
      const events = await fetch(`${baseUrl}/workspace/events`, {
        headers: { "x-task-capability": capability },
      });
      expect(events.status).toBe(200);
      expect(events.headers.get("content-type")).toContain("text/event-stream");
      if (!events.body) throw new Error("Expected streaming response body");
      reader = events.body.getReader();
      const decoder = new TextDecoder();
      const initial = await reader.read();
      expect(decoder.decode(initial.value)).toContain('"type":"workspace.reset"');

      await writeFile(documentPath, "---\nid: D-LIVE\nname: After\ntype: documentation\n---\n");
      let update = "";
      const deadline = Date.now() + 4_000;
      while (Date.now() < deadline && !update.includes('"recordId":"D-LIVE"')) {
        let timeout: ReturnType<typeof setTimeout> | undefined;
        const next = await Promise.race([
          reader.read(),
          new Promise<{ done: true; value: undefined }>((resolve) => {
            timeout = setTimeout(() => resolve({ done: true, value: undefined }), 500);
          }),
        ]).finally(() => {
          if (timeout) clearTimeout(timeout);
        });
        if (next.done || !next.value) continue;
        update += decoder.decode(next.value);
      }
      expect(update).toContain('"type":"workspace.changed"');
      expect(update).toContain('"recordId":"D-LIVE"');

      const currentDocument = await fetch(`${baseUrl}/workspace/document/D-LIVE`, {
        headers: { "x-task-capability": capability },
      });
      const currentPayload = (await currentDocument.json()) as {
        document: { body: string; contentHash: string };
      };
      const dashboardEdit = await fetch(`${baseUrl}/workspace/document/D-LIVE`, {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-task-capability": capability },
        body: JSON.stringify({
          body: `${currentPayload.document.body}\nChanged through the dashboard.\n`,
          expectedHash: currentPayload.document.contentHash,
        }),
      });
      expect(dashboardEdit.status).toBe(200);
      let dashboardUpdate = "";
      const dashboardDeadline = Date.now() + 2_000;
      while (Date.now() < dashboardDeadline && !dashboardUpdate.includes('"recordId":"D-LIVE"')) {
        let timeout: ReturnType<typeof setTimeout> | undefined;
        const next = await Promise.race([
          reader.read(),
          new Promise<{ done: true; value: undefined }>((resolve) => {
            timeout = setTimeout(() => resolve({ done: true, value: undefined }), 500);
          }),
        ]).finally(() => {
          if (timeout) clearTimeout(timeout);
        });
        if (next.done || !next.value) continue;
        dashboardUpdate += decoder.decode(next.value);
      }
      expect(dashboardUpdate).toContain('"type":"workspace.changed"');
    } finally {
      await reader?.cancel();
      await rm(root, { recursive: true, force: true });
    }
  });

  test("saves week-start and archive-delay settings for an implicit tasks workspace", async () => {
    const root = await mkdtemp(join(tmpdir(), "task-runtime-settings-"));
    try {
      await mkdir(join(root, "tasks"), { recursive: true });
      await configureWorkspace(root);
      const currentServer = createLocalServer();
      server = currentServer;
      await new Promise<void>((resolve) => currentServer.listen(0, "127.0.0.1", resolve));
      const address = currentServer.address();
      if (!address || typeof address === "string") throw new Error("Expected TCP address");
      const baseUrl = `http://127.0.0.1:${address.port}`;
      const session = await fetch(`${baseUrl}/internal/session`);
      const { capability } = (await session.json()) as { capability: string };
      const saved = await fetch(`${baseUrl}/workspace/settings`, {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-task-capability": capability },
        body: JSON.stringify({ weekStart: 7, autoArchiveAfterDays: null }),
      });
      expect(saved.status).toBe(200);
      expect(await saved.json()).toMatchObject({
        workspace: { organization: { weekStart: 7, autoArchiveAfterDays: null } },
      });
      expect(await readFile(join(root, "task.yaml"), "utf8")).toContain("weekStart: 7");
      const invalid = await fetch(`${baseUrl}/workspace/settings`, {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-task-capability": capability },
        body: JSON.stringify({ weekStart: 0 }),
      });
      expect(invalid.status).toBe(400);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
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
      const createdDocument = await fetch(`${baseUrl}/workspace/documents`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-task-capability": capability },
        body: JSON.stringify({
          title: "Untitled note",
          path: "docs/note-new.md",
          tags: [],
          body: "## Summary\n\nFirst note.\n",
        }),
      });
      expect(createdDocument.status).toBe(201);
      const documentPayload = (await createdDocument.json()) as {
        document: { metadata: { id: string; type: string }; path: string };
        workspace: { documents: Array<{ id: string }> };
      };
      expect(documentPayload.document).toMatchObject({
        path: "docs/note-new.md",
        metadata: { name: "Untitled note", type: "documentation" },
      });
      expect(
        documentPayload.workspace.documents.some(
          (item) => item.id === documentPayload.document.metadata.id,
        ),
      ).toBe(true);
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
      const movedPayload = (await moved.json()) as {
        task: { contentHash: string };
      };
      const hiddenFromRecent = await fetch(
        `${baseUrl}/workspace/task/${taskPayload.task.metadata.id}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json", "x-task-capability": capability },
          body: JSON.stringify({
            hiddenFromRecent: true,
            expectedHash: movedPayload.task.contentHash,
          }),
        },
      );
      expect(hiddenFromRecent.status).toBe(200);
      expect(await hiddenFromRecent.json()).toMatchObject({
        task: { metadata: { extra: { hidden_from_recent: true } } },
      });
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
