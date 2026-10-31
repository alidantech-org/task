import { type ChildProcess, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { WorkspaceError } from "@task/workspace";

export interface RunOptions {
  projectRoot: string;
  workspaceRoot: string;
  openBrowser: boolean;
  onMessage(message: string): void;
}

interface LocalAssets {
  cliRoot: string;
  dashboardRoot: string;
  runtimeEntry: string;
  nextEntry: string;
}

function packageRootFrom(moduleDirectory: string): string {
  let current = resolve(moduleDirectory);
  for (let depth = 0; depth < 8; depth += 1) {
    if (existsSync(join(current, "package.json"))) return current;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  throw new WorkspaceError("filesystem_error", "Could not locate the installed Task CLI package");
}

function repositoryRootFrom(packageRoot: string): string | undefined {
  let current = packageRoot;
  for (let depth = 0; depth < 8; depth += 1) {
    if (existsSync(join(current, "source/apps/local/package.json"))) return current;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return undefined;
}

export function resolveLocalAssets(moduleDirectory: string): LocalAssets {
  const cliRoot = packageRootFrom(moduleDirectory);
  const dashboardRoot = join(cliRoot, "dist/assets/local-dashboard");
  const runtimeEntry = join(cliRoot, "dist/assets/local-runtime.js");
  const packageNextEntry = fileURLToPath(import.meta.resolve("next/dist/bin/next"));

  if (
    existsSync(join(dashboardRoot, ".next/BUILD_ID")) &&
    existsSync(runtimeEntry) &&
    existsSync(packageNextEntry)
  ) {
    return { cliRoot, dashboardRoot, runtimeEntry, nextEntry: packageNextEntry };
  }

  const repositoryRoot = repositoryRootFrom(cliRoot);
  if (repositoryRoot) {
    const appRoot = join(repositoryRoot, "source/apps/local");
    const nextEntry = packageNextEntry;
    if (existsSync(join(appRoot, ".next/BUILD_ID")) && existsSync(nextEntry)) {
      return {
        cliRoot,
        dashboardRoot: appRoot,
        runtimeEntry: join(appRoot, "src/server.ts"),
        nextEntry,
      };
    }
  }

  throw new WorkspaceError(
    "filesystem_error",
    "The Task dashboard is not available. Install a release with bundled dashboard assets, or build it from the Task repository with `bun run --filter @task/local build`.",
  );
}

async function canListen(port: number): Promise<boolean> {
  const server = createServer();
  return new Promise((resolvePort) => {
    server.once("error", () => resolvePort(false));
    server.listen(port, "127.0.0.1", () => {
      server.close(() => resolvePort(true));
    });
  });
}

async function availablePort(preferred: number, requested?: number): Promise<number> {
  if (requested !== undefined) {
    if (!(await canListen(requested)))
      throw new WorkspaceError("filesystem_error", `Port ${requested} is already in use`);
    return requested;
  }
  for (let port = preferred; port < preferred + 100; port += 1) {
    if (await canListen(port)) return port;
  }
  throw new WorkspaceError(
    "filesystem_error",
    `No available loopback port found near ${preferred}`,
  );
}

async function matchesRunningWorkspace(url: string, options: RunOptions): Promise<boolean> {
  try {
    const response = await fetch(`${url}/api/runtime/workspace`, {
      cache: "no-store",
      signal: AbortSignal.timeout(1_500),
    });
    if (!response.ok) return false;
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object" || !("workspace" in payload)) return false;
    const workspace = payload.workspace;
    if (!workspace || typeof workspace !== "object") return false;
    return (
      "projectRoot" in workspace &&
      "workspaceRoot" in workspace &&
      typeof workspace.projectRoot === "string" &&
      typeof workspace.workspaceRoot === "string" &&
      resolve(workspace.projectRoot) === resolve(options.projectRoot) &&
      resolve(workspace.workspaceRoot) === resolve(options.workspaceRoot)
    );
  } catch {
    return false;
  }
}

function relayRuntimeOutput(child: ChildProcess, onMessage: (message: string) => void): void {
  let pending = "";
  child.stdout?.setEncoding("utf8").on("data", (chunk: string) => {
    pending += chunk;
    const rows = pending.split("\n");
    pending = rows.pop() ?? "";
    for (const row of rows) {
      onMessage(row.replace(/capability=[a-f0-9]+/gi, "capability=[redacted]"));
    }
  });
  child.stderr?.pipe(process.stderr);
}

async function waitFor(url: string, child: ChildProcess, label: string): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new WorkspaceError("filesystem_error", `${label} exited during startup`);
    }
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) return;
    } catch {
      // The process is still starting; retry until the bounded startup deadline.
    }
    await Bun.sleep(150);
  }
  throw new WorkspaceError("filesystem_error", `${label} did not become ready within 30 seconds`);
}

