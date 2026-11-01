import { describe, expect, test } from "bun:test";
import { relativeTime, splitMentions } from "@/lib/mentions";

describe("splitMentions", () => {
  test("highlights mentions without touching emails or the surrounding text", () => {
    expect(splitMentions("ping @peter and (@ann.lee), mail a@b.com")).toEqual([
      { text: "ping " },
      { text: "@peter", mention: "peter" },
      { text: " and (" },
      { text: "@ann.lee", mention: "ann.lee" },
      { text: "), mail a@b.com" },
    ]);
    expect(splitMentions("nothing here")).toEqual([{ text: "nothing here" }]);
    expect(splitMentions("@solo")).toEqual([{ text: "@solo", mention: "solo" }]);
  });
});

describe("relativeTime", () => {
  const now = Date.parse("2026-11-01T12:00:00Z");
  test("uses the largest sensible unit", () => {
    expect(relativeTime("2026-11-01T11:59:30Z", now)).toBe("30 seconds ago");
    expect(relativeTime("2026-11-01T11:00:00Z", now)).toBe("1 hour ago");
    expect(relativeTime("2026-10-30T12:00:00Z", now)).toBe("2 days ago");
    expect(relativeTime("2026-01-05T12:00:00Z", now)).toContain("2026");
    expect(relativeTime("nonsense", now)).toBe("nonsense");
  });
});
