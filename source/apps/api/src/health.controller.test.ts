import { describe, expect, test } from "bun:test";
import { HealthController } from "./health.controller.js";

describe("API health controller", () => {
  test("returns a stable service health contract", () => {
    expect(new HealthController().health()).toEqual({
      status: "ok",
      service: "task-api",
    });
  });
});
