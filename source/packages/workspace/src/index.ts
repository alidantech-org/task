export { shouldIgnoreDirectory } from "@task/workspace/discovery/ignore";
export { discoverMarkdown } from "@task/workspace/discovery/scan";
export { classifyDocument } from "@task/workspace/documents/classify";
export { readWorkspaceDocument } from "@task/workspace/documents/read";
export { buildWorkspaceIndex, reconcileWorkspaceIndex } from "@task/workspace/indexing/index";
export type {
  DocumentMetadata,
  DocumentSummary,
  ValidationDiagnostic,
  WorkspaceContext,
  WorkspaceIndex,
} from "@task/workspace/indexing/types";
export { resolveSafeWorkspacePath, resolveWorkspacePath } from "@task/workspace/paths/safe-path";
export type {
  IndexChange,
  IndexChangeListener,
  WatchOptions,
  WorkspaceWatcher,
} from "@task/workspace/watching/watcher";
export { watchWorkspaceIndex } from "@task/workspace/watching/watcher";
