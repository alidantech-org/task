import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const temporaryRoot = await mkdtemp(join(tmpdir(), "task-cli-global-install-"));
const globalPrefix = join(temporaryRoot, "npm-global");
const cliRoot = join(repositoryRoot, "source/apps/cli");

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
  if (!run([taskcodePath, "--version"]).includes("task 0.1.0"))
    throw new Error("Globally installed taskcode command returned an unexpected version");
  if (!run([taskPath, "--version"]).includes("task 0.1.0"))
    throw new Error("Globally installed task command returned an unexpected version");
  if (!run([tcPath, "--version"]).includes("task 0.1.0"))
    throw new Error("Globally installed tc alias returned an unexpected version");

  const projectRoot = join(temporaryRoot, "consumer-project");
  await mkdir(projectRoot, { recursive: true });
  runCli(taskPath, projectRoot, ["init"]);
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
  process.stdout.write(
    "Global install, task/tc bins, workspace init, create, list, and validation passed.\n",
  );
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
