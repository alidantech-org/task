import { describe, expect, it } from "bun:test";
import { taskDropUpdate } from "@/lib/drop-mutation";

describe("task drag and drop updates", () => {
  const task = { id: "TSK-1", status: "planned", contentHash: "hash-1" };
  it("schedules an unscheduled task with its current content hash", () => {
    expect(taskDropUpdate(task, { date: "2026-11-03" })).toEqual({
      dueAt: "2026-11-03",
      expectedHash: "hash-1",
    });
  });
  it("moves board tasks to a new status", () => {
    expect(taskDropUpdate(task, { status: "in-progress" })).toEqual({
      status: "in-progress",
      expectedHash: "hash-1",
    });
  });
  it("does not write for a canceled keyboard drag or unchanged target", () => {
    expect(taskDropUpdate(task, { status: "completed" }, true)).toBeNull();
    expect(taskDropUpdate(task, { status: "planned" })).toBeNull();
  });
});
