import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Badge, Button, Card, CardContent } from "#/index";

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
});
