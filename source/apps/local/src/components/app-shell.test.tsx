import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { App } from "@/components/app-shell";

describe("local dashboard", () => {
  test("renders the workspace shell, global search and runtime state", () => {
    const markup = renderToStaticMarkup(<App runtimeStatus="connected" workspace={null} />);
    expect(markup).toContain("Workspace overview");
    expect(markup).toContain("Search workspace");
    expect(markup).toContain("Runtime connected");
    expect(markup).toContain("Calendar");
  });

  test("shows when the local runtime is unavailable", () => {
    const markup = renderToStaticMarkup(<App runtimeStatus="offline" workspace={null} />);
    expect(markup).toContain("Runtime offline");
    expect(markup).toContain("Connect a project");
  });
});
