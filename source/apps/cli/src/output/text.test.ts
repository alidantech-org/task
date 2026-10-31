import { describe, expect, test } from "bun:test";
import { displayWidth, terminalWidth, truncate } from "#/output/text";

describe("terminal text layout", () => {
  test("counts CJK and emoji as double width", () => {
    expect(displayWidth("a界🙂")).toBe(5);
  });

  test("truncates without exceeding target display width", () => {
    expect(truncate("Long 界 heading", 8)).toBe("Long 界…");
    expect(displayWidth(truncate("Long 界 heading", 8))).toBeLessThanOrEqual(8);
  });

  test("uses bounded terminal width with an 80-column fallback", () => {
    expect(terminalWidth({}, undefined)).toBe(80);
    expect(terminalWidth({}, 48)).toBe(48);
    expect(terminalWidth({}, 160)).toBe(120);
  });
});
