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
    expect(markup).toContain("border-border");
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

  test("preserves button variants and sizes with Task visual tokens", () => {
    const variants = ["default", "secondary", "outline", "ghost", "destructive"] as const;
    const sizes = ["default", "sm", "lg", "icon"] as const;
    const markup = renderToStaticMarkup(
      <>
        {variants.map((variant) => (
          <Button key={variant} variant={variant}>
            {variant}
          </Button>
        ))}
        {sizes.map((size) => (
          <Button key={size} size={size}>
            {size}
          </Button>
        ))}
        <Button disabled>Unavailable</Button>
      </>,
    );
    expect(markup).toContain('data-variant="destructive"');
    expect(markup).toContain('data-size="icon"');
    expect(markup).toContain("focus-visible:ring-offset-2");
    expect(markup).toContain("disabled:pointer-events-none");
    expect(markup).toContain("rounded-xl");
    expect(markup).toContain("flex-row");
    expect(markup).not.toContain("rounded-[11px]");
  });

  test("asChild keeps the custom styling on the child element", () => {
    const markup = renderToStaticMarkup(
      <Button asChild variant="outline">
        <a href="/tasks">Tasks</a>
      </Button>,
    );
    expect(markup).toContain('<a href="/tasks" class="');
    expect(markup).toContain('href="/tasks"');
    expect(markup).toContain('data-slot="button"');
  });
});
