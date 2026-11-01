const orderStep = 1024;

type Ranked = { path: string; order?: number };

function filePrefix(path: string): number {
  const match = /(?:^|\/)(\d+)-[^/]*\.md$/i.exec(path);
  return match?.[1] ? Number(match[1]) : 0;
}

/** A task's rank in its group: its order, or the file number scaled to the same range. */
export function rankOf(task: Ranked): number {
  return task.order ?? filePrefix(task.path) * orderStep;
}

export function directoryOf(path: string): string {
  const index = path.lastIndexOf("/");
  return index < 0 ? "" : path.slice(0, index);
}

/**
 * Board column order: tasks of one group stay together (groups in the given rank order) and follow
 * the group's manual order inside.
 */
export function sortBoard<T extends Ranked & { created_at?: string }>(
  tasks: readonly T[],
  groupRank: (task: T) => number,
): T[] {
  return [...tasks].sort(
    (a, b) =>
      groupRank(a) - groupRank(b) ||
      rankOf(a) - rankOf(b) ||
      (a.created_at ?? "").localeCompare(b.created_at ?? "") ||
      a.path.localeCompare(b.path),
  );
}

export type ReorderPlan = { before: string } | { after: string } | null;

/**
 * Where a dragged task landed, expressed as a neighbour in its own group. `column` is the target
 * column without the dragged task; `index` is the position the task now has in that column. Order is
 * kept per group, so only neighbours from the same group can anchor it.
 */
export function planReorder<T extends { id: string; path: string }>(
  column: readonly T[],
  movedPath: string,
  index: number,
): ReorderPlan {
  const directory = directoryOf(movedPath);
  for (let position = Math.min(index, column.length) - 1; position >= 0; position -= 1) {
    const candidate = column[position];
    if (candidate && directoryOf(candidate.path) === directory) return { after: candidate.id };
  }
  for (let position = Math.max(index, 0); position < column.length; position += 1) {
    const candidate = column[position];
    if (candidate && directoryOf(candidate.path) === directory) return { before: candidate.id };
  }
  return null;
}
