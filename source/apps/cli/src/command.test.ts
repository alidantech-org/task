import { describe, expect, test } from "bun:test";
import { getCliMetadata, optionString, parseArgs } from "#/command";

describe("CLI command metadata", () => {
  test("supports task and tk aliases", () => {
    expect(getCliMetadata("0.1.0").aliases).toEqual(["task", "tk"]);
  });

  test("advertises the workspace command surface", () => {
    expect(getCliMetadata("0.1.0").commands).toContain("group");
    expect(getCliMetadata("0.1.0").commands).toContain("validate");
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
});
