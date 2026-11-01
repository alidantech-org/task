import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MarkdownBody } from "@/components/markdown-body";

describe("MarkdownBody reference rendering", () => {
  test("renders workspace links, missing links, fenced code, external links, and scrollable tables", () => {
    const markup = renderToStaticMarkup(
      <MarkdownBody
        body={[
          "Open [[TASK-17]] and [[missing]].",
          "",
          "```md",
          "[[TASK-17]]",
          "```",
          "",
          "[Reference](https://example.com)",
          "",
          "| Name | State |",
          "| --- | --- |",
          "| Task | Open |",
        ].join("\n")}
        knownWikiLinks={["TASK-17"]}
        onWikiLink={() => undefined}
      />,
    );

    expect(markup).toContain('class="wl " title="Open TASK-17"');
    expect(markup).toContain('class="wl bad" title="No file named missing"');
    expect(markup).toContain('<code class="language-md">[[TASK-17]]');
    expect(markup).toContain(
      'href="https://example.com" target="_blank" rel="noopener noreferrer"',
    );
    expect(markup).toContain('<div class="tw"><table>');
    expect(markup).not.toContain('node="[object Object]"');
  });
});
