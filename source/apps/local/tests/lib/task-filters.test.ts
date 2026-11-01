import { describe, expect, test } from "bun:test";
import {
  applyFilters,
  emptyFilters,
  isFiltering,
  isSavedViews,
  upsertView,
} from "@/lib/task-filters";

const task = (name: string, extra: Record<string, unknown> = {}) => ({
  name,
  tags: [] as string[],
  ...extra,
});
const now = new Date("2026-11-10T12:00:00");

describe("applyFilters", () => {
  const tasks = [
    task("Fix login", {
      tags: ["bug"],
      assignee: "Ann",
      priority: "high",
      due_at: "2026-11-08",
      status: "planned",
      watchers: ["Peter"],
    }),
    task("Write docs", {
      tags: ["docs"],
      assignee: "Peter",
      priority: "low",
      due_at: "2026-11-12",
      status: "planned",
    }),
    task("Plan release", {
      priority: "high",
      status: "completed",
      due_at: "2026-11-01",
      groupName: "Release",
    }),
    task("Someday", {}),
  ];
  const names = (filters = {}) =>
    applyFilters(tasks, { ...emptyFilters, ...filters }, "Peter", now).map((item) => item.name);

  test("returns everything when no filter is set", () => {
    expect(isFiltering(emptyFilters)).toBe(false);
    expect(names()).toHaveLength(4);
  });

  test("filters by text, assignee (including me), tag, priority and watching", () => {
    expect(names({ text: "release" })).toEqual(["Plan release"]);
    expect(names({ assignee: "me" })).toEqual(["Write docs"]);
    expect(names({ assignee: "ann" })).toEqual(["Fix login"]);
    expect(names({ tag: "bug" })).toEqual(["Fix login"]);
    expect(names({ priority: "high" })).toEqual(["Fix login", "Plan release"]);
    expect(names({ watching: true })).toEqual(["Fix login"]);
    expect(isFiltering({ ...emptyFilters, tag: "x" })).toBe(true);
  });

  test("filters by due state and ignores finished work for overdue", () => {
    expect(names({ due: "overdue" })).toEqual(["Fix login"]);
    expect(names({ due: "week" })).toEqual(["Write docs"]);
    expect(names({ due: "none" })).toEqual(["Someday"]);
  });
});

describe("saved views", () => {
  test("validates stored data and replaces views by name", () => {
    expect(isSavedViews([{ id: "a", name: "Mine", filters: emptyFilters }])).toBe(true);
    expect(isSavedViews([{ id: "a", name: "Bad", filters: { text: 1 } }])).toBe(false);
    expect(isSavedViews("nope")).toBe(false);
    const first = upsertView([], "Mine", emptyFilters);
    const second = upsertView(first, "mine", { ...emptyFilters, tag: "bug" });
    expect(second).toHaveLength(1);
    expect(second[0]?.filters.tag).toBe("bug");
    expect(upsertView(first, "  ", emptyFilters)).toHaveLength(1);
  });
});
