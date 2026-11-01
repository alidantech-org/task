import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { BulkBar } from "@/components/bulk-bar";

const render = (count: number, busy = false) =>
  renderToStaticMarkup(
    <BulkBar
      count={count}
      total={5}
      groups={[{ id: "GRP-1", name: "Work" }]}
      busy={busy}
      onApply={() => undefined}
      onSelectAll={() => undefined}
      onClear={() => undefined}
    />,
  );

describe("BulkBar", () => {
  test("shows the selection count and every bulk action", () => {
    const markup = render(2);
    expect(markup).toContain("2 selected");
    for (const label of [
      "Set status",
      "Set priority",
      "Move to group",
      "Assign to",
      "Archive",
      "Delete",
      "Select all 5",
      "Done",
    ])
      expect(markup).toContain(label);
    expect(markup).toContain("Status…");
    expect(markup).toContain('role="combobox"');
  });

  test("disables actions with nothing selected or while working", () => {
    expect((render(0).match(/disabled=""/g) ?? []).length).toBeGreaterThanOrEqual(6);
    expect((render(3, true).match(/disabled=""/g) ?? []).length).toBeGreaterThanOrEqual(6);
    expect(render(5)).toContain("disabled");
  });
});
