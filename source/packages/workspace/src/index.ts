export { resolveWorkspace, updateWorkspaceOrganization } from "@task/workspace/config/resolve";
export type {
  InitializedWorkspace,
  InitializeWorkspaceOptions,
} from "@task/workspace/config/setup";
export { initializeWorkspace } from "@task/workspace/config/setup";
export type { DiffFile, DiffHunk, DiffLine } from "@task/workspace/diff/parse";
export { parseUnifiedDiff } from "@task/workspace/diff/parse";
export { shouldIgnoreDirectory } from "@task/workspace/discovery/ignore";
export { discoverMarkdown } from "@task/workspace/discovery/scan";
export { classifyDocument } from "@task/workspace/documents/classify";
export { readWorkspaceDocument } from "@task/workspace/documents/read";
export { WorkspaceError } from "@task/workspace/errors";
export { languageForPath } from "@task/workspace/files/language";
export type { ProjectFile } from "@task/workspace/files/read";
export { maxProjectFileBytes, readProjectFile } from "@task/workspace/files/read";
export { isDeniedPath } from "@task/workspace/git/deny";
export type { FileChange, SegmentChanges, TaskChanges } from "@task/workspace/git/tracking";
export {
  endTracking,
  findGitRoot,
  getTaskChanges,
  getTaskFileDiff,
  startTracking,
} from "@task/workspace/git/tracking";
export { buildWorkspaceIndex, reconcileWorkspaceIndex } from "@task/workspace/indexing/index";
export type {
  DocumentCreateInput,
  DocumentMetadata,
  DocumentSummary,
  ResolvedWorkspace,
  TaskCreateInput,
  TaskExtra,
  TaskGroup,
  TaskPriority,
  TaskStatus,
  TaskStatusChange,
  TaskUpdateInput,
  ValidationCategory,
  ValidationDiagnostic,
  WorkspaceConfig,
  WorkspaceContext,
  WorkspaceIndex,
} from "@task/workspace/indexing/types";
export type { LinkContext, LinkTarget } from "@task/workspace/links/resolve";
export { resolveLink } from "@task/workspace/links/resolve";
export type { DeleteOptions, TrashEntry, TrashKind } from "@task/workspace/operations/delete";
export {
  deleteDocument,
  deleteTask,
  deleteTaskGroup,
  listTrash,
  restoreFromTrash,
} from "@task/workspace/operations/delete";
export {
  archiveTask,
  archiveTaskGroup,
  autoArchiveResolvedGroups,
  createDocument,
  createTask,
  createTaskGroup,
  getTaskGroupWeekPath,
  migrateLegacyGroups,
  replaceDocumentBody,
  restoreTask,
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
export type { SelfDocumentationResult } from "@task/workspace/project/self-docs";
export { writeSelfDocumentation } from "@task/workspace/project/self-docs";
export type {
  ProjectFact,
  ProjectFinding,
  ProjectInspection,
  ProjectSetupPlan,
  SetupChange,
  SetupSelection,
} from "@task/workspace/project/setup";
export {
  applyProjectSetupPlan,
  createProjectSetupPlan,
  inspectProject,
} from "@task/workspace/project/setup";
export type {
  IndexChange,
  IndexChangeListener,
  WatchOptions,
  WorkspaceWatcher,
} from "@task/workspace/watching/watcher";
export { watchWorkspaceIndex } from "@task/workspace/watching/watcher";
