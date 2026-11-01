import { describe, expect, test } from "bun:test";
import {
  clampStoredWidth,
  defaultSheetWidth,
  hideBelowWidth,
  minSheetWidth,
  resolveSheetWidth,
} from "@/lib/sheet-width";

describe("resolveSheetWidth", () => {
  test("follows the pointer within the allowed range", () => {
    expect(resolveSheetWidth(700, 1400)).toEqual({ width: 700, hide: false });
    expect(resolveSheetWidth(5000, 1400)).toEqual({ width: 1376, hide: false });
  });

  test("snaps up to the minimum between the minimum and the hide threshold", () => {
    expect(resolveSheetWidth(hideBelowWidth, 1400)).toEqual({ width: minSheetWidth, hide: false });
    expect(resolveSheetWidth(400, 1400)).toEqual({ width: minSheetWidth, hide: false });
  });

  test("asks to hide below the threshold while keeping a visible width", () => {
    expect(resolveSheetWidth(hideBelowWidth - 1, 1400)).toEqual({ width: 379, hide: true });
    expect(resolveSheetWidth(50, 1400)).toEqual({ width: 280, hide: true });
  });
});

describe("clampStoredWidth", () => {
  test("falls back to the default for missing or invalid values", () => {
    expect(clampStoredWidth(null, 1400)).toBe(defaultSheetWidth);
    expect(clampStoredWidth("abc", 1400)).toBe(defaultSheetWidth);
  });

  test("keeps stored widths usable on narrower screens", () => {
    expect(clampStoredWidth("1100", 800)).toBe(776);
    expect(clampStoredWidth("100", 1400)).toBe(defaultSheetWidth);
  });
});
