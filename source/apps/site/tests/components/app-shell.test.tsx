import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { App } from "@/components/app-shell";

describe("hosted site starter", () => {
  test("renders the hosted workspace landing screen and API state", () => {
    const markup = renderToStaticMarkup(<App apiStatus="connected" />);
    expect(markup).toContain("Make room for meaningful progress.");
    expect(markup).toContain("Task Cloud foundations are taking shape.");
    expect(markup).toContain("API connected");
    expect(markup).toContain("Keep context close");
  });

  test("renders the offline API state clearly", () => {
    const markup = renderToStaticMarkup(<App apiStatus="offline" />);
    expect(markup).toContain("API unavailable");
    expect(markup).toContain("Cloud workflows are not available");
  });
});
