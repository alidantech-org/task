#!/usr/bin/env bun

import pc from "picocolors";

const version = "0.1.0";
const args = process.argv.slice(2);
const json = args.includes("--json");
const command = args.find((arg) => !arg.startsWith("-"));

function printHelp(): void {
  const line = pc.dim("────────────────────────────────────────────────────────────");
  console.log();
  console.log(pc.bold(pc.cyan("  ▄▄▄  ▄▄▄  ▄▄▄▄  ▄▄▄▄")));
  console.log(pc.bold(pc.cyan("  █  █ █  █ █  █  █  █")) + pc.dim("  v" + version));
  console.log(pc.bold("  TASK") + pc.dim("  Your work, organised."));
  console.log();
  console.log(line);
  console.log(pc.bold("  USAGE"));
  console.log("  " + pc.cyan("task") + " " + pc.dim("<command> [options]"));
  console.log("  " + pc.cyan("tk") + "   " + pc.dim("<command> [options]"));
  console.log();
  console.log(pc.bold("  GLOBAL OPTIONS"));
  console.log("  " + pc.green("-h, --help") + "       Show this help");
  console.log("  " + pc.green("-v, --version") + "    Show the installed version");
  console.log("  " + pc.green("--json") + "           Print machine-readable command metadata");
  console.log();
  console.log(pc.bold("  INTERFACES"));
  console.log("  " + pc.cyan("task") + "             Scriptable CLI for people and agents");
  console.log("  " + pc.cyan("task run") + "         Start the local workspace experience (planned)");
  console.log("  " + pc.cyan("task tui") + "         Open the interactive terminal workspace (planned)");
  console.log();
  console.log(pc.dim("  Workspace commands are being implemented in phases."));
  console.log(pc.dim("  Local commands will work offline and without the dashboard server."));
  console.log(line);
  console.log();
}

if (json) {
  console.log(JSON.stringify({
    name: "task",
    version,
    aliases: ["task", "tk"],
    status: "foundation",
    commands: [],
    message: "Workspace commands are being implemented.",
  }, null, 2));
} else if (args.includes("--version") || args.includes("-v")) {
  console.log("task " + version);
} else if (command === undefined || args.includes("--help") || args.includes("-h")) {
  printHelp();
} else {
  console.error(pc.red("✖ Unknown command: " + command));
  console.error(pc.dim("  Run 'task --help' to see available options."));
  process.exitCode = 1;
}
