import { describe, expect, test } from "bun:test";
import { navigationSections } from "./navigation.js";

describe("TUI navigation", () => {
  test("exposes the initial workspace sections", () => {
    expect(navigationSections).toEqual(["Overview", "Projects", "Tasks", "Documents", "Activity"]);
  });
});
