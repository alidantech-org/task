import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { App } from "@/components/app-shell";

describe("local dashboard starter", () => {
  test("renders the local workspace landing screen and runtime state", () => {
    const markup = renderToStaticMarkup(<App runtimeStatus="connected" workspace={null} />);
    expect(markup).toContain("Connect a workspace");
    expect(markup).toContain("no workspace snapshot");
    expect(markup).toContain("Runtime connected");
  });

  test("shows when the local runtime is unavailable", () => {
    const markup = renderToStaticMarkup(<App runtimeStatus="offline" workspace={null} />);
    expect(markup).toContain("Runtime offline");
    expect(markup).toContain("Connect a workspace");
  });
});
