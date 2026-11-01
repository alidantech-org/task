import { describe, expect, test } from "bun:test";
import type { DocumentSummary, TaskGroup } from "@task/workspace";
import {
  filterByQuery,
  filterGroups,
  getLaneTasks,
  getTaskGroup,
  sliceAroundSelection,
  taskLanes,
} from "#/model";

const task = (id: string, name: string, path: string, status: string): DocumentSummary => ({
  path,
  metadata: {
    id,
    name,
    type: "task",
    tags: ["foundation"],
    status,
    priority: "high",
    dates: {},
  },
  classification: "task-record",
  size: 0,
  modifiedAt: 0,
  contentHash: "hash",
  changeTime: 0,
  fileId: id,
});

describe("TUI workspace view model", () => {
  const tasks = [
    task("TSK-ONE", "CLI shell", "todo/platform/001-cli-shell.md", "in-progress"),
    task("TSK-TWO", "Site layout", "todo/design/001-site-layout.md", "planned"),
  ];
  const groups: TaskGroup[] = [
    {
      id: "GRP-ONE",
      name: "Platform",
      slug: "platform",
      path: "todo/platform",
      archived: false,
      total: 1,
      completed: 0,
      archivedTasks: 0,
      resolved: 0,
    },
  ];

  test("provides the four status lanes in workflow order", () => {
    expect(taskLanes).toEqual(["planned", "in-progress", "blocked", "completed"]);
    expect(getLaneTasks(tasks, "planned").map(({ metadata }) => metadata.id)).toEqual(["TSK-TWO"]);
  });

  test("filters shared task summaries by visible metadata", () => {
    expect(filterByQuery(tasks, "foundation")).toHaveLength(2);
    expect(filterByQuery(tasks, "site").map(({ metadata }) => metadata.id)).toEqual(["TSK-TWO"]);
  });

  test("associates tasks with shared groups by workspace path", () => {
    const selectedTask = tasks[0];
    expect(selectedTask ? getTaskGroup(selectedTask, groups)?.name : undefined).toBe("Platform");
    expect(filterGroups(groups, "plat")).toHaveLength(1);
  });

  test("keeps selected entries inside the visible window", () => {
    expect(sliceAroundSelection([0, 1, 2, 3, 4, 5, 6], 5, 3)).toEqual([4, 5, 6]);
  });
});
