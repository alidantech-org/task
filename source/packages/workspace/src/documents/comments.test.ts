import { describe, expect, test } from "bun:test";
import { appendComment, mentionsOf, parseComments, removeComment } from "#/documents/comments";

const at = "2026-11-01T10:00:00.000Z";

describe("comments", () => {
  test("adds a section when missing and appends entries in order", () => {
    const first = appendComment("# Task\n\n## Goal\nWords.\n", {
      at,
      author: "Peter",
      text: "First",
    });
    expect(first).toContain("## Comments\n\n### 2026-11-01T10:00:00.000Z · Peter\n\nFirst\n");
    const second = appendComment(first, {
      at: "2026-11-01T11:00:00.000Z",
      author: "Ann",
      text: "Second\nline",
    });
    const comments = parseComments(second);
    expect(comments.map((comment) => [comment.author, comment.text])).toEqual([
      ["Peter", "First"],
      ["Ann", "Second\nline"],
    ]);
  });

  test("keeps content after the comments section", () => {
    const body =
      "# T\n\n## Comments\n\n### 2026-11-01T10:00:00.000Z · A\n\nOne\n\n## Later\nKeep me\n";
    const next = appendComment(body, { at, author: "B", text: "Two" });
    expect(next.indexOf("Two")).toBeLessThan(next.indexOf("## Later"));
    expect(next).toContain("Keep me");
    expect(parseComments(next)).toHaveLength(2);
  });

  test("reads the older list format and removes any entry by index", () => {
    const body = `# T\n\n## Comments\n\n- **${at}** — old style\n\n### 2026-11-02T08:00:00.000Z · Ann\n\nNew style\n`;
    const comments = parseComments(body);
    expect(comments.map((comment) => comment.text)).toEqual(["old style", "New style"]);
    expect(comments[0]?.author).toBeUndefined();
    const withoutOld = removeComment(body, 0);
    expect(parseComments(withoutOld).map((comment) => comment.text)).toEqual(["New style"]);
    const withoutNew = removeComment(body, 1);
    expect(parseComments(withoutNew).map((comment) => comment.text)).toEqual(["old style"]);
    expect(() => removeComment(body, 5)).toThrow("No comment 6");
  });

  test("ignores headings outside the comments section and non-time headings", () => {
    expect(parseComments("# T\n\n### 2026-11-01T10:00:00.000Z · A\n\nnot in a section\n")).toEqual(
      [],
    );
    expect(parseComments("# T\n\n## Comments\n\n### Notes\nplain\n")).toEqual([]);
  });

  test("finds mentions without emails or duplicates", () => {
    expect(mentionsOf("ping @peter and @ann.lee, (@peter) mail a@b.com")).toEqual([
      "peter",
      "ann.lee",
    ]);
    expect(mentionsOf("no mentions here")).toEqual([]);
  });
});
