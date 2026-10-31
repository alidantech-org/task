export interface StreamTerminal {
  color: boolean;
  symbols: boolean;
}

export interface TerminalCapabilities {
  stdout: StreamTerminal;
  stderr: StreamTerminal;
}

export interface TerminalInput {
  stdoutTTY: boolean;
  stderrTTY: boolean;
  env: Record<string, string | undefined>;
  stdoutEncoding?: string;
  stderrEncoding?: string;
  platform?: string;
}

function forcedColor(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  return value !== "0" && value.toLowerCase() !== "false";
}

function supportsUnicode(input: TerminalInput, encoding: string | undefined): boolean {
  if (input.env.TASK_SYMBOLS === "unicode") return true;
  if (input.env.TASK_SYMBOLS === "ascii") return false;
  if (input.platform === "win32") return true;
  return encoding?.toLowerCase().includes("utf") ?? false;
}

export function resolveTerminal(input: TerminalInput): TerminalCapabilities {
  const force = forcedColor(input.env.FORCE_COLOR);
  const noColor = input.env.NO_COLOR !== undefined;
  const colorFor = (isTTY: boolean): boolean => {
    if (noColor) return false;
    if (force !== undefined) return force;
    return isTTY && input.env.TERM !== "dumb";
  };
  const stream = (isTTY: boolean, encoding: string | undefined): StreamTerminal => ({
    color: colorFor(isTTY),
    symbols: isTTY && supportsUnicode(input, encoding),
  });
  return {
    stdout: stream(input.stdoutTTY, input.stdoutEncoding),
    stderr: stream(input.stderrTTY, input.stderrEncoding),
  };
}
