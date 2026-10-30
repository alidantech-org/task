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

export interface HealthStatus {
  status: "ok";
  service: string;
}

export function isHealthStatus(value: unknown): value is HealthStatus {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return candidate.status === "ok" && typeof candidate.service === "string";
}
