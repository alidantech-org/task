import { describe, expect, test } from "bun:test";
import { HealthController } from "#/health.controller";

describe("API health controller", () => {
  test("returns the service health contract", () => {
    expect(new HealthController().health()).toEqual({ status: "ok", service: "task-api" });
  });
});
