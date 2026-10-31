import type { FileHandle } from "node:fs/promises";
import { lstat, mkdir, open, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { WorkspaceError } from "@task/workspace/errors";

export type InitializeWorkspaceOptions = {
  projectRoot: string;
  workspace?: string;
};

export type InitializedWorkspace = {
  projectRoot: string;
  root: string;
  workspace: string;
  createdWorkspace: boolean;
};

function isWithin(root: string, path: string): boolean {
  const rel = relative(root, path);
  return rel === "" || (!isAbsolute(rel) && rel !== ".." && !rel.startsWith(`..${sep}`));
}

export async function initializeWorkspace(
  options: InitializeWorkspaceOptions,
): Promise<InitializedWorkspace> {
  const projectRoot = await realpath(options.projectRoot);
  const workspace = options.workspace ?? "tasks";
  const workspacePath = resolve(projectRoot, workspace);
  if (!workspace || isAbsolute(workspace) || !isWithin(projectRoot, workspacePath)) {
    throw new WorkspaceError(
      "invalid_input",
      "Workspace must be a non-empty relative path inside the project",
    );
  }

  const configPath = resolve(projectRoot, "task.yaml");
  try {
    await lstat(configPath);
    throw new WorkspaceError("already_exists", `${configPath} already exists; it was not changed`);
  } catch (error) {
    if (error instanceof WorkspaceError) throw error;
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
      throw new WorkspaceError("filesystem_error", `Cannot inspect ${configPath}`, {
        cause: error,
      });
    }
  }

  let createdWorkspace = false;
  const relativeWorkspace = relative(projectRoot, workspacePath);
  let current = projectRoot;
  for (const part of relativeWorkspace.split(sep).filter(Boolean)) {
    current = resolve(current, part);
    try {
      const entry = await lstat(current);
      if (!entry.isDirectory())
        throw new WorkspaceError(
          "path_not_safe",
          `Workspace path component is not a directory: ${current}`,
        );
    } catch (error) {
      if (error instanceof WorkspaceError) throw error;
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT"))
        throw new WorkspaceError("filesystem_error", `Cannot inspect ${current}`, { cause: error });
      await mkdir(current);
      createdWorkspace = true;
    }
  }

  const realWorkspace = await realpath(workspacePath);
  if (!isWithin(projectRoot, realWorkspace) || !(await lstat(realWorkspace)).isDirectory()) {
    throw new WorkspaceError("path_not_safe", "Workspace must be a directory inside the project");
  }
  let file: FileHandle | undefined;
  try {
    file = await open(configPath, "wx", 0o644);
    await file.writeFile(`workspace: ${JSON.stringify(workspace)}\n`, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EEXIST")
      throw new WorkspaceError(
        "already_exists",
        `${configPath} already exists; it was not changed`,
        { cause: error },
      );
    throw new WorkspaceError("filesystem_error", `Cannot create ${configPath}`, { cause: error });
  } finally {
    await file?.close();
  }
  return { projectRoot, root: realWorkspace, workspace, createdWorkspace };
}
