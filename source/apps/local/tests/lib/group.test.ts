import { describe, expect, test } from "bun:test";
import { groupForTask, groupLabel } from "@/lib/group";

const groups = [
  { id: "GRP-1", name: "Finished group", path: "todo/work/W44/finished--aaaaaa" },
  { id: "GRP-2", name: "Open group", path: "todo/work/W44/open--bbbbbb" },
];

describe("groupForTask", () => {
  test("finds groups by path, including finished ones", () => {
    expect(groupForTask({ path: "todo/work/W44/finished--aaaaaa/001-a.md" }, groups)?.id).toBe(
      "GRP-1",
    );
    expect(groupLabel({ path: "todo/work/W44/open--bbbbbb/002-b.md" }, groups)).toBe("Open group");
  });

  test("prefers the recorded group id and falls back to project then Ungrouped", () => {
    const task = { path: "todo/elsewhere/001.md", extra: { group_id: "GRP-2" } };
    expect(groupForTask(task, groups)?.id).toBe("GRP-2");
    expect(groupLabel({ path: "todo/x/1.md", project: "Website" }, groups)).toBe("Website");
    expect(groupLabel({ path: "todo/x/1.md" }, groups)).toBe("Ungrouped");
    expect(groupForTask({ path: "todo/work/W44/finished--aaaaaaX/1.md" }, groups)).toBeUndefined();
  });
});
