export { resolveWorkspace } from "@task/workspace/config/resolve";
export { shouldIgnoreDirectory } from "@task/workspace/discovery/ignore";
export { discoverMarkdown } from "@task/workspace/discovery/scan";
export { classifyDocument } from "@task/workspace/documents/classify";
export { readWorkspaceDocument } from "@task/workspace/documents/read";
export { WorkspaceError } from "@task/workspace/errors";
export { buildWorkspaceIndex, reconcileWorkspaceIndex } from "@task/workspace/indexing/index";
export type {
  DocumentCreateInput,
  DocumentMetadata,
  DocumentSummary,
  ResolvedWorkspace,
  TaskCreateInput,
  TaskGroup,
  TaskPriority,
  TaskStatus,
  TaskUpdateInput,
  ValidationCategory,
  ValidationDiagnostic,
  WorkspaceConfig,
  WorkspaceContext,
  WorkspaceIndex,
} from "@task/workspace/indexing/types";
export {
  archiveTaskGroup,
  createDocument,
  createTask,
  createTaskGroup,
  replaceDocumentBody,
  restoreTaskGroup,
  updateTask,
} from "@task/workspace/operations/mutate";
export type { TaskFilters } from "@task/workspace/operations/query";
export {
  findDocument,
  findGroup,
  getDocument,
  getWorkspaceOverview,
  listDocuments,
  listTaskGroups,
  listTasks,
  listWorkspaceTree,
  readWorkspaceIndex,
  searchWorkspace,
} from "@task/workspace/operations/query";
export type { ValidationScope } from "@task/workspace/operations/validate";
export { validateWorkspace } from "@task/workspace/operations/validate";
export { resolveSafeWorkspacePath, resolveWorkspacePath } from "@task/workspace/paths/safe-path";
export type {
  IndexChange,
  IndexChangeListener,
  WatchOptions,
  WorkspaceWatcher,
} from "@task/workspace/watching/watcher";
export { watchWorkspaceIndex } from "@task/workspace/watching/watcher";
