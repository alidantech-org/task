import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { TaskChecklist } from "@/components/task-checklist";

const body = "# T\n\n## Design\n- [x] sketch\n- [ ] review\n\n## Build\n- [ ] implement\n";

describe("TaskChecklist", () => {
  test("shows checkboxes under their headings with a toggle in each section header", () => {
    const markup = renderToStaticMarkup(
      <TaskChecklist body={body} disabled={false} onChange={() => undefined} />,
    );
    expect(markup).toContain("<h3>Design</h3>");
    expect(markup).toContain("<h3>Build</h3>");
    expect(markup).toContain('type="checkbox" class="check-input" checked=""');
    expect(markup).toContain("Check or uncheck every step in Design");
    expect(markup).toContain("Check or uncheck every step in Build");
    expect(markup).not.toContain("Check all</button>");
    expect(markup).not.toContain("Uncheck all</button>");
    expect(markup).not.toContain("done</strong>");
  });

  test("explains how to add checkboxes when there are none", () => {
    const markup = renderToStaticMarkup(
      <TaskChecklist body="# Empty" disabled={false} onChange={() => undefined} />,
    );
    expect(markup).toContain("no checkboxes yet");
  });

  test("disables every control while a save is in flight", () => {
    const markup = renderToStaticMarkup(
      <TaskChecklist body={body} disabled onChange={() => undefined} />,
    );
    expect((markup.match(/disabled=""/g) ?? []).length).toBeGreaterThanOrEqual(5);
  });
});
