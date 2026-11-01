import { describe, expect, test } from "bun:test";
import {
  compareTasks,
  effectiveOrder,
  nextOrder,
  rankBetween,
  sortTasks,
} from "#/operations/order";

const task = (path: string, order?: number, created?: string) => ({
  path,
  metadata: {
    id: path,
    name: path,
    type: "task",
    tags: [],
    dates: {},
    ...(order === undefined ? {} : { order }),
    ...(created ? { created_at: created } : {}),
  },
});

describe("task order", () => {
  test("falls back to the file prefix scaled like order", () => {
    expect(effectiveOrder(task("todo/g/003-c.md"))).toBe(3072);
    expect(effectiveOrder(task("todo/g/003-c.md", 5))).toBe(5);
    expect(effectiveOrder(task("todo/g/plain.md"))).toBe(0);
  });

  test("sorts by order, then creation time, then path", () => {
    const sorted = sortTasks([
      task("todo/g/002-b.md"),
      task("todo/g/001-a.md"),
      task("todo/g/009-z.md", 1500),
      task("todo/g/010-y.md", 1500, "2026-01-01"),
    ]);
    expect(sorted.map((item) => item.path)).toEqual(
      ["todo/g/001-a.md", "todo/g/009-z.md", "todo/g/010-y.md", "todo/g/002-b.md"].sort(
        (a, b) =>
          ["001", "009", "010", "002"].indexOf(a.slice(7, 10)) -
          ["001", "009", "010", "002"].indexOf(b.slice(7, 10)),
      ),
    );
    expect(compareTasks(task("a/001-a.md", 1), task("a/002-b.md", 2))).toBeLessThan(0);
  });

  test("gives new tasks a rank after the last one", () => {
    expect(nextOrder([])).toBe(1024);
    expect(nextOrder([task("g/001-a.md"), task("g/002-b.md", 5000)])).toBe(6024);
  });

  test("ranks between neighbours and reports when there is no room", () => {
    expect(rankBetween(undefined, undefined)).toBe(1024);
    expect(rankBetween(undefined, 2048)).toBe(1024);
    expect(rankBetween(2048, undefined)).toBe(3072);
    expect(rankBetween(1000, 2000)).toBe(1500);
    expect(rankBetween(1, 1 + 1e-9)).toBeUndefined();
  });
});
