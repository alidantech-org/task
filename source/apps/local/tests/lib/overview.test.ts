import { describe, expect, test } from "bun:test";
import {
  clampSidebarWidth,
  completionWeek,
  getCompletionTimestamp,
  getRecentCompletedTasks,
  isArchivedTask,
  parseSidebarPreference,
  sortCompletedTasks,
  toggleSidebarPreference,
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

  test("uses the configured week start when building completion history", () => {
    const now = new Date("2026-10-31T12:00:00");
    const tasks = [
      {
        extra: {
          status_history: [
            { from: "planned", to: "completed", at: "2026-10-25T12:00:00.000Z" },
            { from: "planned", to: "completed", at: "2026-10-31T12:00:00.000Z" },
          ],
        },
      },
    ];
    const mondayWeek = completionWeek(tasks, now, 1);
    const sundayWeek = completionWeek(tasks, now, 7);
    expect(mondayWeek[0]?.date).toBe("2026-10-26");
    expect(mondayWeek.reduce((sum, day) => sum + day.count, 0)).toBe(1);
    expect(sundayWeek[0]?.date).toBe("2026-10-25");
    expect(sundayWeek.reduce((sum, day) => sum + day.count, 0)).toBe(2);
  });

  test("defaults the overview chart to the prototype's Monday-first week", () => {
    const week = completionWeek([], new Date("2026-10-31T12:00:00"));
    expect(week[0]?.date).toBe("2026-10-26");
    expect(week[6]?.date).toBe("2026-11-01");
  });

  test("resizes continuously within the supported sidebar width range", () => {
    expect(clampSidebarWidth(149)).toBe(200);
    expect(clampSidebarWidth(256)).toBe(256);
    expect(clampSidebarWidth(500)).toBe(380);
  });

  test("restores tsb preferences and migrates legacy sidebar state", () => {
    expect(
      parseSidebarPreference('["hidden",320,"mini"]', {
        compact: null,
        visible: null,
        width: null,
      }),
    ).toEqual({ mode: "hidden", width: 320, last: "mini" });
    expect(
      parseSidebarPreference(null, {
        compact: "true",
        visible: "false",
        width: "280",
      }),
    ).toEqual({ mode: "hidden", width: 280, last: "mini" });
    expect(
      parseSidebarPreference("invalid", {
        compact: null,
        visible: null,
        width: "500",
      }),
    ).toEqual({ mode: "full", width: 380, last: "full" });
  });

  test("hides and restores the prior full or mini sidebar mode", () => {
    const full = { mode: "full", width: 300, last: "full" } as const;
    const fullHidden = toggleSidebarPreference(full);
    expect(fullHidden).toEqual({ mode: "hidden", width: 300, last: "full" });
    expect(toggleSidebarPreference(fullHidden)).toEqual(full);

    const mini = { mode: "mini", width: 300, last: "mini" } as const;
    const miniHidden = toggleSidebarPreference(mini);
    expect(miniHidden).toEqual({ mode: "hidden", width: 300, last: "mini" });
    expect(toggleSidebarPreference(miniHidden)).toEqual(mini);
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
    expect(
      getCompletionTimestamp({
        path: "todo/group/completed.md",
        modifiedAt: 100,
        status: "completed",
        updated_at: "2026-10-29T09:00:00.000Z",
        extra: {
          status_history: [
            { from: "in-progress", to: "completed", at: "2026-10-28T09:00:00.000Z" },
          ],
        },
      }),
    ).toBe(Date.parse("2026-10-28T09:00:00.000Z"));
  });

  test("fills the recent window after hidden items are filtered", () => {
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
    expect(visible).toHaveLength(10);
    expect(visible.map((task) => task.id)).not.toContain("task-1");
    expect(visible.map((task) => task.id)).toContain("task-11");
  });
});
