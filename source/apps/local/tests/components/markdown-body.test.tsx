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
    expect(markup).toContain('<div class="code-viewer compact">');
    expect(markup).toContain("<span>md</span>");
    expect(markup).toContain("<code>[[TASK-17]]</code>");
    expect(markup).toContain(
      'href="https://example.com" target="_blank" rel="noopener noreferrer"',
    );
    expect(markup).toContain('<div class="tw"><table>');
    expect(markup).not.toContain('node="[object Object]"');
  });

  test("opens documents by id, project files with line ranges and blocks unsafe links", () => {
    const markup = renderToStaticMarkup(
      <MarkdownBody
        body={[
          "[Doc](DOC-1) [Sibling](../guides/setup.md#install) [Source](../../../source/app.ts#L10-L20)",
          "[Bad](javascript:alert(1)) [Outside](../../../../../etc/passwd)",
        ].join("\n")}
        linkContext={{
          fromPath: "docs/architecture/overview.md",
          workspacePrefix: "tasks",
          documents: [{ id: "DOC-9", path: "docs/guides/setup.md" }],
        }}
      />,
    );
    expect(markup).toContain('href="/documents/DOC-1"');
    expect(markup).toContain('href="/documents/DOC-9#install"');
    expect(markup).toContain('href="/files?path=source%2Fapp.ts&amp;L=10-20"');
    expect(markup).not.toContain("javascript:");
    expect(markup).not.toContain("etc%2Fpasswd");
    expect(markup).toContain('class="bad-link"');
  });
});
