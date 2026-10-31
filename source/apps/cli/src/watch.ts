import { watch } from "node:fs";
import { resolve } from "node:path";

const cliRoot = resolve(import.meta.dir, "..");
const watchPaths = [resolve(cliRoot, "src"), resolve(cliRoot, "../../packages/workspace/src")];
const commandArguments = process.argv.slice(2);
let child: ReturnType<typeof Bun.spawn> | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;
let stopping = false;

function runCommand(): void {
  if (stopping) return;
  if (child && child.exitCode === null) child.kill();
  child = Bun.spawn(["bun", "run", resolve(cliRoot, "src/index.ts"), ...commandArguments], {
    cwd: process.cwd(),
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
}

const watchers = watchPaths.map((path) =>
  watch(path, { recursive: true }, (_eventType, _filename) => {
    if (stopping) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(runCommand, 120);
  }),
);

function stop(): void {
  if (stopping) return;
  stopping = true;
  if (timer) clearTimeout(timer);
  for (const watcher of watchers) watcher.close();
  if (child && child.exitCode === null) child.kill();
  process.exit(0);
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
process.stdout.write("Watching CLI and @task/workspace source. Press Ctrl+C to stop.\n");
runCommand();
