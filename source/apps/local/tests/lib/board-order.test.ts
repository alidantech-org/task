import { describe, expect, test } from "bun:test";
import { planReorder, rankOf, sortBoard } from "@/lib/board-order";

const task = (id: string, path: string, order?: number, created_at?: string) => ({
  id,
  path,
  order,
  created_at,
});

describe("board order", () => {
  test("ranks by order, falling back to the scaled file number", () => {
    expect(rankOf({ path: "g/003-x.md" })).toBe(3072);
    expect(rankOf({ path: "g/003-x.md", order: 7 })).toBe(7);
  });

  test("keeps each group together and follows manual order inside it", () => {
    const tasks = [
      task("b2", "g2/002-b.md"),
      task("a2", "g1/002-a.md", 5000),
      task("a1", "g1/001-a.md"),
      task("b1", "g2/001-b.md", 10),
    ];
    const sorted = sortBoard(tasks, (item) => (item.path.startsWith("g1/") ? 0 : 1));
    expect(sorted.map((item) => item.id)).toEqual(["a1", "a2", "b1", "b2"]);
  });

  test("anchors a dropped task on the nearest neighbour from its own group", () => {
    const column = [
      task("a1", "g1/001-a.md"),
      task("b1", "g2/001-b.md"),
      task("a2", "g1/002-a.md"),
    ];
    expect(planReorder(column, "g1/009-m.md", 3)).toEqual({ after: "a2" });
    expect(planReorder(column, "g1/009-m.md", 2)).toEqual({ after: "a1" });
    expect(planReorder(column, "g1/009-m.md", 0)).toEqual({ before: "a1" });
    expect(planReorder(column, "g2/009-m.md", 0)).toEqual({ before: "b1" });
    expect(planReorder(column, "g3/009-m.md", 1)).toBeNull();
    expect(planReorder([], "g1/009-m.md", 0)).toBeNull();
  });
});
