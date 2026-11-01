import { describe, expect, test } from "bun:test";
import { highlightLines } from "@/lib/highlight";

describe("highlightLines", () => {
  test("returns coloured tokens per line for known languages", async () => {
    const lines = await highlightLines("const a = 1;\nreturn a;", "typescript");
    expect(lines).toHaveLength(2);
    expect(lines[0]?.map((token) => token.content).join("")).toBe("const a = 1;");
    expect(lines[0]?.some((token) => token.light && token.dark)).toBe(true);
  });

  test("falls back to plain text for unknown languages", async () => {
    const lines = await highlightLines("hello", "not-a-language");
    expect(lines[0]?.map((token) => token.content).join("")).toBe("hello");
  });
});
