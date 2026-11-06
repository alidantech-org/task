import { parentDocumentFolder } from "@/lib/markdown";

export type DocumentRouteRecord = { id: string; path: string; type: string };
export type DocumentRoute =
  | {
      kind: "document";
      path: string;
      folder: string;
      document: DocumentRouteRecord;
      canonicalPath: string;
      needsRedirect: boolean;
    }
  | {
      kind: "folder";
      path: string;
      folder: string;
      canonicalPath: string;
      needsRedirect: boolean;
    };

export function encodeDocumentPath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

/** Resolves both path-based document URLs and historical ID/folder URLs. */
export function resolveDocumentRoute(
  pathname: string,
  records: readonly DocumentRouteRecord[],
): DocumentRoute | null {
  const match = pathname.split("?")[0]?.match(/^\/documents\/(.+)$/);
  if (!match?.[1]) return null;
  let segments: string[];
  try {
    segments = match[1].split("/").map(decodeURIComponent);
  } catch {
    return null;
  }
  const legacyFolder = segments[0] === "folder" && segments.length > 1;
  const candidate = segments.join("/");
  const document =
    records.find((record) => record.type !== "task" && record.path === candidate) ??
    records.find((record) => record.type !== "task" && record.id === candidate);
  if (document) {
    const canonicalPath = `/documents/${encodeDocumentPath(document.path)}`;
    return {
      kind: "document",
      path: document.path,
      folder: parentDocumentFolder(document.path),
      document,
      canonicalPath,
      needsRedirect: pathname !== canonicalPath,
    };
  }

  const fullFolderExists = records.some(
    (record) => record.type !== "task" && record.path.startsWith(`${candidate}/`),
  );
  const folder = legacyFolder && !fullFolderExists ? segments.slice(1).join("/") : candidate;
  const canonicalPath = folder ? `/documents/${encodeDocumentPath(folder)}` : "/documents";
  return {
    kind: "folder",
    path: folder,
    folder,
    canonicalPath,
    needsRedirect: pathname !== canonicalPath,
  };
}
