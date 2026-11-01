import { WorkspaceError } from "@task/workspace/errors";
import type { TaskUpdateInput, WorkspaceContext } from "@task/workspace/indexing/types";
import { deleteTask } from "@task/workspace/operations/delete";
import { moveTask } from "@task/workspace/operations/move";
import { archiveTask, updateTask } from "@task/workspace/operations/mutate";

export type BulkPatch = TaskUpdateInput & {
  /** Move every task into this group. */
  group?: string;
  archive?: boolean;
  delete?: boolean;
};

export type BulkResult = { id: string; ok: boolean; error?: string; warnings?: string[] };

/** Applies one change to many tasks independently, reporting each task's outcome. */
export async function bulkUpdateTasks(
  context: WorkspaceContext,
  ids: readonly string[],
  patch: BulkPatch,
): Promise<BulkResult[]> {
  if (ids.length === 0) throw new WorkspaceError("invalid_input", "Select at least one task");
  if (ids.length > 200)
    throw new WorkspaceError("invalid_input", "Select at most 200 tasks at once");
  const { group, archive, delete: remove, ...fields } = patch;
  const results: BulkResult[] = [];
  for (const id of ids) {
    try {
      let warnings: string[] | undefined;
      if (remove) await deleteTask(context, id);
      else {
        if (group) await moveTask(context, id, group);
        if (Object.keys(fields).length > 0)
          warnings = (await updateTask(context, id, fields)).warnings;
        if (archive) await archiveTask(context, id);
      }
      results.push({ id, ok: true, ...(warnings ? { warnings } : {}) });
    } catch (error) {
      results.push({
        id,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return results;
}
