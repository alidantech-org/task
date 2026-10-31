import { realpath } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cliPackage = join(repositoryRoot, "source/apps/cli");
const action = process.argv[2] ?? "install";

if (action !== "install" && action !== "remove") {
  process.stderr.write("Usage: bun run cli:link [install|remove]\n");
  process.exit(2);
}

const currentDirectory = await realpath(process.cwd());
const expectedCliPackage = await realpath(cliPackage);
if (currentDirectory !== repositoryRoot) {
  process.stderr.write(`Run this command from the repository root: ${repositoryRoot}\n`);
  process.exit(2);
}

const result = Bun.spawnSync(action === "install" ? ["bun", "link"] : ["bun", "unlink"], {
  cwd: expectedCliPackage,
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
});

if (result.exitCode !== 0) process.exit(result.exitCode ?? 1);
if (action === "install") {
  const globalBin = Bun.spawnSync(["bun", "pm", "bin", "-g"], { stdout: "pipe" });
  const binPath = globalBin.stdout.toString().trim();
  process.stdout.write(`Linked task and tk from ${expectedCliPackage}.\n`);
  process.stdout.write(`Bun global executable directory: ${binPath}\n`);
  if (!process.env.PATH?.split(":").includes(binPath)) {
    process.stdout.write(`Add this to your shell startup PATH: export PATH="${binPath}:$PATH"\n`);
  }
  process.stdout.write("These commands execute the live source in this checkout.\n");
} else {
  process.stdout.write("Removed the global task/tk link for this checkout.\n");
}
