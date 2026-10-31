import { describe, expect, test } from "bun:test";
import { getCliMetadata, optionString, parseArgs } from "#/command";

describe("CLI command metadata", () => {
  test("supports task and tk aliases", () => {
    expect(getCliMetadata("0.1.0").aliases).toEqual(["task", "tk"]);
    expect(getCliMetadata("0.1.0").commands).toContain("init");
  });

  test("advertises the workspace command surface", () => {
    expect(getCliMetadata("0.1.0").commands).toContain("group");
    expect(getCliMetadata("0.1.0").commands).toContain("validate");
    expect(getCliMetadata("0.1.0").commands).toContain("run");
  });

  test("parses options, comma-separated values, and short help", () => {
    const parsed = parseArgs([
      "--json",
      "--workspace",
      "/tmp/tasks",
      "create",
      "--tag",
      "a,b",
      "-h",
    ]);
    expect(parsed.command).toBe("create");
    expect(parsed.options.get("json")).toBe(true);
    expect(optionString(parsed, "workspace")).toBe("/tmp/tasks");
    expect(parsed.options.get("tag")).toBe("a,b");
    expect(parsed.options.get("help")).toBe(true);
  });

  test("rejects the unsupported watch option", () => {
    expect(() => parseArgs(["--watch"])).toThrow("Unknown option: --watch");
  });

  test("keeps output controls explicit", () => {
    const parsed = parseArgs(["--plain", "--quiet", "--verbose", "list"]);
    expect(parsed.options.has("plain")).toBe(true);
    expect(parsed.options.has("quiet")).toBe(true);
    expect(parsed.options.has("verbose")).toBe(true);
  });

  test("supports the full-screen shortcut and long option", () => {
    expect(parseArgs(["-f"]).options.get("full-screen")).toBe(true);
    expect(parseArgs(["--full-screen"]).options.get("full-screen")).toBe(true);
    expect(getCliMetadata("0.1.0").commands).toContain("tui");
  });

  test("supports an unattended local dashboard launch", () => {
    const parsed = parseArgs(["run", "--no-open"]);
    expect(parsed.command).toBe("run");
    expect(parsed.options.get("no-open")).toBe(true);
  });
});
