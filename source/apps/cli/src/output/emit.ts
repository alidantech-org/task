import type { ParsedArgs } from "#/command";
import type { Style } from "#/output/style";
import type { Symbols } from "#/output/symbols";

export type OutputKind = "routine" | "requested" | "diagnostic";

export interface OutputContext {
  args: ParsedArgs;
  stdoutStyle: Style;
  stderrStyle: Style;
  stdoutSymbols: Symbols;
  stderrSymbols: Symbols;
}

export function emitLine(context: OutputContext, value = "", kind: OutputKind = "routine"): void {
  if (context.args.options.has("json")) return;
  if (kind === "routine" && context.args.options.has("quiet")) return;
  console.log(value);
}

export function emitError(context: OutputContext, value: string, marker = true): void {
  const prefix = marker ? `${context.stderrStyle.error(context.stderrSymbols.error)} ` : "";
  console.error(`${prefix}${value}`);
}

export function emitJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}
