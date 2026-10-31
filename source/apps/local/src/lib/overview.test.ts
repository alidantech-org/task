import { describe, expect, test } from "bun:test";
import {
  completionWeek,
  getRecentCompletedTasks,
  isArchivedTask,
  sidebarResize,
  sortCompletedTasks,
} from "@/lib/overview";

describe("dashboard overview helpers", () => {
  test("counts only completed status transitions in the current local week", () => {
    const now = new Date(2026, 9, 28, 12);
    const week = completionWeek(
      [
        {
          extra: {
            status_history: [
              { from: "in-progress", to: "completed", at: "2026-10-26T09:00:00.000Z" },
              { from: "completed", to: "planned", at: "2026-10-27T09:00:00.000Z" },
              { from: "blocked", to: "completed", at: "2026-10-20T09:00:00.000Z" },
            ],
          },
        },
        {},
      ],
      now,
    );
    expect(week.map((day) => day.count).reduce((sum, count) => sum + count, 0)).toBe(1);
  });

  test("collapses at the minimum and clamps expanded widths", () => {
    expect(sidebarResize(207)).toEqual({ width: 76, collapsed: true });
    expect(sidebarResize(256)).toEqual({ width: 256, collapsed: false });
    expect(sidebarResize(500)).toEqual({ width: 360, collapsed: false });
  });

  test("recognizes archived records separately and sorts recent records by explicit dates", () => {
    const records = [
      {
        id: "active",
        name: "Active",
        type: "task",
        path: "todo/active/active.md",
        modifiedAt: 300,
        status: "in-progress",
      },
      {
        id: "completed",
        name: "Completed",
        type: "task",
        path: "todo/group/completed.md",
        modifiedAt: 100,
        status: "completed",
        updated_at: "2026-10-29T09:00:00.000Z",
      },
      {
        id: "archived",
        name: "Archived",
        type: "task",
        path: "todo/_archived/2026/10/2026-10-30-task-tsk-1/task.md",
        modifiedAt: 200,
        status: "completed",
        archived_at: "2026-10-30T09:00:00.000Z",
      },
    ];
    const completed = sortCompletedTasks(records);
    expect(completed.map((task) => task.id)).toEqual(["archived", "completed"]);
    expect(isArchivedTask(completed[0])).toBe(true);
  });

  test("hiding an item does not backfill outside the selected recent window", () => {
    const tasks = Array.from({ length: 11 }, (_, index) => ({
      id: `task-${index + 1}`,
      name: `Task ${index + 1}`,
      status: "completed",
      path: `todo/group/${String(index + 1).padStart(3, "0")}-task-${index + 1}.md`,
      modifiedAt: index,
      updated_at: new Date(Date.UTC(2026, 9, 11 - index)).toISOString(),
      ...(index === 0 ? { extra: { hidden_from_recent: true } } : {}),
    }));
    const visible = getRecentCompletedTasks(tasks, 10);
    expect(visible).toHaveLength(9);
    expect(visible.map((task) => task.id)).not.toContain("task-11");
  });
});
