import { describe, expect, test } from "bun:test";
import { completionWeek, isArchivedTask, sidebarResize, sortCompletedTasks } from "@/lib/overview";

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

  test("includes archived records in completed tasks and sorts by explicit dates", () => {
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
        path: "todo/_archive/2026/10/2026-10-30-group/task.md",
        modifiedAt: 200,
        status: "completed",
        archived_at: "2026-10-30T09:00:00.000Z",
      },
    ];
    const completed = sortCompletedTasks(records);
    expect(completed.map((task) => task.id)).toEqual(["archived", "completed"]);
    expect(isArchivedTask(completed[0])).toBe(true);
  });
});
