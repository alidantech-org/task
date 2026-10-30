import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { App } from "./App.js";

describe("hosted site starter", () => {
  test("renders a useful hosted workspace landing screen", () => {
    const markup = renderToStaticMarkup(<App />);
    expect(markup).toContain("Make progress, together.");
    expect(markup).toContain("Cloud workspace");
  });
});
