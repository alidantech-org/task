import { describe, expect, mock, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

mock.module("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({
    back: () => undefined,
    forward: () => undefined,
    push: () => undefined,
    replace: () => undefined,
    refresh: () => undefined,
    prefetch: async () => undefined,
  }),
}));

const { App } = await import("@/components/layout/app-layout");
const { OverviewPage } = await import("@/components/pages/overview-page");

describe("local dashboard", () => {
  test("renders one persistent shell around route content", () => {
    const markup = renderToStaticMarkup(
      <App runtimeStatus="connected" workspace={null}>
        <div>Route content</div>
      </App>,
    );
    expect(markup).toContain("Search or jump to…");
    expect(markup).toContain("Route content");
    expect(markup).not.toContain("Live");
    expect(markup).toContain('data-slot="task-app-shell"');
    expect(markup).toContain('data-slot="main-toolbar"');
    expect(markup).toContain('aria-label="Workspace navigation"');
    expect(markup.match(/data-slot="global-navigation"/g)).toHaveLength(1);
    expect(markup).not.toContain('data-slot="contextual-sidebar"');
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
    expect(markup).toContain("Search or jump to…");
    expect(markup).toContain("Overview");
  });

  test("shows archived tasks in completion history without adding them to active task totals", () => {
    const markup = renderToStaticMarkup(
      <App
        runtimeStatus="connected"
        initialPath="/"
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
      >
        <OverviewPage />
      </App>,
    );
    expect(markup).toContain("Where things stand");
    expect(markup).toContain("Recently finished");
    expect(markup).not.toContain("Archived</b>");
    expect(markup).toContain("<b>1</b><small>tasks</small>");
  });
});
