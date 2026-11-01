import { describe, expect, test } from "bun:test";
import { detailRows } from "@/lib/document-details";
import { extractLinks, headingEntries } from "@/lib/markdown";

describe("headingEntries", () => {
  test("gives every heading one stable id, numbering repeats and skipping code fences", () => {
    const entries = headingEntries(
      "# Title\n\n## Scope\n\n```md\n## Not a heading\n```\n\n## Scope\n### `Code` and [link](x)\n",
    );
    expect(entries.map((entry) => [entry.line, entry.level, entry.title, entry.id])).toEqual([
      [1, 1, "Title", "h-title"],
      [3, 2, "Scope", "h-scope"],
      [9, 2, "Scope", "h-scope-2"],
      [10, 3, "Code and link", "h-code-and-link"],
    ]);
  });
});

describe("extractLinks", () => {
  test("lists Markdown links and bare addresses once, ignoring images, anchors and code", () => {
    const links = extractLinks(
      [
        "See [the spec](https://example.com/spec) and [again](https://example.com/spec).",
        "![diagram](https://example.com/d.png) and [top](#top) and `[code](https://no.example)`",
        "Local [doc](../guides/setup.md#install) and bare https://example.org/page.",
        "```",
        "[fenced](https://hidden.example)",
        "```",
      ].join("\n"),
    );
    expect(links).toEqual([
      { label: "the spec", href: "https://example.com/spec" },
      { label: "doc", href: "../guides/setup.md#install" },
      { label: "https://example.org/page", href: "https://example.org/page" },
    ]);
  });
});

describe("detailRows", () => {
  test("shows frontmatter and file facts, leaving out empty and internal values", () => {
    const rows = detailRows({
      id: "TSK-1",
      name: "T",
      type: "task",
      path: "todo/g/001-t.md",
      tags: ["a", "b"],
      status: "planned",
      due_at: "2026-11-05",
      created_at: "2026-11-01T10:00:00.000Z",
      size: 2500,
      modifiedAt: Date.parse("2026-11-02T10:00:00Z"),
      extra: { group_id: "GRP-1", status_history: [{}], tracking: {} },
    });
    const byLabel = Object.fromEntries(rows.map((row) => [row.label, row]));
    expect(byLabel.ID?.value).toBe("TSK-1");
    expect(byLabel.Tags?.values).toEqual(["a", "b"]);
    expect(byLabel.Due?.value).toBe("Nov 5, 2026");
    expect(byLabel["group id"]?.value).toBe("GRP-1");
    expect(byLabel.Size?.value).toBe("2.5 KB");
    expect(byLabel.Assignee).toBeUndefined();
    expect(rows.some((row) => row.label === "status history" || row.label === "tracking")).toBe(
      false,
    );
  });
});
