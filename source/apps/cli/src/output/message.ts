import type { Style } from "#/output/style";
import type { Symbols } from "#/output/symbols";

export function renderMessage(
  kind: "success" | "warning" | "error",
  message: string,
  style: Style,
  symbols: Symbols,
): string {
  const marker =
    kind === "success" ? symbols.success : kind === "warning" ? symbols.warning : symbols.error;
  const color =
    kind === "success" ? style.success : kind === "warning" ? style.warning : style.error;
  return `${color(marker)} ${message}`;
}
