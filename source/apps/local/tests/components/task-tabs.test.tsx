import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { RecordItem } from "@/components/layout/app-layout";
import { TaskActivity } from "@/components/task-activity";
import { TaskComments } from "@/components/task-comments";
import { TaskFiles } from "@/components/task-files";
import { TaskProperties } from "@/components/task-properties";
import { TaskSubtasks } from "@/components/task-subtasks";

const record = (overrides: Partial<RecordItem> = {}): RecordItem => ({
  id: "TSK-1",
  path: "todo/g/001-a.md",
  name: "Parent task",
  type: "task",
  tags: ["bug"],
  status: "planned",
  size: 1,
  modifiedAt: 1,
  contentHash: "h",
  ...overrides,
});

describe("task sheet tabs", () => {
  test("subtasks show a rollup, the parent link and an add form", () => {
    const markup = renderToStaticMarkup(
      <TaskSubtasks
        task={record()}
        parent={record({ id: "TSK-0", name: "Epic" })}
        subtasks={[
          record({ id: "TSK-2", name: "Done one", status: "completed" }),
          record({ id: "TSK-3", name: "Open one" }),
        ]}
        onOpen={() => undefined}
        onAdd={async () => true}
      />,
    );
    expect(markup).toContain("1/2 subtasks done");
    expect(markup).toContain("Subtask of");
    expect(markup).toContain("Epic");
    expect(markup).toContain("Done one");
    expect(markup).toContain('aria-label="New subtask title"');
  });

  test("files list stored files for download and links for opening", () => {
    const markup = renderToStaticMarkup(
      <TaskFiles
        taskId="TSK-1"
        attachments={[
          {
            kind: "file",
            name: "spec.pdf",
            size: 2500,
            added_at: "2026-11-01T00:00:00Z",
            added_by: "Ann",
          },
          {
            kind: "link",
            name: "Design",
            url: "https://example.com/d",
            added_at: "2026-11-01T00:00:00Z",
          },
        ]}
        onChanged={() => undefined}
        onNotice={() => undefined}
      />,
    );
    expect(markup).toContain("Add a file (up to 1 MB)");
    expect(markup).toContain('href="/api/runtime/workspace/task/TSK-1/attachments/spec.pdf"');
    expect(markup).toContain("2.5 KB");
    expect(markup).toContain('href="https://example.com/d"');
    expect(markup).toContain('rel="noopener noreferrer"');
    expect(markup).toContain("Add link");
  });

  test("comments and activity start in a loading state with a composer", () => {
    const comments = renderToStaticMarkup(
      <TaskComments taskId="TSK-1" onChanged={() => undefined} onNotice={() => undefined} />,
    );
    expect(comments).toContain("Loading comments");
    expect(comments).toContain("Use @name to mention someone");
    expect(renderToStaticMarkup(<TaskActivity taskId="TSK-1" refreshKey="a" />)).toContain(
      "Loading activity",
    );
  });

  test("properties show every editable field with current values", () => {
    const markup = renderToStaticMarkup(
      <TaskProperties
        task={record({
          assignee: "ann",
          estimate: 3,
          watchers: ["peter"],
          links: [{ type: "blocks", task: "TSK-9" }],
        })}
        candidates={[record({ id: "TSK-9", name: "Other" })]}
        groups={[{ id: "GRP-1", name: "Work" }]}
        assignees={["ann"]}
        currentGroupId="GRP-1"
        onSave={async () => true}
      />,
    );
    for (const label of [
      "Assignee",
      "Estimate",
      "Start date",
      "Group",
      "Parent task",
      "Repeat",
      "Labels",
      "Watchers",
      "Linked tasks",
    ])
      expect(markup).toContain(label);
    expect(markup).toContain('value="ann"');
    expect(markup).toContain('value="3"');
    expect(markup).toContain("peter");
    expect(markup).toContain("blocks");
    expect(markup).toContain("Other");
  });
});
