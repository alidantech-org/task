import { describe, expect, test } from "bun:test";
import { resolveTerminal } from "#/output/terminal";

describe("terminal capabilities", () => {
  test("disables color and symbols for pipelines by default", () => {
    const terminal = resolveTerminal({ stdoutTTY: false, stderrTTY: false, env: {} });
    expect(terminal.stdout.color).toBe(false);
    expect(terminal.stdout.symbols).toBe(false);
  });

  test("honors NO_COLOR and explicit overrides independently per stream", () => {
    const terminal = resolveTerminal({
      stdoutTTY: true,
      stderrTTY: false,
      env: { NO_COLOR: "", TASK_SYMBOLS: "ascii" },
    });
    expect(terminal.stdout.color).toBe(false);
    expect(terminal.stderr.color).toBe(false);
    expect(terminal.stdout.symbols).toBe(false);
  });

  test("uses forced color when explicitly enabled", () => {
    const terminal = resolveTerminal({
      stdoutTTY: false,
      stderrTTY: true,
      env: { FORCE_COLOR: "1" },
    });
    expect(terminal.stdout.color).toBe(true);
    expect(terminal.stderr.color).toBe(true);
  });
});
