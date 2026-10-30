/** Stable, transport-neutral vocabulary shared by Task applications. */
export interface WorkspaceIdentity { id: string; name: string; }
export interface TaskRecordSummary { id: string; title: string; status: string; }
export interface HealthStatus { status: "ok"; service: string; }