import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { App } from "./App.js";

describe("hosted site starter", () => {
  test("renders the hosted workspace landing screen and API state", () => {
    const markup = renderToStaticMarkup(<App apiStatus="connected" />);
    expect(markup).toContain("Make progress, together.");
    expect(markup).toContain("Cloud workspace");
    expect(markup).toContain("Task API connected");
  });
});
