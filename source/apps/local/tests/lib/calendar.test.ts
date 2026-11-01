import { describe, expect, it } from "bun:test";
import { dateKey, monthGrid, weekGrid } from "@/lib/calendar";

describe("calendar date calculations", () => {
  it("builds a month grid beginning on Monday", () => {
    const grid = monthGrid(new Date(2026, 9, 1));
    expect(grid).toHaveLength(35);
    const first = grid.at(0);
    const last = grid.at(-1);
    expect(first ? dateKey(first) : undefined).toBe("2026-09-28");
    expect(last ? dateKey(last) : undefined).toBe("2026-11-01");
  });

  it("uses only the complete rows needed for a month", () => {
    expect(monthGrid(new Date(2021, 1, 1))).toHaveLength(28);
    expect(monthGrid(new Date(2026, 7, 1))).toHaveLength(42);
  });

  it("builds a week containing the selected day", () => {
    expect(weekGrid(new Date(2026, 9, 31)).map(dateKey)).toEqual([
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
    ]);
  });
});
