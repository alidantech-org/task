export type DropTask = { id: string; status?: string; due_at?: string; contentHash: string };
export type TaskDropUpdate = { status?: string; dueAt?: string; expectedHash: string };

export function taskDropUpdate(
  task: DropTask,
  target: { date?: string; status?: string } | null,
  cancelled = false,
): TaskDropUpdate | null {
  if (cancelled || !target) return null;
  if (target.date)
    return target.date === task.due_at
      ? null
      : { dueAt: target.date, expectedHash: task.contentHash };
  if (target.status)
    return target.status === task.status
      ? null
      : { status: target.status, expectedHash: task.contentHash };
  return null;
}
