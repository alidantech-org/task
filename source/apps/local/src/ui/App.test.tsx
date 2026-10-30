import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { App } from "./App.js";

describe("local dashboard starter", () => {
  test("renders the local workspace landing screen", () => {
    const markup = renderToStaticMarkup(<App />);
    expect(markup).toContain("Your work, in one place.");
    expect(markup).toContain("Local workspace");
  });
});
