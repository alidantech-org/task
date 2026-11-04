import { describe, expect, test } from "bun:test";
import { resolveDocumentRoute } from "@/lib/document-route";

const documents = [
  { id: "DOC-ONE", path: "guides/start here.md", type: "document" },
  { id: "DOC-TWO", path: "folder/nested/file.md", type: "document" },
  { id: "TSK-ONE", path: "work/task.md", type: "task" },
];

describe("path-based document routes", () => {
  test("resolves a document path with encoded path segments", () => {
    expect(resolveDocumentRoute("/documents/guides/start%20here.md", documents)).toMatchObject({
      kind: "document",
      path: "guides/start here.md",
      folder: "guides",
      needsRedirect: false,
    });
  });

  test("redirects a historical document ID URL to the canonical path", () => {
    expect(resolveDocumentRoute("/documents/DOC-ONE", documents)).toMatchObject({
      kind: "document",
      canonicalPath: "/documents/guides/start%20here.md",
      needsRedirect: true,
    });
  });

  test("keeps a real folder named folder and resolves older folder URLs", () => {
    expect(resolveDocumentRoute("/documents/folder/nested", documents)).toMatchObject({
      kind: "folder",
      folder: "folder/nested",
      needsRedirect: false,
    });
    const legacy = [{ id: "DOC-THREE", path: "notes/file.md", type: "document" }];
    expect(resolveDocumentRoute("/documents/folder/notes", legacy)).toMatchObject({
      kind: "folder",
      folder: "notes",
      canonicalPath: "/documents/notes",
      needsRedirect: true,
    });
  });

  test("never resolves task paths as documents", () => {
    expect(resolveDocumentRoute("/documents/work/task.md", documents)).toMatchObject({
      kind: "folder",
      folder: "work/task.md",
    });
  });
});
