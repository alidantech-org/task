export type WorkspaceErrorCode =
  | "workspace_not_found"
  | "invalid_workspace_config"
  | "invalid_input"
  | "not_found"
  | "already_exists"
  | "validation_failed"
  | "conflict"
  | "path_not_safe"
  | "filesystem_error";

export class WorkspaceError extends Error {
  constructor(
    readonly code: WorkspaceErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "WorkspaceError";
  }
}
