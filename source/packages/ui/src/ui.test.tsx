import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Badge, Button, Card, CardContent, InputGroup, InputGroupInput, Sidebar } from "#/index";

describe("shared UI primitives", () => {
  test("render semantic controls with shared styles", () => {
    const markup = renderToStaticMarkup(
      <Card>
        <CardContent>
          <Badge variant="success">Connected</Badge>
          <Button variant="outline">Open workspace</Button>
        </CardContent>
      </Card>,
    );
    expect(markup).toContain("Connected");
    expect(markup).toContain("Open workspace");
    expect(markup).toContain("border-input");
  });

  test("provides a single-border search group and shared sidebar primitive", () => {
    const markup = renderToStaticMarkup(
      <>
        <InputGroup>
          <InputGroupInput aria-label="Search workspace" />
        </InputGroup>
        <Sidebar aria-label="Workspace navigation" />
      </>,
    );
    expect(markup).toContain("focus-within:ring-2");
    expect(markup).toContain('data-slot="sidebar"');
    expect(markup.match(/border-input/g)).toHaveLength(1);
  });
});
