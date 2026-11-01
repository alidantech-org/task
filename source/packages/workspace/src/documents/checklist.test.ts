import { describe, expect, test } from "bun:test";
import { checklistProgress, parseChecklist, setChecklistItems } from "#/documents/checklist";

const body = [
  "# Title",
  "",
  "- [ ] before any heading",
  "",
  "## Design",
  "- [x] done item",
  "- [ ] open item",
  "",
  "```md",
  "- [ ] inside a fence",
  "```",
  "",
  "## Build",
  "1. [ ] numbered",
  "  - [X] nested",
].join("\n");

describe("checklist", () => {
  test("groups checkboxes by heading and ignores fenced code", () => {
    const checklist = parseChecklist(body);
    expect(checklist.total).toBe(5);
    expect(checklist.completed).toBe(2);
    expect(checklist.groups.map((group) => [group.heading, group.items.length])).toEqual([
      ["Title", 1],
      ["Design", 2],
      ["Build", 2],
    ]);
    expect(checklistProgress(body)).toEqual({ completed: 2, total: 5 });
  });

  test("checks items by index, section or all", () => {
    expect(setChecklistItems(body, { items: [0] }, true).changed).toBe(1);
    const section = setChecklistItems(body, { section: "design" }, true);
    expect(section.changed).toBe(1);
    expect(section.body).toContain("- [x] open item");
    expect(section.body).toContain("- [ ] inside a fence");
    const all = setChecklistItems(body, { all: true }, true);
    expect(parseChecklist(all.body).completed).toBe(5);
    expect(setChecklistItems(all.body, { all: true }, false).changed).toBe(5);
  });

  test("rejects unknown selectors", () => {
    expect(() => setChecklistItems(body, { section: "Nope" }, true)).toThrow(
      "No checklist section",
    );
    expect(() => setChecklistItems(body, { items: [99] }, true)).toThrow("No checklist item 100");
    expect(() => setChecklistItems(body, {}, true)).toThrow("Select");
  });
});
