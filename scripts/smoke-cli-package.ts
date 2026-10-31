import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const cliRoot = join(repositoryRoot, "source/apps/cli");
const dashboardRoot = join(cliRoot, "dist/assets/local-dashboard");
const runtimeEntry = join(cliRoot, "dist/assets/local-runtime.js");
const nextEntry = join(cliRoot, "node_modules/next/dist/bin/next");
const projectRoot = await mkdtemp(join(tmpdir(), "task-cli-installed-project-"));
const children: ChildProcess[] = [];

async function getPort(): Promise<number> {
  const server = createServer();
  return new Promise((resolvePort, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Could not allocate a local test port"));
        return;
      }
      server.close((error) => (error ? reject(error) : resolvePort(address.port)));
    });
  });
}

function launch(
  command: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
): ChildProcess {
  const child = spawn(command, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
  let pending = "";
  child.stdout?.setEncoding("utf8").on("data", (chunk: string) => {
    pending += chunk;
    const rows = pending.split("\n");
    pending = rows.pop() ?? "";
    for (const row of rows)
      process.stdout.write(`${row.replace(/capability=[a-f0-9]+/gi, "capability=[redacted]")}\n`);
  });
  child.stderr?.pipe(process.stderr);
  children.push(child);
  return child;
}

async function waitFor(url: string, child: ChildProcess, label: string): Promise<Response> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null)
      throw new Error(`${label} exited before becoming ready`);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) return response;
    } catch {
      // Retry while the local services start.
    }
    await Bun.sleep(150);
  }
  throw new Error(`${label} failed to become ready within 30 seconds`);
}

function stop(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise((resolveStop) => {
    child.once("exit", () => resolveStop());
    child.kill("SIGTERM");
    const timer = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    }, 5_000);
    timer.unref();
  });
}

try {
  await mkdir(join(projectRoot, "tasks"), { recursive: true });
  const init = Bun.spawnSync(["bun", "run", join(cliRoot, "src/index.ts"), "init"], {
    cwd: projectRoot,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (init.exitCode !== 0) throw new Error(init.stderr.toString() || "Task init failed");

  const runtimePort = await getPort();
  const dashboardPort = await getPort();
  const runtime = launch(process.execPath, [runtimeEntry], projectRoot, {
    ...process.env,
    TASK_WORKSPACE_ROOT: join(projectRoot, "tasks"),
    TASK_LOCAL_PORT: String(runtimePort),
  });
  await waitFor(`http://127.0.0.1:${runtimePort}/health/ready`, runtime, "Packaged runtime");
  const dashboard = launch(
    "node",
    [nextEntry, "start", "--hostname", "127.0.0.1", "--port", String(dashboardPort)],
    dashboardRoot,
    { ...process.env, PORT: String(dashboardPort), TASK_LOCAL_PORT: String(runtimePort) },
  );
  const url = `http://127.0.0.1:${dashboardPort}`;
  const page = await waitFor(url, dashboard, "Packaged dashboard");
  const html = await page.text();
  if (!html.includes("Task") || !html.includes("Workspace overview"))
    throw new Error("Packaged dashboard did not render the workspace interface");

  const workspaceResponse = await fetch(`${url}/api/runtime/workspace`);
  if (!workspaceResponse.ok) throw new Error("Dashboard could not read its selected workspace");
  const payload: unknown = await workspaceResponse.json();
  if (!payload || typeof payload !== "object" || !("workspace" in payload))
    throw new Error("Dashboard workspace response has an unexpected shape");
  const workspace = payload.workspace;
  if (
    !workspace ||
    typeof workspace !== "object" ||
    !("projectRoot" in workspace) ||
    workspace.projectRoot !== projectRoot
  ) {
    throw new Error("Dashboard connected to a different project workspace");
  }

  const sessionResponse = await fetch(`http://127.0.0.1:${runtimePort}/internal/session`);
  const session: unknown = await sessionResponse.json();
  if (!session || typeof session !== "object" || !("capability" in session))
    throw new Error("Packaged runtime did not issue a local session capability");
  const capability = session.capability;
  if (typeof capability !== "string") throw new Error("Runtime capability was malformed");
  const created = await fetch(`http://127.0.0.1:${runtimePort}/workspace/task-groups`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-task-capability": capability },
    body: JSON.stringify({ name: "Release smoke test" }),
  });
  if (created.status !== 201)
    throw new Error("Packaged runtime could not create a workspace group");
  process.stdout.write("Packaged CLI runtime and dashboard smoke test passed.\n");
} finally {
  await Promise.all(children.map(stop));
  await rm(projectRoot, { recursive: true, force: true });
}
