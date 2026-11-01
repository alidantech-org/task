import { describe, expect, test } from "bun:test";
import { resolveLink } from "#/links/resolve";

const context = {
  fromPath: "docs/architecture/overview.md",
  workspacePrefix: "tasks",
  documents: [
    { id: "DOC-1", path: "docs/guides/setup.md" },
    { id: "DEC-0012", path: "decisions/0012.md" },
  ],
};

describe("resolveLink", () => {
  test("classifies external, anchor and blocked links", () => {
    expect(resolveLink("https://example.com/a", context)).toEqual({
      kind: "external",
      href: "https://example.com/a",
    });
    expect(resolveLink("#intro", context)).toEqual({ kind: "anchor", anchor: "intro" });
    expect(resolveLink("javascript:alert(1)", context).kind).toBe("blocked");
    expect(resolveLink("//evil.example/x", context).kind).toBe("blocked");
    expect(resolveLink("../../../../etc/passwd", context).kind).toBe("blocked");
  });

  test("opens documents by id or by relative workspace path", () => {
    expect(resolveLink("DEC-0012", context)).toEqual({ kind: "document", id: "DEC-0012" });
    expect(resolveLink("TSK-ABC123", context)).toEqual({ kind: "document", id: "TSK-ABC123" });
    expect(resolveLink("../guides/setup.md#install", context)).toEqual({
      kind: "document",
      id: "DOC-1",
      anchor: "install",
    });
  });

  test("opens project files with line ranges", () => {
    expect(resolveLink("../../../source/app.ts#L10-L20", context)).toEqual({
      kind: "file",
      path: "source/app.ts",
      startLine: 10,
      endLine: 20,
    });
    expect(resolveLink("/README.md", context)).toEqual({ kind: "file", path: "README.md" });
    expect(resolveLink("../../../source/app.ts:42", context)).toMatchObject({
      path: "source/app.ts",
      startLine: 42,
    });
  });
});
