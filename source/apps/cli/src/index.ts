#!/usr/bin/env bun

import { intro, outro } from "@clack/prompts";
import pc from "picocolors";
import { getCliMetadata, inspectWorkspace, resolveCommand } from "#/command";

const metadata = getCliMetadata("0.1.0");
const args = process.argv.slice(2);
const json = args.includes("--json");
const command = resolveCommand(args);

function printHelp(): void {
  console.log();
  console.log(pc.bold(pc.cyan("  TASK")) + pc.dim("  Your work, organised."));
  console.log(pc.dim("  A local-first workspace for people and agents."));
  console.log(pc.dim("  Use task doctor to check your Bun runtime."));
  console.log();
  console.log(pc.bold("  USAGE"));
  console.log(`  ${pc.cyan("task")} ${pc.dim("<command> [options]")}`);
  console.log(`  ${pc.cyan("tk")}   ${pc.dim("<command> [options]")}`);
  console.log();
  console.log(pc.bold("  COMMANDS"));
  console.log(`  ${pc.green("doctor")}      Check the local development environment`);
  console.log(`  ${pc.green("help")}        Show command help`);
  console.log(`  ${pc.green("version")}     Show the installed version`);
  console.log();
  console.log(pc.bold("  OPTIONS"));
  console.log(`  ${pc.green("-h, --help")}       Show help`);
  console.log(`  ${pc.green("-v, --version")}    Show version`);
  console.log(`  ${pc.green("--json")}           Print machine-readable metadata`);
  console.log();
}

async function main(): Promise<void> {
  if (json) {
    console.log(JSON.stringify(metadata, null, 2));
    return;
  }

  if (args.includes("--version") || args.includes("-v") || command === "version") {
    console.log(`task ${metadata.version}`);
    return;
  }

  if (
    command === undefined ||
    args.includes("--help") ||
    args.includes("-h") ||
    command === "help"
  ) {
    printHelp();
    return;
  }

  if (command === "doctor") {
    intro(pc.bold("Task environment check"));
    const [major = 0, minor = 0, patch = 0] = Bun.version.split(".").map(Number);
    const compatible = major > 1 || (major === 1 && (minor > 3 || (minor === 3 && patch >= 14)));
    console.log(compatible ? pc.green("✓") : pc.red("✗"), `Bun ${Bun.version}`);
    console.log(pc.green("✓"), "CLI entry point is running");
    console.log(pc.green("✓"), `Platform ${process.platform} · ${process.arch}`);
    const workspaceRoot = process.env.TASK_WORKSPACE_ROOT;
    if (workspaceRoot) {
      const summary = await inspectWorkspace(workspaceRoot);
      console.log(pc.green("✓"), `Indexed ${summary.documents} documents`);
      if (summary.invalid > 0) {
        console.log(pc.yellow("!"), `${summary.invalid} document(s) have invalid frontmatter`);
      }
    }
    outro(compatible ? "Environment checks passed." : "Upgrade Bun to 1.3.14 or later.");
    if (!compatible) process.exitCode = 1;
    return;
  }

  console.error(pc.red(`✖ Unknown command: ${command}`));
  console.error(pc.dim("  Run 'task --help' to see available commands."));
  process.exitCode = 1;
}

await main();
