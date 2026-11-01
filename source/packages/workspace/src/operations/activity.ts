import type { TaskComment } from "@task/workspace/documents/comments";
import type { DocumentMetadata } from "@task/workspace/indexing/types";

export type ActivityEntry = {
  at: string;
  kind: "created" | "status" | "comment" | "tracking" | "attachment" | "updated";
  text: string;
  author?: string;
};

/** One chronological timeline (newest first) from the data a task already holds. */
export function buildActivity(
  metadata: Pick<DocumentMetadata, "created_at" | "updated_at" | "extra" | "attachments">,
  comments: readonly TaskComment[],
): ActivityEntry[] {
  const entries: ActivityEntry[] = [];
  if (metadata.created_at)
    entries.push({ at: metadata.created_at, kind: "created", text: "Task created" });
  for (const change of metadata.extra?.status_history ?? [])
    entries.push({ at: change.at, kind: "status", text: `Status ${change.from} → ${change.to}` });
  for (const comment of comments)
    entries.push({
      at: comment.at,
      kind: "comment",
      text: comment.text.length > 140 ? `${comment.text.slice(0, 140)}…` : comment.text,
      ...(comment.author ? { author: comment.author } : {}),
    });
  for (const segment of metadata.extra?.tracking?.segments ?? []) {
    entries.push({
      at: segment.started_at,
      kind: "tracking",
      text: "Started recording file changes",
    });
    if (segment.ended_at)
      entries.push({
        at: segment.ended_at,
        kind: "tracking",
        text: segment.summary
          ? `Stopped recording: ${segment.summary.files} file(s), +${segment.summary.insertions} −${segment.summary.deletions}`
          : "Stopped recording file changes",
      });
  }
  for (const attachment of metadata.attachments ?? [])
    entries.push({
      at: attachment.added_at,
      kind: "attachment",
      text: `Attached ${attachment.name}`,
      ...(attachment.added_by ? { author: attachment.added_by } : {}),
    });
  if (metadata.updated_at && metadata.updated_at !== metadata.created_at)
    entries.push({ at: metadata.updated_at, kind: "updated", text: "Last updated" });
  return entries
    .filter((entry) => !Number.isNaN(Date.parse(entry.at)))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}
