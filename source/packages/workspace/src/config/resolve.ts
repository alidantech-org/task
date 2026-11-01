import { link, lstat, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
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
  if (Object.keys(record).some((key) => key !== "workspace" && key !== "organization")) {
    throw new WorkspaceError(
      "invalid_workspace_config",
      "task.yaml supports workspace and organization fields",
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
  let organization: WorkspaceConfig["organization"];
  if (record.organization !== undefined) {
    if (
      typeof record.organization !== "object" ||
      record.organization === null ||
      Array.isArray(record.organization)
    ) {
      throw new WorkspaceError(
        "invalid_workspace_config",
        "task.yaml organization must be a mapping",
      );
    }
    const options = record.organization as Record<string, unknown>;
    if (Object.keys(options).some((key) => key !== "weekStart" && key !== "autoArchiveAfterDays")) {
      throw new WorkspaceError(
        "invalid_workspace_config",
        "Unsupported organization setting in task.yaml",
      );
    }
    if (
      options.weekStart !== undefined &&
      (!Number.isInteger(options.weekStart) ||
        Number(options.weekStart) < 1 ||
        Number(options.weekStart) > 7)
    ) {
      throw new WorkspaceError(
        "invalid_workspace_config",
        "organization.weekStart must be an integer from 1 (Monday) to 7 (Sunday)",
      );
    }
    if (
      options.autoArchiveAfterDays !== undefined &&
      options.autoArchiveAfterDays !== null &&
      (!Number.isInteger(options.autoArchiveAfterDays) || Number(options.autoArchiveAfterDays) < 0)
    ) {
      throw new WorkspaceError(
        "invalid_workspace_config",
        "organization.autoArchiveAfterDays must be a non-negative integer or null",
      );
    }
    organization = {
      ...(options.weekStart === undefined ? {} : { weekStart: Number(options.weekStart) }),
      ...(options.autoArchiveAfterDays === undefined
        ? {}
        : {
            autoArchiveAfterDays:
              options.autoArchiveAfterDays === null ? null : Number(options.autoArchiveAfterDays),
          }),
    };
  }
  return { workspace, ...(organization ? { organization } : {}) };
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
    let organization: WorkspaceConfig["organization"];
    try {
      const configStat = await lstat(resolve(projectRoot, "task.yaml"));
      if (!configStat.isFile()) {
        throw new WorkspaceError("invalid_workspace_config", "task.yaml must be a regular file");
      }
      organization = (await readConfig(projectRoot)).organization;
    } catch (error) {
      if (error instanceof WorkspaceError) throw error;
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    }
    return {
      root,
      projectRoot,
      config: {
        workspace: relative(projectRoot, root) || ".",
        ...(organization ? { organization } : {}),
      },
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

export async function updateWorkspaceOrganization(
  selected: ResolvedWorkspace,
  organization: NonNullable<WorkspaceConfig["organization"]>,
): Promise<ResolvedWorkspace> {
  if (
    organization.weekStart !== undefined &&
    (!Number.isInteger(organization.weekStart) ||
      organization.weekStart < 1 ||
      organization.weekStart > 7)
  ) {
    throw new WorkspaceError("invalid_input", "Week start must be an integer from 1 to 7");
  }
  if (
    organization.autoArchiveAfterDays !== undefined &&
    organization.autoArchiveAfterDays !== null &&
    (!Number.isInteger(organization.autoArchiveAfterDays) || organization.autoArchiveAfterDays < 0)
  ) {
    throw new WorkspaceError(
      "invalid_input",
      "Auto-archive delay must be a non-negative integer or null",
    );
  }
  const configPath = resolve(selected.projectRoot, "task.yaml");
  let exists = false;
  try {
    const fileStat = await lstat(configPath);
    if (!fileStat.isFile() || fileStat.isSymbolicLink()) {
      throw new WorkspaceError("path_not_safe", "task.yaml must be a regular file");
    }
    exists = true;
    const parsedValue = Bun.YAML.parse(await readFile(configPath, "utf8"));
    if (typeof parsedValue !== "object" || parsedValue === null || Array.isArray(parsedValue)) {
      throw new WorkspaceError("invalid_workspace_config", "task.yaml must contain a YAML mapping");
    }
    const parsed = parsedValue as Record<string, unknown>;
    const currentOrganization =
      typeof parsed.organization === "object" &&
      parsed.organization !== null &&
      !Array.isArray(parsed.organization)
        ? (parsed.organization as Record<string, unknown>)
        : {};
    const selectedOrganization = selected.config.organization ?? {};
    if (
      Object.keys(parsed).some((key) => key !== "workspace" && key !== "organization") ||
      parsed.workspace !== selected.config.workspace ||
      currentOrganization.weekStart !== selectedOrganization.weekStart ||
      currentOrganization.autoArchiveAfterDays !== selectedOrganization.autoArchiveAfterDays
    ) {
      throw new WorkspaceError(
        "conflict",
        "task.yaml changed while saving workspace organization settings",
      );
    }
  } catch (error) {
    if (error instanceof WorkspaceError) throw error;
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    if (selected.source === "task-yaml") {
      throw new WorkspaceError("conflict", "task.yaml was removed while saving workspace settings");
    }
  }
  const weekStart = organization.weekStart ?? selected.config.organization?.weekStart;
  const autoArchiveAfterDays =
    organization.autoArchiveAfterDays === undefined
      ? selected.config.organization?.autoArchiveAfterDays
      : organization.autoArchiveAfterDays;
  const organizationSettings = {
    ...(weekStart === undefined ? {} : { weekStart }),
    ...(autoArchiveAfterDays === undefined ? {} : { autoArchiveAfterDays }),
  };
  const temporary = `${configPath}.${crypto.randomUUID()}.tmp`;
  const lines = [
    `workspace: ${JSON.stringify(selected.config.workspace)}`,
    "organization:",
    ...(organizationSettings.weekStart === undefined
      ? []
      : [`  weekStart: ${organizationSettings.weekStart}`]),
    ...(organizationSettings.autoArchiveAfterDays === undefined
      ? []
      : [
          `  autoArchiveAfterDays: ${organizationSettings.autoArchiveAfterDays === null ? "null" : organizationSettings.autoArchiveAfterDays}`,
        ]),
  ];
  await writeFile(temporary, `${lines.join("\n")}\n`, { encoding: "utf8", flag: "wx" });
  if (exists) {
    await rename(temporary, configPath).catch(async (error: unknown) => {
      await rm(temporary, { force: true });
      throw error;
    });
  } else {
    await link(temporary, configPath).catch(async (error: unknown) => {
      await rm(temporary, { force: true });
      if (error instanceof Error && "code" in error && error.code === "EEXIST") {
        throw new WorkspaceError(
          "conflict",
          "task.yaml was created while saving workspace settings",
        );
      }
      throw error;
    });
    await rm(temporary, { force: true });
  }
  return { ...selected, config: { ...selected.config, organization: organizationSettings } };
}
