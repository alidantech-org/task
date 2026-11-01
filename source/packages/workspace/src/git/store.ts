import { createHash } from "node:crypto";
import { lstat, mkdir, open, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import { homedir, platform } from "node:os";
import { join, resolve } from "node:path";
import { WorkspaceError } from "@task/workspace/errors";
import { runGit } from "@task/workspace/git/run";

const excludePatterns = [
  ".git/",
  "node_modules/",
  ".next/",
  "dist/",
  "build/",
  "coverage/",
  ".turbo/",
  ".cache/",
  ".dart_tool/",
  "target/",
  "__pycache__/",
  ".venv/",
  "*.log",
  ".DS_Store",
];

/** Base directory for Task's own data; never inside a project. */
export function dataDirectory(): string {
  const override = process.env.TASK_DATA_DIR;
  if (override) return resolve(override);
  if (platform() === "darwin") return join(homedir(), "Library", "Application Support", "taskcode");
  if (platform() === "win32")
    return join(process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local"), "taskcode");
  return join(process.env.XDG_DATA_HOME || join(homedir(), ".local", "share"), "taskcode");
}

async function privateDirectory(path: string): Promise<void> {
  try {
    const info = await lstat(path);
    if (info.isSymbolicLink() || !info.isDirectory())
      throw new WorkspaceError(
        "path_not_safe",
        `Tracking storage path is not a plain directory: ${path}`,
      );
    return;
  } catch (error) {
    if (error instanceof WorkspaceError) throw error;
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  await mkdir(path, { mode: 0o700 });
}

async function withInitLock<T>(directory: string, callback: () => Promise<T>): Promise<T> {
  const lockPath = join(directory, ".init.lock");
  const deadline = Date.now() + 5_000;
  while (true) {
    try {
      const handle = await open(lockPath, "wx", 0o600);
      await handle.close();
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const age =
        Date.now() - (await stat(lockPath).catch(() => ({ mtimeMs: Date.now() }))).mtimeMs;
      if (age > 60_000) await rm(lockPath, { force: true });
      else if (Date.now() > deadline)
        throw new WorkspaceError("filesystem_error", "Tracking storage is busy; try again");
      else await new Promise((done) => setTimeout(done, 50));
    }
  }
  try {
    return await callback();
  } finally {
    await rm(lockPath, { force: true });
  }
}

export type PrivateStore = { gitDir: string; projectRoot: string };

/**
 * Returns the private bare git repository that holds task snapshots for a project, creating it with
 * restrictive permissions on first use. Nothing is ever written inside the project.
 */
export async function ensureStore(projectRoot: string): Promise<PrivateStore> {
  const realProject = await realpath(projectRoot);
  const base = dataDirectory();
  await mkdir(base, { recursive: true, mode: 0o700 });
  const realBase = await realpath(base);
  const projects = join(realBase, "projects");
  await privateDirectory(projects);
  const directory = join(
    projects,
    createHash("sha256").update(realProject).digest("hex").slice(0, 16),
  );
  await privateDirectory(directory);
  const gitDir = join(directory, "store.git");
  await withInitLock(directory, async () => {
    let initialised = false;
    try {
      const info = await lstat(gitDir);
      if (info.isSymbolicLink() || !info.isDirectory())
        throw new WorkspaceError("path_not_safe", "Tracking store is not a plain directory");
      initialised = true;
    } catch (error) {
      if (error instanceof WorkspaceError) throw error;
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    if (!initialised) {
      const result = await runGit(directory, ["init", "--bare", "-q", gitDir], {
        env: { GIT_CONFIG_NOSYSTEM: "1" },
      });
      if (result.code !== 0)
        throw new WorkspaceError(
          "filesystem_error",
          result.code === 127
            ? "Change tracking needs the git executable"
            : `Cannot create the tracking store: ${result.stderr.trim()}`,
        );
      await writeFile(join(directory, "project.txt"), `${realProject}\n`, { mode: 0o600 });
    }
    const exclude = join(gitDir, "info", "exclude");
    await mkdir(join(gitDir, "info"), { recursive: true, mode: 0o700 });
    const temporary = `${exclude}.${process.pid}.tmp`;
    await writeFile(temporary, `${excludePatterns.join("\n")}\n`, { mode: 0o600 });
    await rename(temporary, exclude);
  });
  return { gitDir, projectRoot: realProject };
}
