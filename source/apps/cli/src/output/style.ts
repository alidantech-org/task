import pc from "picocolors";
import type { StreamTerminal } from "#/output/terminal";

export interface Style {
  accent(value: string): string;
  success(value: string): string;
  warning(value: string): string;
  error(value: string): string;
  muted(value: string): string;
  strong(value: string): string;
}

export function createStyle(terminal: StreamTerminal): Style {
  const wrap =
    (formatter: (value: string) => string) =>
    (value: string): string =>
      terminal.color ? formatter(value) : value;
  return {
    accent: wrap(pc.cyan),
    success: wrap(pc.green),
    warning: wrap(pc.yellow),
    error: wrap(pc.red),
    muted: wrap(pc.dim),
    strong: wrap(pc.bold),
  };
}
