import { describe, expect, test } from "bun:test";
import { renderDiagnostics } from "#/output/diagnostics";
import { createStyle } from "#/output/style";
import { createSymbols } from "#/output/symbols";
import { renderTaskTable } from "#/output/table";

const terminal = { color: false, symbols: false };
const style = createStyle(terminal);
const symbols = createSymbols(terminal);

describe("human output rendering", () => {
  test("uses stacked task rows below 60 columns", () => {
    const rows = renderTaskTable(
      [{ id: "TSK-123456789012", name: "A task", status: "planned", priority: "medium" }],
      { width: 48, symbols, style, env: {} },
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain("A task");
  });

  test("uses a stable table at standard and wide terminal widths", () => {
    for (const width of [80, 120]) {
      const rows = renderTaskTable(
        [{ id: "TSK-123456789012", name: "A task", status: "planned", priority: "medium" }],
        { width, symbols, style, env: {} },
      );
      expect(rows[0]).toContain("TASK");
      expect(rows[1]).toContain("A task");
    }
  });

  test("groups and sorts diagnostics by file, then reports a count", () => {
    const rows = renderDiagnostics(
      [
        { path: "z.md", message: "missing link" },
        { path: "a.md", message: "invalid frontmatter" },
        { path: "a.md", message: "dependency missing" },
      ],
      style,
      symbols,
    );
    expect(rows[0]).toBe("a.md");
    expect(rows[3]).toBe("z.md");
    expect(rows.at(-1)).toBe("3 errors, 0 warnings.");
  });
});
