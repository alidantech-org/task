const args = process.argv.slice(2);

if (args.length === 0) {
  process.stderr.write("Usage: bun run scripts/flutter.ts <flutter command> [arguments...]\n");
  process.exit(2);
}

const result = Bun.spawnSync({
  cmd: ["flutter", ...args],
  cwd: "source/apps/mobile",
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
});

process.exit(result.exitCode ?? 1);
