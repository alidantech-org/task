import type { DocumentMetadata } from "@task/workspace/indexing/types";

/** Classification follows frontmatter, so documentation paths are never treated as task records. */
export function classifyDocument(metadata: DocumentMetadata): "task-record" | "document" {
  return metadata.type === "task" ? "task-record" : "document";
}
