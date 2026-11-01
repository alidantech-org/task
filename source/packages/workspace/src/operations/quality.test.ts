import { describe, expect, test } from "bun:test";
import {
  assessGroupDocBody,
  assessTaskBody,
  countWords,
  defaultQuality,
  resolveQuality,
} from "#/operations/quality";

const prose = (words: number) =>
  Array.from({ length: words }, (_, index) => `word${index}`).join(" ");
const good = [
  "# Build the importer",
  "",
  "## Goal",
  prose(80),
  "",
  "## Context",
  prose(40),
  "",
  "## Acceptance checklist",
  "- [ ] Parse the file format",
  "- [ ] Report row errors",
  "- [ ] Cover edge cases with tests and documentation",
  prose(30),
].join("\n");

describe("quality assessment", () => {
  test("accepts a detailed task", () => {
    expect(assessTaskBody(good, defaultQuality)).toEqual([]);
  });

  test("flags a scaffold-only task with every problem", () => {
    const findings = assessTaskBody(
      "# Title\n\n## Goal\n\n## Acceptance checklist\n",
      defaultQuality,
    );
    const codes = findings.map((finding) => finding.code);
    expect(codes).toContain("too_short");
    expect(codes).toContain("empty_heading");
    expect(codes).toContain("missing_section");
    expect(codes).toContain("too_few_checkboxes");
  });

  test("ignores comments and fenced code when counting words and flags placeholders", () => {
    expect(countWords("<!-- ignore me please -->\n```\ncode words here\n```\nreal words")).toBe(2);
    const findings = assessTaskBody(`${good}\nTODO fill later`, defaultQuality);
    expect(findings.map((finding) => finding.code)).toEqual(["placeholder_text"]);
  });

  test("applies configurable thresholds and group document rules", () => {
    const relaxed = resolveQuality({
      workspace: "tasks",
      quality: { minTaskWords: 5, minChecklistItems: 1 },
    });
    expect(assessTaskBody("## Goal\nwhy this matters now\n## Steps\n- [ ] do it", relaxed)).toEqual(
      [],
    );
    expect(assessGroupDocBody("# Goal\n\nshort", defaultQuality, "goal.md")[0]?.code).toBe(
      "too_short",
    );
    expect(assessGroupDocBody(`# Goal\n\n${prose(120)}`, defaultQuality, "goal.md")).toEqual([]);
  });
});
