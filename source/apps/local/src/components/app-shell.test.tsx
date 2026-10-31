import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { App } from "@/components/app-shell";

describe("local dashboard", () => {
  test("renders the workspace shell, global search and simple toolbar", () => {
    const markup = renderToStaticMarkup(<App runtimeStatus="connected" workspace={null} />);
    expect(markup).toContain("Workspace overview");
    expect(markup).toContain("Search workspace");
    expect(markup).not.toContain("Connected");
    expect(markup).toContain('aria-label="Tasks"');
    expect(markup).toContain('data-slot="task-app-shell"');
    expect(markup).toContain('data-slot="main-toolbar"');
    expect(markup).toContain('aria-label="Workspace navigation"');
    expect(markup).toContain('aria-label="Hide sidebar"');
    expect(markup).toContain('aria-haspopup="menu"');
    expect(markup).toContain('data-slot="project-switcher"');
    expect(markup).toContain('src="/task-symbol.svg"');
    expect(markup).toContain('data-slot="global-navigation"');
    expect(markup).toContain('data-slot="contextual-sidebar"');
    expect(markup).toContain('aria-label="Create task"');
    expect(markup).not.toContain(">New task</button>");
    expect(markup).toContain("h-svh");
  });

  test("shows when the local runtime is unavailable", () => {
    const markup = renderToStaticMarkup(<App runtimeStatus="offline" workspace={null} />);
    expect(markup).toContain("Local runtime connection failed");
    expect(markup).toContain("Retry connection");
    expect(markup).toContain('role="alert"');
    expect(markup).toContain('aria-label="Workspace navigation"');
  });

  test("renders the selected project name from the supplied initial snapshot", () => {
    const markup = renderToStaticMarkup(
      <App
        runtimeStatus="connected"
        workspace={{
          projectName: "Selected project",
          projectRoot: "/projects/selected",
          workspaceRoot: "/projects/selected/tasks",
          workspaceDirectory: "tasks",
          source: "default",
          scannedAt: 0,
          groups: [],
          documents: [],
          diagnostics: [],
          overview: {
            tasks: 0,
            planned: 0,
            inProgress: 0,
            blocked: 0,
            completed: 0,
            documents: 0,
            diagnostics: 0,
            recent: [],
          },
        }}
      />,
    );
    expect(markup).toContain("Selected project");
    expect(markup).toContain("Tasks completed");
    expect(markup).toContain("Upcoming tasks");
    expect(markup).toContain("Workspace health");
  });

  test("shows archived tasks in completion history without adding them to active task totals", () => {
    const markup = renderToStaticMarkup(
      <App
        runtimeStatus="connected"
        workspace={{
          projectName: "Project",
          projectRoot: "/project",
          workspaceRoot: "/project/tasks",
          workspaceDirectory: "tasks",
          source: "default",
          scannedAt: 0,
          documents: [
            {
              id: "active",
              name: "Active",
              type: "task",
              status: "planned",
              priority: "medium",
              path: "todo/active/001-active.md",
              size: 1,
              modifiedAt: 0,
              contentHash: "active",
              tags: [],
            },
            {
              id: "archived",
              name: "Archived",
              type: "task",
              status: "completed",
              priority: "medium",
              path: "todo/_archived/2026/10/2026-10-31-task-archived/001-archived.md",
              size: 1,
              modifiedAt: 0,
              contentHash: "archived",
              tags: [],
            },
          ],
          groups: [],
          diagnostics: [],
          overview: {
            tasks: 1,
            planned: 1,
            inProgress: 0,
            blocked: 0,
            completed: 0,
            documents: 0,
            diagnostics: 0,
            recent: [],
          },
        }}
      />,
    );
    expect(markup).toContain("Active");
    expect(markup).toContain("Recently completed");
    expect(markup).toContain("Archived");
    expect(markup).toContain("Archived");
    expect(markup).toContain("View all");
  });
});
