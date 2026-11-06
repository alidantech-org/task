import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { DialogProvider, useDialogs } from "@/components/dialogs";

function Probe() {
  const { confirm, prompt } = useDialogs();
  return (
    <p data-ready={typeof confirm === "function" && typeof prompt === "function" ? "yes" : "no"}>
      probe
    </p>
  );
}

let api: ReturnType<typeof useDialogs> | undefined;
function Capture() {
  api = useDialogs();
  return null;
}

describe("dialogs", () => {
  test("components can use the dialog api inside and outside the provider", async () => {
    expect(renderToStaticMarkup(<Probe />)).toContain('data-ready="yes"');
    expect(
      renderToStaticMarkup(
        <DialogProvider>
          <Probe />
        </DialogProvider>,
      ),
    ).toContain('data-ready="yes"');
  });

  test("without a provider confirm declines and prompt returns nothing instead of using browser popups", async () => {
    renderToStaticMarkup(<Capture />);
    expect(await api?.confirm({ title: "Sure?" })).toBe(false);
    expect(await api?.prompt({ title: "Name", label: "Name" })).toBeNull();
  });
});
