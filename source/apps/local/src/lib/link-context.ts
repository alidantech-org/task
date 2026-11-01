import type { LinkContext } from "@task/workspace/links/resolve";

type LinkWorkspace = { workspaceDirectory?: string } | null;

/** Builds the context the shared link resolver needs from the loaded workspace and its records. */
export function buildLinkContext(
  workspace: LinkWorkspace,
  records: readonly { id: string; path: string }[],
  fromPath: string,
): LinkContext {
  const directory = (workspace?.workspaceDirectory ?? "tasks").replace(/\/+$/, "");
  return {
    fromPath,
    workspacePrefix: directory === "" ? "." : directory,
    documents: records.map((record) => ({ id: record.id, path: record.path })),
  };
}

/** In-app URL for a resolved link target, or undefined when it should be handled by the browser. */
export function internalHref(
  target: ReturnType<typeof import("@task/workspace/links/resolve").resolveLink>,
): string | undefined {
  if (target.kind === "document")
    return `/documents/${encodeURIComponent(target.id)}${target.anchor ? `#${target.anchor}` : ""}`;
  if (target.kind === "file") {
    const lines = target.startLine
      ? `&L=${target.startLine}${target.endLine ? `-${target.endLine}` : ""}`
      : "";
    return `/files?path=${encodeURIComponent(target.path)}${lines}`;
  }
  if (target.kind === "anchor") return `#${target.anchor}`;
  return undefined;
}
