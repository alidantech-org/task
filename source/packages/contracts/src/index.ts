/** Stable, transport-neutral vocabulary shared by Task applications. */
export interface WorkspaceIdentity {
  id: string;
  name: string;
}

export interface TaskRecordSummary {
  id: string;
  title: string;
  status: string;
}

export interface LocalWorkspaceSnapshot {
  projectName: string;
  projectRoot: string;
  workspaceRoot: string;
  workspaceDirectory: string;
  source: "argument" | "environment" | "task-yaml" | "default";
  scannedAt: number;
  documents: Array<{
    path: string;
    id: string;
    name: string;
    type: string;
    tags: readonly string[];
    status?: string;
    priority?: string;
    assignee?: string;
    project?: string;
    start_at?: string;
    due_at?: string;
    created_at?: string;
    updated_at?: string;
    archived_at?: string;
    depends_on?: readonly string[];
    size: number;
    modifiedAt: number;
    contentHash: string;
    classification: "task-record" | "document";
  }>;
  diagnostics: ReadonlyArray<{ path: string; message: string; category?: string }>;
}

export interface HealthStatus {
  status: "ok";
  service: string;
}

export function isHealthStatus(value: unknown): value is HealthStatus {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return candidate.status === "ok" && typeof candidate.service === "string";
}
