#!/usr/bin/env bun

const version = "0.1.0";
const [command] = process.argv.slice(2);

function printHelp(): void {
  console.log(`Task ${version}

Repository-native task management.

Usage:
  task [--help]
  task [--version]

The task and tk commands use this same entry point.
Task commands will be added as their contracts are designed.
`);
}

if (command === "--version" || command === "-v") {
  console.log(`task ${version}`);
} else if (command === undefined || command === "--help" || command === "-h") {
  printHelp();
} else {
  console.error(`Unknown command: ${command}`);
  console.error("Run 'task --help' to see available options.");
  process.exitCode = 1;
}
