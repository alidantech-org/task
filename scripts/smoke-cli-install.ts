import { type ChildProcess, spawn } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const temporaryRoot = await mkdtemp(join(tmpdir(), "task-cli-global-install-"));
const globalPrefix = join(temporaryRoot, "npm-global");
const cliRoot = join(repositoryRoot, "source/apps/cli");
const packageManifest = JSON.parse(await Bun.file(join(cliRoot, "package.json")).text()) as {
  version: string;
};

function run(command: string[], cwd = repositoryRoot): string {
  const result = Bun.spawnSync({ cmd: command, cwd, stdout: "pipe", stderr: "pipe" });
  if (result.exitCode !== 0) {
    throw new Error(
      `${command.join(" ")} failed.\n${result.stderr.toString()}${result.stdout.toString()}`,
    );
  }
  return result.stdout.toString();
}

function runCli(taskPath: string, projectRoot: string, args: string[]): string {
  return run([taskPath, ...args], projectRoot);
}

async function stop(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise<void>((resolveExit) => child.once("exit", () => resolveExit()));
  child.kill("SIGTERM");
  const timer = setTimeout(() => {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
  }, 5_000);
  timer.unref();
  await exited;
}

async function smokeInstalledDashboard(taskPath: string, projectRoot: string): Promise<void> {
  const child = spawn(taskPath, ["run", "--no-open"], {
    cwd: projectRoot,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  let errors = "";
  child.stdout?.setEncoding("utf8").on("data", (chunk: string) => (output += chunk));
  child.stderr?.setEncoding("utf8").on("data", (chunk: string) => (errors += chunk));
  try {
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      if (child.exitCode !== null || child.signalCode !== null) {
        throw new Error(`Installed task run exited early.\n${errors || output}`);
      }
      const url = output.match(/Local dashboard ready[^\n]*(http:\/\/127\.0\.0\.1:\d+)/)?.[1];
      if (url) {
        try {
          const page = await fetch(url, { signal: AbortSignal.timeout(1_000) });
          if (page.ok) {
            const html = await page.text();
            if (!html.includes("Workspace overview")) {
              throw new Error("Installed task run served an unexpected dashboard page");
            }
            const workspaceResponse = await fetch(`${url}/api/runtime/workspace`);
            if (!workspaceResponse.ok) {
              throw new Error("Installed dashboard could not connect to its local runtime");
            }
            const payload: unknown = await workspaceResponse.json();
            if (
              !payload ||
              typeof payload !== "object" ||
              !("workspace" in payload) ||
              !payload.workspace ||
              typeof payload.workspace !== "object" ||
              !("projectRoot" in payload.workspace) ||
              payload.workspace.projectRoot !== projectRoot
            ) {
              throw new Error("Installed dashboard connected to the wrong workspace");
            }
            process.stdout.write("Installed task run and dashboard smoke test passed.\n");
            return;
          }
        } catch (error) {
          if (error instanceof Error && error.message.startsWith("Installed dashboard"))
            throw error;
        }
      }
      await Bun.sleep(150);
    }
    throw new Error(`Installed task run did not start its dashboard.\n${errors || output}`);
  } finally {
    await stop(child);
  }
}

function smokeInstalledTui(taskPath: string, projectRoot: string): void {
  if (process.platform === "win32") {
    process.stdout.write("TUI PTY smoke test skipped on Windows.\n");
    return;
  }
  const python = Bun.spawnSync(["python3", "--version"], { stdout: "ignore", stderr: "ignore" });
  if (python.exitCode !== 0) {
    process.stdout.write("TUI PTY smoke test skipped because python3 is unavailable.\n");
    return;
  }
  const script = `import errno, os, pty, select, signal, sys, time
task_path, project_root = sys.argv[1:3]
pid, master = pty.fork()
if pid == 0:
    os.chdir(project_root)
    env = os.environ.copy()
    env["TERM"] = "xterm-256color"
    env["COLUMNS"] = "100"
    env["LINES"] = "30"
    os.execvpe(task_path, [task_path, "tui"], env)
output = bytearray()
sent_quit = False
status = None
deadline = time.monotonic() + 20
while time.monotonic() < deadline:
    ready, _, _ = select.select([master], [], [], 0.1)
    if ready:
        try:
            chunk = os.read(master, 65536)
        except OSError as error:
            if error.errno == errno.EIO:
                break
            raise
        if not chunk:
            break
        output.extend(chunk)
        if not sent_quit and b"TASKS" in output.upper():
            os.write(master, b"q")
            sent_quit = True
    waited, child_status = os.waitpid(pid, os.WNOHANG)
    if waited:
        status = child_status
        break
if status is None:
    waited, status = os.waitpid(pid, os.WNOHANG)
    if not waited:
        try:
            os.kill(pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
        _, status = os.waitpid(pid, 0)
text = output.decode(errors="replace")
if not sent_quit or os.waitstatus_to_exitcode(status) != 0 or "tasks" not in text.lower() or "TypeError" in text:
    sys.stderr.write(text[-4000:])
    raise SystemExit("Installed TUI failed its PTY smoke test")
print("Installed TUI PTY smoke test passed.")`;
  const result = Bun.spawnSync(["python3", "-c", script, taskPath, projectRoot], {
    cwd: projectRoot,
    env: process.env,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) {
    throw new Error(`${result.stderr.toString()}${result.stdout.toString()}`);
  }
  process.stdout.write(result.stdout.toString());
}

try {
  const output = run(
    ["npm", "pack", "--ignore-scripts", "--pack-destination", temporaryRoot, "--json"],
    cliRoot,
  );
  const packed = JSON.parse(output) as Array<{ filename: string }>;
  const filename = packed[0]?.filename;
  if (!filename) throw new Error("npm did not produce a package archive for taskcode");

  await mkdir(globalPrefix, { recursive: true });
  run([
    "npm",
    "install",
    "--global",
    "--prefix",
    globalPrefix,
    "--ignore-scripts",
    join(temporaryRoot, filename),
  ]);

  const globalBin = join(globalPrefix, "bin");
  const taskPath = join(globalBin, process.platform === "win32" ? "task.cmd" : "task");
  const tcPath = join(globalBin, process.platform === "win32" ? "tc.cmd" : "tc");
  const taskcodePath = join(globalBin, process.platform === "win32" ? "taskcode.cmd" : "taskcode");
  if (!run([taskcodePath, "--version"]).includes(`task ${packageManifest.version}`))
    throw new Error("Globally installed taskcode command returned an unexpected version");
  if (!run([taskPath, "--version"]).includes(`task ${packageManifest.version}`))
    throw new Error("Globally installed task command returned an unexpected version");
  if (!run([tcPath, "--version"]).includes(`task ${packageManifest.version}`))
    throw new Error("Globally installed tc alias returned an unexpected version");

  const projectRoot = join(temporaryRoot, "consumer-project");
  await mkdir(projectRoot, { recursive: true });
  runCli(taskPath, projectRoot, ["init"]);
  await Bun.write(join(projectRoot, "task.yaml"), 'workspace: "tasks"\nquality:\n  mode: off\n');
  const group = JSON.parse(
    runCli(taskPath, projectRoot, ["group", "create", "--title", "Install smoke", "--json"]),
  ) as { id: string };
  const created = JSON.parse(
    runCli(taskPath, projectRoot, [
      "create",
      "--group",
      group.id,
      "--title",
      "Installed task",
      "--json",
    ]),
  ) as { id: string };
  const rows = JSON.parse(runCli(taskPath, projectRoot, ["list", "--json"])) as Array<{
    id: string;
  }>;
  if (!rows.some((row) => row.id === created.id))
    throw new Error("Globally installed task command could not query its created task");
  const validation = JSON.parse(runCli(taskPath, projectRoot, ["validate", "--json"])) as {
    valid: boolean;
  };
  if (!validation.valid) throw new Error("Fresh installed workspace did not validate cleanly");
  await smokeInstalledDashboard(taskPath, projectRoot);
  smokeInstalledTui(taskPath, projectRoot);
  process.stdout.write(
    "Global install, task/tc bins, workspace operations, dashboard, and TUI smoke checks passed.\n",
  );
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
