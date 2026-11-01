import { afterEach, describe, expect, mock, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";

mock.module("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({
    back: () => undefined,
    forward: () => undefined,
    push: () => undefined,
    replace: () => undefined,
    refresh: () => undefined,
    prefetch: async () => undefined,
  }),
}));

const { WorkspacePage } = await import("@/components/workspace-page");

import { closeLocalWorkspace, configureWorkspace, createLocalServer } from "@/server";

let server: ReturnType<typeof createLocalServer> | undefined;
let root = "";
const originalPort = process.env.TASK_LOCAL_PORT;

afterEach(async () => {
  if (server?.listening) {
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => (error ? reject(error) : resolve()));
    });
  }
  server = undefined;
  closeLocalWorkspace();
  if (root) await rm(root, { recursive: true, force: true });
  root = "";
  if (originalPort === undefined) delete process.env.TASK_LOCAL_PORT;
  else process.env.TASK_LOCAL_PORT = originalPort;
});

describe("local dashboard server rendering", () => {
  test("includes the runtime-selected project in the first render", async () => {
    root = await mkdtemp(join(tmpdir(), "task-ssr-project-"));
    const tasks = join(root, "tasks");
    await mkdir(tasks);
    await writeFile(
      join(tasks, "project-note.md"),
      "---\nid: DOC-1\nname: Project note\ntype: documentation\ntags: []\n---\nProject context.\n",
    );
    await configureWorkspace(root);

    const currentServer = createLocalServer();
    server = currentServer;
    await new Promise<void>((resolve) => currentServer.listen(0, "127.0.0.1", resolve));
    const address = currentServer.address();
    if (!address || typeof address === "string") throw new Error("Expected TCP address");
    process.env.TASK_LOCAL_PORT = String(address.port);

    const markup = renderToStaticMarkup(await WorkspacePage({ initialPath: "/" }));
    expect(markup).toContain(root.split("/").at(-1) ?? "");
    expect(markup).toContain("Documents");
    expect(markup).toContain('data-slot="main-toolbar"');
    expect(markup).not.toContain("Connected");
  });
});
