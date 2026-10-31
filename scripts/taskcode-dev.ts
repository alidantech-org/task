#!/usr/bin/env bun

import { spawn } from "node:child_process";
import { join } from "node:path";

const cliEntry = join(import.meta.dir, "../source/apps/cli/src/index.ts");
const child = spawn(process.execPath, [cliEntry, ...process.argv.slice(2)], {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit",
});

child.once("error", (error) => {
  process.stderr.write(`Could not start the Task development CLI: ${error.message}\n`);
  process.exitCode = 1;
});
child.once("exit", (code, signal) => {
  process.exitCode = signal ? 130 : (code ?? 1);
});
