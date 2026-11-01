import { describe, expect, test } from "bun:test";
import { totalsOf } from "@/lib/schedule";

describe("totalsOf", () => {
  test("counts done, overdue and estimated points", () => {
    const totals = totalsOf(
      [
        { status: "completed", due_at: "2026-11-01", estimate: 2 },
        { status: "planned", due_at: "2026-11-01", estimate: 3 },
        { status: "in-progress", due_at: "2026-11-09" },
      ],
      "2026-11-05",
    );
    expect(totals).toEqual({ count: 3, done: 1, overdue: 1, estimate: 5 });
    expect(totalsOf([])).toEqual({ count: 0, done: 0, overdue: 0, estimate: 0 });
  });
});
