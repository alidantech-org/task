import { describe, expect, test } from "bun:test";
import { describeDue, descriptionOf, formatDuration, inProgressMs } from "@/lib/task-analytics";

const at = (hour: number) => `2026-11-01T${String(hour).padStart(2, "0")}:00:00.000Z`;

describe("inProgressMs", () => {
  test("sums closed windows and the open one", () => {
    const history = [
      { from: "planned", to: "in-progress", at: at(1) },
      { from: "in-progress", to: "blocked", at: at(2) },
      { from: "blocked", to: "in-progress", at: at(4) },
    ];
    expect(inProgressMs(history, "blocked", Date.parse(at(9)))).toBe(3_600_000 * 1);
    expect(inProgressMs(history, "in-progress", Date.parse(at(6)))).toBe(3_600_000 * 3);
    expect(inProgressMs(undefined, "planned", Date.now())).toBe(0);
  });
});

describe("formatDuration", () => {
  test("uses the largest sensible units", () => {
    expect(formatDuration(30_000)).toBe("< 1 min");
    expect(formatDuration(5 * 60_000)).toBe("5 min");
    expect(formatDuration(125 * 60_000)).toBe("2 h 5 min");
    expect(formatDuration(51 * 3_600_000)).toBe("2 d 3 h");
  });
});

describe("describeDue", () => {
  const now = new Date("2026-11-10T15:00:00").getTime();
  test("flags overdue, soon and distant dates", () => {
    expect(describeDue("2026-11-08", "planned", now)).toEqual({
      text: "2 days overdue",
      tone: "late",
    });
    expect(describeDue("2026-11-10", "planned", now).text).toBe("Due today");
    expect(describeDue("2026-11-11", "planned", now).text).toBe("Due tomorrow");
    expect(describeDue("2026-11-20", "planned", now)).toEqual({
      text: "Due in 10 days",
      tone: "ok",
    });
    expect(describeDue(undefined, "planned", now).tone).toBe("none");
    expect(describeDue("2026-11-01", "completed", now).tone).toBe("ok");
  });
});

describe("descriptionOf", () => {
  test("prefers the goal section and strips markdown", () => {
    const body =
      "# Title\n\nIntro line.\n\n## Goal\nMake **things** better with [a link](x) today.\n\n## Context\nMore.\n";
    expect(descriptionOf(body)).toEqual({
      text: "Make things better with a link today.",
      truncated: false,
    });
  });

  test("falls back to the first prose, skips lists and code, and truncates", () => {
    expect(descriptionOf("# T\n\n- a\n- b\n\n```\ncode\n```\n\nReal text here.").text).toBe(
      "Real text here.",
    );
    const long = `# T\n\n${Array.from({ length: 100 }, (_, index) => `w${index}`).join(" ")}`;
    const result = descriptionOf(long, 10);
    expect(result.truncated).toBe(true);
    expect(result.text.endsWith("…")).toBe(true);
    expect(descriptionOf("# Only a title").text).toBe("");
  });
});