function openInBrowser(url: string, onMessage: (message: string) => void): void {
  const command =
    process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const commandArgs = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  const browser = spawn(command, commandArgs, {
    detached: true,
    stdio: "ignore",
    shell: false,
  });
  browser.once("error", () => onMessage(`Could not open a browser automatically. Visit ${url}`));
  browser.unref();
}

function stop(child: ChildProcess): void {
  if (child.exitCode !== null || child.killed) return;
  child.kill("SIGTERM");
  const timer = setTimeout(() => {
    if (child.exitCode === null) child.kill("SIGKILL");
  }, 5_000);
  timer.unref();
}

export async function runLocalDashboard(
  options: RunOptions,
  moduleDirectory: string,
): Promise<void> {
  const assets = resolveLocalAssets(moduleDirectory);
  const webPort = 5173;
  const url = `http://127.0.0.1:${webPort}`;
  if (!(await canListen(webPort))) {
    if (!(await matchesRunningWorkspace(url, options))) {
      throw new WorkspaceError(
        "filesystem_error",
        "Port 5173 is already serving another app or Task workspace. Stop it before running Task here.",
      );
    }
    options.onMessage(`Task dashboard already running for this workspace · ${url}`);
    if (options.openBrowser) openInBrowser(url, options.onMessage);
    return;
  }
  const runtimePort = await availablePort(4317);
  const bun = process.execPath;
  const runtime = spawn(bun, [assets.runtimeEntry], {
    cwd: options.projectRoot,
    env: {
      ...process.env,
      TASK_WORKSPACE_ROOT: options.workspaceRoot,
      TASK_LOCAL_PORT: String(runtimePort),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  relayRuntimeOutput(runtime, options.onMessage);

  const web = spawn(
    "node",
    [assets.nextEntry, "start", "--hostname", "127.0.0.1", "--port", String(webPort)],
    {
      cwd: assets.dashboardRoot,
      env: {
        ...process.env,
        HOSTNAME: "127.0.0.1",
        PORT: String(webPort),
        TASK_LOCAL_PORT: String(runtimePort),
      },
      stdio: "inherit",
    },
  );

  const closeChildren = (): void => {
    stop(runtime);
    stop(web);
  };
  try {
    await waitFor(`http://127.0.0.1:${runtimePort}/health/ready`, runtime, "Local runtime");
    await waitFor(url, web, "Local dashboard");
    options.onMessage(`Local dashboard ready · ${url}`);
    options.onMessage("Press Ctrl+C to stop the dashboard and local runtime.");
    if (options.openBrowser) openInBrowser(url, options.onMessage);
    await new Promise<void>((resolveRun) => {
      let finished = false;
      const finish = (code: number): void => {
        if (finished) return;
        finished = true;
        process.exitCode = code;
        closeChildren();
        process.off("SIGINT", onInterrupt);
        process.off("SIGTERM", onTerminate);
        resolveRun();
      };
      const onInterrupt = (): void => finish(130);
      const onTerminate = (): void => finish(143);
      runtime.once("exit", (code) => finish(code ?? 1));
      web.once("exit", (code) => finish(code ?? 1));
      process.once("SIGINT", onInterrupt);
      process.once("SIGTERM", onTerminate);
    });
  } catch (error) {
    closeChildren();
    throw error;
  }
}

export function resolveTuiEntry(): string {
  const cliRoot = packageRootFrom(dirname(fileURLToPath(import.meta.url)));
  const bundledEntry = join(cliRoot, "dist/tui-entry.js");
  if (existsSync(bundledEntry)) return bundledEntry;
  return fileURLToPath(import.meta.resolve("@task/tui"));
}
