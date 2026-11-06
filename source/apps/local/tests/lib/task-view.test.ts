import { describe, expect, test } from "bun:test";
import { sortTaskView } from "@/lib/task-view";

const tasks = [
  {
    id: "b",
    name: "Beta",
    groupName: "Design",
    status: "blocked",
    priority: "high",
    due_at: "2026-11-04",
    updated_at: "2026-11-02T00:00:00Z",
    modifiedAt: 2,
  },
  {
    id: "a",
    name: "Alpha",
    groupName: "Backend",
    status: "planned",
    priority: "low",
    updated_at: "2026-11-03T00:00:00Z",
    modifiedAt: 1,
  },
  {
    id: "c",
    name: "Gamma",
    groupName: "Backend",
    status: "completed",
    priority: "medium",
    due_at: "2026-11-01",
    extra: { status_history: [{ to: "completed", at: "2026-11-04T00:00:00Z" }] },
    modifiedAt: 3,
  },
];

describe("task presentation sorting", () => {
  test("sorts titles, groups and status in either direction", () => {
    expect(sortTaskView(tasks, "name", "ascending").map((task) => task.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(sortTaskView(tasks, "group", "ascending").map((task) => task.id)).toEqual([
      "a",
      "c",
      "b",
    ]);
    expect(sortTaskView(tasks, "status", "descending").map((task) => task.id)).toEqual([
      "c",
      "b",
      "a",
    ]);
  });

  test("sorts due dates with undated tasks last and handles missing dates for recent", () => {
    expect(sortTaskView(tasks, "due", "ascending").map((task) => task.id)).toEqual(["c", "b", "a"]);
    expect(sortTaskView(tasks, "recent", "descending").map((task) => task.id)).toEqual([
      "c",
      "a",
      "b",
    ]);
    expect(sortTaskView(tasks, "due", "descending").map((task) => task.id)).toEqual([
      "b",
      "c",
      "a",
    ]);
    expect(sortTaskView(tasks, "recent", "descending").map((task) => task.id)).toEqual([
      "c",
      "a",
      "b",
    ]);
  });
});
