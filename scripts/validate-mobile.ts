const commands = [
  ["flutter", "analyze"],
  ["flutter", "test"],
] as const;

for (const command of commands) {
  process.stdout.write(`\n> ${command.join(" ")}\n`);
  const result = Bun.spawnSync({
    cmd: [...command],
    cwd: "source/apps/mobile",
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });

  if (result.exitCode !== 0) {
    process.exit(result.exitCode ?? 1);
  }
}
