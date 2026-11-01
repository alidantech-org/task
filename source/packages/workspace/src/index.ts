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
export type {
  Checklist,
  ChecklistGroup,
  ChecklistItem,
  ChecklistSelector,
} from "@task/workspace/documents/checklist";
export {
  checklistProgress,
  parseChecklist,
  setChecklistItems,
} from "@task/workspace/documents/checklist";
export { classifyDocument } from "@task/workspace/documents/classify";
export type { TaskComment } from "@task/workspace/documents/comments";
export {
  appendComment,
  mentionsOf,
  parseComments,
  removeComment,
} from "@task/workspace/documents/comments";
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
  Attachment,
  DocumentCreateInput,
  DocumentMetadata,
  DocumentSummary,
  IdentityConfig,
  QualityConfig,
  QualityMode,
  Recurrence,
  ResolvedWorkspace,
  TaskCreateInput,
  TaskExtra,
  TaskGroup,
  TaskLink,
  TaskLinkType,
  TaskPriority,
  TaskStatus,
  TaskStatusChange,
  TaskUpdateInput,
  TrackingConfig,
  ValidationCategory,
  ValidationDiagnostic,
  WorkspaceConfig,
  WorkspaceContext,
  WorkspaceIndex,
} from "@task/workspace/indexing/types";
export type { LinkContext, LinkTarget } from "@task/workspace/links/resolve";
export { resolveLink } from "@task/workspace/links/resolve";
export type { ActivityEntry } from "@task/workspace/operations/activity";
export { buildActivity } from "@task/workspace/operations/activity";
export {
  addFileAttachment,
  addLinkAttachment,
  maxAttachmentBytes,
  readAttachment,
  removeAttachment,
  sanitizeFileName,
} from "@task/workspace/operations/attachments";
export type { BulkPatch, BulkResult } from "@task/workspace/operations/bulk";
export { bulkUpdateTasks } from "@task/workspace/operations/bulk";
export { readDocumentChecklist } from "@task/workspace/operations/checklist";
export {
  addTaskComment,
  deleteTaskComment,
  listTaskComments,
  resolveAuthor,
} from "@task/workspace/operations/comment-ops";
export type { DeleteOptions, TrashEntry, TrashKind } from "@task/workspace/operations/delete";
export {
  deleteDocument,
  deleteTask,
  deleteTaskGroup,
  listTrash,
  restoreFromTrash,
} from "@task/workspace/operations/delete";
export { moveTask } from "@task/workspace/operations/move";
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
  setDocumentChecklist,
  updateTask,
} from "@task/workspace/operations/mutate";
export {
  compareTasks,
  effectiveOrder,
  nextOrder,
  orderStep,
  rankBetween,
  sortTasks,
} from "@task/workspace/operations/order";
export type {
  QualityFinding,
  QualityFindingCode,
  ResolvedQuality,
} from "@task/workspace/operations/quality";
export {
  assessGroupDocBody,
  assessTaskBody,
  countWords,
  defaultQuality,
  formatFindings,
  resolveQuality,
} from "@task/workspace/operations/quality";
export {
  groupQualityFindings,
  qualityDiagnostics,
  taskQualityFindings,
} from "@task/workspace/operations/quality-check";
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
export {
  nextDueDate,
  nextOccurrence,
  parseRecurrence,
} from "@task/workspace/operations/recurrence";
export type { ReorderTarget } from "@task/workspace/operations/reorder";
export { reorderTask } from "@task/workspace/operations/reorder";
export type { TaskTemplate, TemplateDefaults } from "@task/workspace/operations/templates";
export {
  createTaskFromTemplate,
  createTemplate,
  listTemplates,
} from "@task/workspace/operations/templates";
export type { ValidationScope } from "@task/workspace/operations/validate";
export { isErrorDiagnostic, validateWorkspace } from "@task/workspace/operations/validate";
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
