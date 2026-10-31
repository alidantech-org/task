import type { StreamTerminal } from "#/output/terminal";

export interface Symbols {
  success: string;
  warning: string;
  error: string;
  bullet: string;
  task: string;
  group: string;
  document: string;
}

export function createSymbols(terminal: StreamTerminal): Symbols {
  return terminal.symbols
    ? { success: "✓", warning: "!", error: "✗", bullet: "•", task: "▸", group: "◆", document: "▤" }
    : { success: "+", warning: "!", error: "x", bullet: "-", task: ">", group: "*", document: "#" };
}
