import {
  lstat,
  mkdir,
  readFile,
  readlink,
  realpath,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const devEntry = join(repositoryRoot, "scripts/taskcode-dev.ts");
const action = process.argv[2] ?? "install";
const commandNames = ["taskcode-dev", "tc-dev"] as const;

if (action !== "install" && action !== "remove") {
  process.stderr.write("Usage: bun run cli:link [install|remove]\n");
  process.exit(2);
}

if (resolve(process.cwd()) !== repositoryRoot) {
  process.stderr.write(`Run this command from the repository root: ${repositoryRoot}\n`);
  process.exit(2);
}

const globalBinResult = Bun.spawnSync(["bun", "pm", "bin", "-g"], { stdout: "pipe" });
if (globalBinResult.exitCode !== 0) {
  process.stderr.write("Could not locate Bun's global executable directory.\n");
  process.exit(globalBinResult.exitCode ?? 1);
}

const globalBin = globalBinResult.stdout.toString().trim();
await mkdir(globalBin, { recursive: true });
const expectedEntry = await realpath(devEntry);
const windows = process.platform === "win32";
const installed: string[] = [];

for (const name of commandNames) {
  const target = join(globalBin, windows ? `${name}.cmd` : name);
  if (windows) {
    const contents = `@echo off\r\n"${process.execPath}" "${devEntry}" %*\r\n`;
    if (action === "install") {
      try {
        if ((await readFile(target, "utf8")) !== contents) {
          process.stderr.write(`Refusing to replace an existing command: ${target}\n`);
          process.exitCode = 1;
          continue;
        }
      } catch {
        try {
          await lstat(target);
          process.stderr.write(`Refusing to replace an existing command: ${target}\n`);
          process.exitCode = 1;
          continue;
        } catch {
          await writeFile(target, contents, { flag: "wx" });
        }
      }
      installed.push(target);
    } else {
      try {
        if ((await Bun.file(target).text()) === contents) {
          await unlink(target);
          installed.push(target);
        }
      } catch {
        // This command was not linked from this checkout.
      }
    }
    continue;
  }

  if (action === "install") {
    try {
      const existing = await lstat(target);
      if (
        !existing.isSymbolicLink() ||
        resolve(dirname(target), await readlink(target)) !== expectedEntry
      ) {
        process.stderr.write(`Refusing to replace an existing command: ${target}\n`);
        process.exitCode = 1;
        continue;
      }
    } catch {
      await symlink(expectedEntry, target);
    }
    installed.push(target);
  } else {
    try {
      if (resolve(dirname(target), await readlink(target)) === expectedEntry) {
        await unlink(target);
        installed.push(target);
      }
    } catch {
      // This command was not linked from this checkout.
    }
  }
}

if (process.exitCode && process.exitCode !== 0) process.exit(process.exitCode);
if (action === "install") {
  process.stdout.write(`Linked ${commandNames.join(" and ")} to ${expectedEntry}.\n`);
  process.stdout.write(`Bun global executable directory: ${globalBin}\n`);
  if (!process.env.PATH?.split(process.platform === "win32" ? ";" : ":").includes(globalBin)) {
    process.stdout.write(`Add this directory to PATH: ${globalBin}\n`);
  }
  process.stdout.write("The published taskcode, task, and tc commands are not changed.\n");
} else {
  process.stdout.write(
    installed.length
      ? `Removed ${installed.map((path) => path.split(/[\\/]/).pop()).join(" and ")}.\n`
      : "No taskcode-dev or tc-dev links from this checkout were found.\n",
  );
}
