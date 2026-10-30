import { describe, expect, test } from "bun:test";
import { getCliMetadata, resolveCommand } from "./command.js";

describe("CLI command metadata", () => {
  test("supports task and tk aliases", () => {
    expect(getCliMetadata("0.1.0").aliases).toEqual(["task", "tk"]);
  });

  test("resolves the first positional command", () => {
    expect(resolveCommand(["--json", "doctor"])).toBe("doctor");
    expect(resolveCommand(["--help"])).toBeUndefined();
  });
});
