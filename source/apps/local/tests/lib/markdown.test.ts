import { describe, expect, test } from "bun:test";
import {
  appendTimestampedMarkdownComment,
  markdownChecklistProgress,
  rootFiles,
  toggleMarkdownCheckbox,
  topLevelFolders,
} from "@/lib/markdown";

describe("Markdown task interactions", () => {
  test("toggles ordered and unordered checklist items without changing other Markdown", () => {
    const body = "Intro\n\n- [ ] First\n  1. [x] Nested\n\nParagraph";
    expect(toggleMarkdownCheckbox(body, 0, true)).toBe(
      "Intro\n\n- [x] First\n  1. [x] Nested\n\nParagraph",
    );
    expect(toggleMarkdownCheckbox(body, 1, false)).toBe(
      "Intro\n\n- [ ] First\n  1. [ ] Nested\n\nParagraph",
    );
    expect(toggleMarkdownCheckbox(body, 4, true)).toBe(body);
  });

  test("appends timestamped comments in a readable Markdown section", () => {
    const body = "# Task\n\nWork description\n";
    const first = appendTimestampedMarkdownComment(body, "Started work", "2026-11-01T12:00:00Z");
    const second = appendTimestampedMarkdownComment(
      first,
      "Review requested",
      "2026-11-01T13:00:00Z",
    );
    expect(second).toContain("## Comments");
    expect(second.match(/## Comments/g)).toHaveLength(1);
    expect(second).toContain("- **2026-11-01T12:00:00Z** — Started work");
    expect(second).toContain("- **2026-11-01T13:00:00Z** — Review requested");
    expect(appendTimestampedMarkdownComment(body, "   ", "2026-11-01T14:00:00Z")).toBe(body);
  });

  test("counts checklist completion for board card progress", () => {
    expect(
      markdownChecklistProgress("- [x] Done\n- [ ] Open\n  1. [X] Also done\nPlain text"),
    ).toEqual({ completed: 2, total: 3 });
    expect(markdownChecklistProgress("No checklist here")).toEqual({ completed: 0, total: 0 });
  });
});

describe("documents sidebar structure", () => {
  test("root files are files and only real directories are folders", () => {
    const paths = ["README.md", "AGENTS.md", "docs/a.md", "docs/sub/b.md", "decisions/0001.md"];
    expect(topLevelFolders(paths)).toEqual([
      { name: "decisions", count: 1 },
      { name: "docs", count: 2 },
    ]);
    expect(rootFiles(paths.map((path) => ({ path }))).map((file) => file.path)).toEqual([
      "README.md",
      "AGENTS.md",
    ]);
    expect(topLevelFolders(["README.md"])).toEqual([]);
  });
});
