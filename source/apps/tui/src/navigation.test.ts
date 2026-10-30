import { describe, expect, test } from "bun:test";
import { navigationSections } from "#/navigation";

describe("TUI navigation", () => {
  test("exposes the initial workspace sections", () => {
    expect(navigationSections).toEqual(["Overview", "Projects", "Tasks", "Documents", "Activity"]);
  });
});
