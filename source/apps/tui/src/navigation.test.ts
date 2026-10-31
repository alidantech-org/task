import { describe, expect, test } from "bun:test";
import { clampIndex, navigationSections, wrapIndex } from "#/navigation";

describe("TUI navigation model", () => {
  test("exposes the planned workspace sections", () => {
    expect(navigationSections).toEqual(["Tasks", "Groups", "Docs", "Rules", "Agents", "Activity"]);
  });

  test("wraps section movement and clamps item movement", () => {
    expect(wrapIndex(6, 6)).toBe(0);
    expect(wrapIndex(-1, 6)).toBe(5);
    expect(clampIndex(7, 3)).toBe(2);
    expect(clampIndex(1, 0)).toBe(0);
  });
});
