import { describe, expect, test } from "bun:test";
import { nextDueDate, nextOccurrence, parseRecurrence } from "#/operations/recurrence";

describe("recurrence", () => {
  test("adds days, weeks and months", () => {
    expect(nextDueDate("2026-11-30", { every: "day", interval: 2 })).toBe("2026-12-02");
    expect(nextDueDate("2026-11-01", { every: "week", interval: 2 })).toBe("2026-11-15");
    expect(nextDueDate("2026-11-15", { every: "month", interval: 1 })).toBe("2026-12-15");
    expect(nextDueDate("2026-12-15", { every: "month", interval: 2 })).toBe("2027-02-15");
  });

  test("clamps month ends", () => {
    expect(nextDueDate("2026-01-31", { every: "month", interval: 1 })).toBe("2026-02-28");
    expect(nextDueDate("2028-01-31", { every: "month", interval: 1 })).toBe("2028-02-29");
  });

  test("stops after the until date", () => {
    const rule = { every: "week" as const, interval: 1, until: "2026-11-08" };
    expect(nextOccurrence("2026-11-01", rule)).toBe("2026-11-08");
    expect(nextOccurrence("2026-11-08", rule)).toBeUndefined();
  });

  test("parses command line text", () => {
    expect(parseRecurrence("week")).toEqual({ every: "week", interval: 1 });
    expect(parseRecurrence("month:3")).toEqual({ every: "month", interval: 3 });
    expect(() => parseRecurrence("year")).toThrow("day, week or month");
    expect(() => parseRecurrence("day:0")).toThrow("1 or more");
  });
});
