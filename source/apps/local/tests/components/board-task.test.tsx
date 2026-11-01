import { describe, expect, test } from "bun:test";
import { DragDropProvider } from "@dnd-kit/react";
import { renderToStaticMarkup } from "react-dom/server";
import { BoardTask } from "@/components/board-task";

const task = {
  id: "TSK-1",
  name: "A very long task name that should be clamped to two lines on the board card",
  groupName: "Release group",
  due_at: "2026-11-05",
  priority: "high",
  assignee: "Peter",
  status: "in-progress",
  checklist: { completed: 1, total: 4 },
};

function render(overrides = {}) {
  return renderToStaticMarkup(
    <DragDropProvider>
      <BoardTask task={{ ...task, ...overrides }} index={0} onSelect={() => undefined} />
    </DragDropProvider>,
  );
}

describe("BoardTask", () => {
  test("shows the group name, date and a priority dot but no status text", () => {
    const markup = render();
    expect(markup).toContain('class="cg"');
    expect(markup).toContain("Release group");
    expect(markup).toContain("Nov 5");
    expect(markup).toContain('class="pri p-h"');
    expect(markup).not.toContain("In progress");
    expect(markup).not.toContain(">in-progress<");
  });

  test("has a hover button that opens the task sheet and a checklist bar", () => {
    const markup = render();
    expect(markup).toContain('class="card-open"');
    expect(markup).toContain("Open task sheet for");
    expect(markup).toContain('aria-valuenow="25"');
  });

  test("falls back to project then Ungrouped and hides the bar without checklist items", () => {
    expect(render({ groupName: undefined, project: "Website" })).toContain("Website");
    const bare = render({ groupName: undefined, checklist: undefined });
    expect(bare).toContain("Ungrouped");
    expect(bare).not.toContain("progressbar");
  });
});
