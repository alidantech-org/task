import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { App } from "@/components/app-shell";

describe("local dashboard starter", () => {
  test("renders the local workspace landing screen and runtime state", () => {
    const markup = renderToStaticMarkup(<App runtimeStatus="connected" />);
    expect(markup).toContain("Your work, in one place.");
    expect(markup).toContain("Local workspace");
    expect(markup).toContain("Runtime connected");
    expect(markup).toContain("Workspace connection");
  });

  test("shows when the local runtime is unavailable", () => {
    const markup = renderToStaticMarkup(<App runtimeStatus="offline" />);
    expect(markup).toContain("Runtime offline");
    expect(markup).toContain("could not be reached");
  });
});
