import { describe, expect, test } from "bun:test";
import { isHealthStatus } from "#/index";

describe("shared contracts", () => {
  test("validates health payloads at runtime", () => {
    expect(isHealthStatus({ status: "ok", service: "task-api" })).toBe(true);
    expect(isHealthStatus({ status: "failed", service: "task-api" })).toBe(false);
    expect(isHealthStatus(null)).toBe(false);
  });
});
