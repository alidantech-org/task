const supportedBun = [1, 3, 14] as const;
const actualBun = Bun.version.split(".").map(Number);
const isSupportedBun =
  (actualBun[0] ?? 0) > supportedBun[0] ||
  ((actualBun[0] ?? 0) === supportedBun[0] &&
    ((actualBun[1] ?? 0) > supportedBun[1] ||
      ((actualBun[1] ?? 0) === supportedBun[1] && (actualBun[2] ?? 0) >= supportedBun[2])));

const arguments_ = process.argv.slice(2);
const linkCli = arguments_.includes("--link-cli");
const unsupported = arguments_.filter((argument) => argument !== "--link-cli");

if (!isSupportedBun) {
  process.stderr.write(
    `Task requires Bun ${supportedBun.join(".")} or later; found ${Bun.version}.\n`,
  );
  process.exit(1);
}

if (unsupported.length) {
  process.stderr.write(
    `Unknown setup option: ${unsupported.join(" ")}\nUsage: bun run setup [--link-cli]\n`,
  );
  process.exit(2);
}

try {
  const node = Bun.spawnSync({ cmd: ["node", "--version"], stdout: "pipe", stderr: "pipe" });
  const version = /^v?(\d+)\.(\d+)\.(\d+)/.exec(node.stdout.toString().trim());
  const major = Number(version?.[1]);
  const minor = Number(version?.[2]);
  if (node.exitCode !== 0 || !version || major < 20 || (major === 20 && minor < 9)) {
    process.stderr.write(
      `Node.js 20.9 or later is required for the web applications. Install a supported Node.js release, add node to PATH, then rerun bun run setup.\n`,
    );
    process.exit(1);
  }
} catch (error) {
  process.stderr.write(
    `Node.js 20.9 or later is required for the web applications. Install a supported Node.js release, add node to PATH, then rerun bun run setup.\n${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
}

try {
  const flutter = Bun.spawnSync({
    cmd: ["flutter", "--version", "--machine"],
    stdout: "pipe",
    stderr: "pipe",
  });
  if (flutter.exitCode !== 0) {
    const detail = flutter.stderr.toString().trim();
    process.stderr.write(
      `Flutter is required to set up all repository projects. Install the Flutter SDK, add flutter to PATH, then rerun bun run setup.${detail ? `\n${detail}` : ""}\n`,
    );
    process.exit(1);
  }
} catch (error) {
  process.stderr.write(
    `Flutter is required to set up all repository projects. Install the Flutter SDK, add flutter to PATH, then rerun bun run setup.\n${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
}

function run(label: string, command: string[]): void {
  process.stdout.write(`\n› ${label}\n`);
  const result = Bun.spawnSync({
    cmd: command,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  if (result.exitCode !== 0) {
    process.stderr.write(
      `\nSetup stopped: ${label} failed with exit code ${result.exitCode ?? 1}.\n`,
    );
    process.exit(result.exitCode ?? 1);
  }
}

run("Install Bun workspace dependencies", ["bun", "install"]);
run("Resolve Flutter mobile dependencies", ["bun", "run", "mobile:pub:get"]);

if (linkCli) run("Link task and tk globally to this checkout", ["bun", "run", "cli:link"]);

process.stdout.write(
  "\nTask repository setup is complete. Start the web/API stack with bun dev.\n",
);
