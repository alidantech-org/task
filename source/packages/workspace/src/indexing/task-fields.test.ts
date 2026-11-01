import { describe, expect, test } from "bun:test";
import { parseFrontmatter, serializeMarkdown } from "#/indexing/metadata";

function task(extra: Record<string, unknown>): string {
  return serializeMarkdown({ id: "TSK-1", name: "T", type: "task", ...extra }, "# T\n");
}
const added = "2026-11-01T10:00:00.000Z";

describe("optional task fields", () => {
  test("accepts valid values and exposes them on the metadata", () => {
    const { metadata } = parseFrontmatter(
      task({
        order: 1536.5,
        parent: "TSK-0",
        estimate: 3,
        links: [{ type: "blocks", task: "TSK-2" }],
        watchers: ["peter"],
        attachments: [
          {
            kind: "file",
            name: "a.txt",
            path: "attachments/TSK-1/a.txt",
            size: 10,
            added_at: added,
          },
          { kind: "link", name: "Spec", url: "https://example.com/spec", added_at: added },
        ],
        recurrence: { every: "week", interval: 2, until: "2027-01-01" },
      }),
    );
    expect(metadata.order).toBe(1536.5);
    expect(metadata.parent).toBe("TSK-0");
    expect(metadata.estimate).toBe(3);
    expect(metadata.links).toEqual([{ type: "blocks", task: "TSK-2" }]);
    expect(metadata.watchers).toEqual(["peter"]);
    expect(metadata.attachments).toHaveLength(2);
    expect(metadata.recurrence).toEqual({ every: "week", interval: 2, until: "2027-01-01" });
  });

  test("rejects invalid values with specific messages", () => {
    const bad = (extra: Record<string, unknown>, message: string) =>
      expect(() => parseFrontmatter(task(extra))).toThrow(message);
    bad({ order: "first" }, "order must be a finite number");
    bad({ parent: "" }, "parent must be a task id");
    bad({ estimate: -1 }, "estimate must be a number");
    bad({ links: [{ type: "blocks" }] }, "links[0].task");
    bad({ links: [{ type: "owns", task: "TSK-2" }] }, "links[0].type");
    bad(
      {
        links: [
          { type: "blocks", task: "TSK-2" },
          { type: "blocks", task: "TSK-2" },
        ],
      },
      "duplicates",
    );
    bad({ watchers: ["a", "a"] }, "unique names");
    bad({ recurrence: { every: "year", interval: 1 } }, "recurrence.every");
    bad({ recurrence: { every: "day", interval: 0 } }, "interval");
    bad({ recurrence: { every: "day", interval: 1, until: "soon" } }, "YYYY-MM-DD");
  });

  test("attachments must be safe, small and well formed", () => {
    const attachment = (item: Record<string, unknown>) =>
      task({ attachments: [{ name: "x", added_at: added, ...item }] });
    expect(() => parseFrontmatter(attachment({ kind: "file", path: "../x", size: 1 }))).toThrow(
      "safe",
    );
    expect(() => parseFrontmatter(attachment({ kind: "file", path: "/etc/x", size: 1 }))).toThrow(
      "safe",
    );
    expect(() =>
      parseFrontmatter(attachment({ kind: "file", path: "a/x", size: 2_000_000 })),
    ).toThrow("up to");
    expect(() => parseFrontmatter(attachment({ kind: "link", url: "file:///etc/passwd" }))).toThrow(
      "http or https",
    );
    expect(() => parseFrontmatter(attachment({ kind: "zip" }))).toThrow("file or link");
  });

  test("documents other than tasks still reject the task-only fields", () => {
    expect(() =>
      parseFrontmatter(
        serializeMarkdown({ id: "D", name: "D", type: "documentation", order: 1 }, "x"),
      ),
    ).toThrow("Unknown documentation metadata field");
  });
});
