import { describe, expect, test } from "bun:test";
import { parseQuickAdd } from "@/lib/quick-add";

describe("parseQuickAdd", () => {
  const groups = [
    { id: "docs-id", name: "Docs" },
    { id: "web-id", name: "Web app" },
  ];

  test("extracts a next-occurrence weekday and matching group prefix", () => {
    expect(
      parseQuickAdd("Review API fri #docs", groups, "", new Date("2026-11-01T12:00:00")),
    ).toEqual({
      title: "Review API",
      dueDate: "2026-11-06",
      groupId: "docs-id",
    });
  });

  test("keeps unknown date and group tokens in the title", () => {
    expect(parseQuickAdd("Plan #unknown", groups, "", new Date("2026-11-01T12:00:00"))).toEqual({
      title: "Plan #unknown",
      dueDate: "",
      groupId: "",
    });
  });

  test("uses the calendar date unless a title date token overrides it", () => {
    expect(
      parseQuickAdd("Ship tomorrow", groups, "2026-11-05", new Date("2026-11-01T12:00:00")),
    ).toEqual({
      title: "Ship",
      dueDate: "2026-11-02",
      groupId: "",
    });
  });

  test("parses today, tomorrow, and a weekday that falls on the current day", () => {
    const now = new Date("2026-11-02T12:00:00");
    expect(parseQuickAdd("Ship today", groups, "", now)).toEqual({
      title: "Ship",
      dueDate: "2026-11-02",
      groupId: "",
    });
    expect(parseQuickAdd("Ship tomorrow", groups, "", now)).toEqual({
      title: "Ship",
      dueDate: "2026-11-03",
      groupId: "",
    });
    expect(parseQuickAdd("Review monday", groups, "", now)).toEqual({
      title: "Review",
      dueDate: "2026-11-09",
      groupId: "",
    });
  });

  test("matches group prefixes without case or whitespace differences", () => {
    expect(
      parseQuickAdd("Review API fri #web", groups, "", new Date("2026-11-01T12:00:00")),
    ).toEqual({
      title: "Review API",
      dueDate: "2026-11-06",
      groupId: "web-id",
    });
    expect(parseQuickAdd("Review #WEB", groups, "", new Date("2026-11-01T12:00:00"))).toEqual({
      title: "Review",
      dueDate: "",
      groupId: "web-id",
    });
  });
});
