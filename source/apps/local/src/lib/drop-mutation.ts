export type DropTask = { id: string; status?: string; due_at?: string; contentHash: string };
export type TaskDropUpdate = { status?: string; dueAt?: string | null; expectedHash: string };

export function taskDropUpdate(
  task: DropTask,
  target: { date?: string | null; status?: string } | null,
  cancelled = false,
): TaskDropUpdate | null {
  if (cancelled || !target) return null;
  if (target.date !== undefined)
    return target.date === (task.due_at ?? null)
      ? null
      : { dueAt: target.date, expectedHash: task.contentHash };
  if (target.status)
    return target.status === task.status
      ? null
      : { status: target.status, expectedHash: task.contentHash };
  return null;
}
