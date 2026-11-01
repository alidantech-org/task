export type WorkspaceContext = {
  root: string;
  projectRoot?: string;
  config?: WorkspaceConfig;
};
export type TaskStatus = "planned" | "in-progress" | "blocked" | "completed" | "archived";
export type TaskStatusChange = { from: TaskStatus; to: TaskStatus; at: string };
export type TaskPriority = "low" | "medium" | "high";
export type TrackingSummary = { files: number; insertions: number; deletions: number };
export type TrackingSegment = {
  base_ref: string;
  base_commit?: string;
  started_at: string;
  end_ref?: string;
  ended_at?: string;
  end_error?: string;
  /** The snapshot skipped files because of size or count limits. */
  truncated?: boolean;
  summary?: TrackingSummary;
};
export type TaskTracking = { segments: readonly TrackingSegment[] };
export type TaskExtra = Readonly<
  Record<string, unknown> & {
    status_history?: readonly TaskStatusChange[];
    hidden_from_recent?: boolean;
    tracking?: TaskTracking;
  }
>;
export type DocumentMetadata = {
  id: string;
  name: string;
  type: string;
  tags: readonly string[];
  status?: string;
  priority?: TaskPriority;
  assignee?: string;
  project?: string;
  start_at?: string;
  due_at?: string;
  created_at?: string;
  updated_at?: string;
  archived_at?: string;
  depends_on?: readonly string[];
  extra?: TaskExtra;
  dates: Readonly<Record<string, string>>;
};
export type DocumentSummary = {
  path: string;
  metadata: DocumentMetadata;
  classification: "task-record" | "document";
  size: number;
  modifiedAt: number;
  contentHash: string;
  changeTime: number;
  fileId: string;
  /** Checkbox progress of a task body, computed while indexing. */
  checklist?: { completed: number; total: number };
};
export type ValidationCategory =
  | "metadata"
  | "identity"
  | "reference"
  | "dependency"
  | "link"
  | "group"
  | "path"
  | "quality";
export type ValidationSeverity = "error" | "warning";
export type ValidationDiagnostic = {
  path: string;
  message: string;
  category?: ValidationCategory;
  severity?: ValidationSeverity;
};
export type WorkspaceIndex = {
  root: string;
  documents: ReadonlyMap<string, DocumentSummary>;
  diagnostics: readonly ValidationDiagnostic[];
  scannedAt: number;
  fingerprints: ReadonlyMap<string, string>;
};
export type QualityMode = "reject" | "warn" | "off";
export type QualityConfig = {
  mode?: QualityMode;
  minTaskWords?: number;
  minChecklistItems?: number;
  minGroupDocWords?: number;
};
export type TrackingConfig = { enabled?: boolean };
export type WorkspaceConfig = {
  workspace: string;
  organization?: { weekStart?: number; autoArchiveAfterDays?: number | null };
  quality?: QualityConfig;
  tracking?: TrackingConfig;
};
export type ResolvedWorkspace = {
  root: string;
  projectRoot: string;
  config: WorkspaceConfig;
  source: "argument" | "environment" | "task-yaml" | "default";
};
export type TaskGroup = {
  id: string;
  name: string;
  slug: string;
  path: string;
  /** Id of the group's goal.md document, when it exists. */
  goalId?: string;
  archived: boolean;
  finished?: boolean;
  total: number;
  completed: number;
  archivedTasks: number;
  resolved: number;
};
export type TaskCreateInput = {
  title: string;
  group: string;
  description?: string;
  /** Full Markdown body; replaces the generated scaffold. */
  body?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignee?: string;
  project?: string;
  startAt?: string;
  dueAt?: string;
  tags?: readonly string[];
  dependsOn?: readonly string[];
  extra?: Readonly<Record<string, unknown>>;
};
export type TaskUpdateInput = Partial<
  Omit<TaskCreateInput, "group" | "description" | "body" | "dueAt">
> & {
  title?: string;
  dueAt?: string | null;
  hiddenFromRecent?: boolean;
  /** Record git snapshots while the task is in progress (requires a git repository). */
  track?: boolean;
};
export type DocumentCreateInput = {
  title: string;
  path: string;
  body?: string;
  tags?: readonly string[];
  extra?: Readonly<Record<string, unknown>>;
};
