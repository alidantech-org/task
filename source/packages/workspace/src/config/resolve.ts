import { lstat, readFile, realpath } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { WorkspaceError } from "@task/workspace/errors";
import type { ResolvedWorkspace, WorkspaceConfig } from "@task/workspace/indexing/types";

type ResolveWorkspaceOptions = {
  cwd?: string;
  workspaceOverride?: string;
  environmentWorkspaceRoot?: string;
};

function isWithin(root: string, path: string): boolean {
  const rel = relative(root, path);
  return rel === "" || (!isAbsolute(rel) && rel !== ".." && !rel.startsWith(`..${sep}`));
}

async function directory(path: string): Promise<boolean> {
  try {
    return (await lstat(path)).isDirectory();
  } catch {
    return false;
  }
}

async function readConfig(projectRoot: string): Promise<WorkspaceConfig> {
  const configPath = resolve(projectRoot, "task.yaml");
  let parsed: unknown;
  try {
    parsed = Bun.YAML.parse(await readFile(configPath, "utf8"));
  } catch (error) {
    throw new WorkspaceError("invalid_workspace_config", `Cannot parse ${configPath}`, {
      cause: error,
    });
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new WorkspaceError("invalid_workspace_config", "task.yaml must contain a YAML mapping");
  }
  const record = parsed as Record<string, unknown>;
  if (Object.keys(record).some((key) => key !== "workspace")) {
    throw new WorkspaceError(
      "invalid_workspace_config",
      "task.yaml currently supports only the workspace field",
    );
  }
  if (record.workspace !== undefined && typeof record.workspace !== "string") {
    throw new WorkspaceError(
      "invalid_workspace_config",
      "task.yaml workspace must be a relative path",
    );
  }
  const workspace = (record.workspace as string | undefined) ?? "tasks";
  if (!workspace || isAbsolute(workspace)) {
    throw new WorkspaceError(
      "invalid_workspace_config",
      "task.yaml workspace must be a non-empty relative path",
    );
  }
  const target = resolve(projectRoot, workspace);
  if (!isWithin(resolve(projectRoot), target)) {
    throw new WorkspaceError(
      "invalid_workspace_config",
      "task.yaml workspace must stay inside the project root",
    );
  }
  return { workspace };
}

async function result(
  projectRoot: string,
  config: WorkspaceConfig,
  source: ResolvedWorkspace["source"],
): Promise<ResolvedWorkspace> {
  const project = await realpath(projectRoot);
  const root = await realpath(resolve(project, config.workspace));
  if (!isWithin(project, root) || !(await directory(root))) {
    throw new WorkspaceError(
      "invalid_workspace_config",
      "Configured workspace is not a directory inside the project",
    );
  }
  return { root, projectRoot: project, config, source };
}

export async function resolveWorkspace(
  options: ResolveWorkspaceOptions = {},
): Promise<ResolvedWorkspace> {
  const direct = options.workspaceOverride ?? options.environmentWorkspaceRoot;
  if (direct) {
    let root: string;
    try {
      root = await realpath(resolve(options.cwd ?? process.cwd(), direct));
    } catch (error) {
      throw new WorkspaceError(
        "workspace_not_found",
        `Workspace directory does not exist: ${direct}`,
        { cause: error },
      );
    }
    if (!(await directory(root)))
      throw new WorkspaceError(
        "workspace_not_found",
        `Workspace path is not a directory: ${direct}`,
      );
    const projectRoot = dirname(root);
    return {
      root,
      projectRoot,
      config: { workspace: relative(projectRoot, root) || "." },
      source: options.workspaceOverride ? "argument" : "environment",
    };
  }

  let candidate = resolve(options.cwd ?? process.cwd());
  while (true) {
    const configPath = resolve(candidate, "task.yaml");
    let hasConfig = false;
    try {
      const configStat = await lstat(configPath);
      if (!configStat.isFile())
        throw new WorkspaceError(
          "invalid_workspace_config",
          `${configPath} must be a regular file`,
        );
      hasConfig = true;
    } catch (error) {
      if (error instanceof WorkspaceError) throw error;
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
        throw new WorkspaceError("invalid_workspace_config", `Cannot inspect ${configPath}`, {
          cause: error,
        });
      }
    }
    if (hasConfig) {
      const config = await readConfig(candidate);
      return await result(candidate, config, "task-yaml");
    }
    const defaultRoot = resolve(candidate, "tasks");
    if (await directory(defaultRoot)) {
      return await result(candidate, { workspace: "tasks" }, "default");
    }
    const parent = dirname(candidate);
    if (parent === candidate) break;
    candidate = parent;
  }
  throw new WorkspaceError(
    "workspace_not_found",
    "No Task workspace found. Run from a project with task.yaml or tasks/, or pass --workspace <path>.",
  );
}
