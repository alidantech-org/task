import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";

export class HealthController {
  health(): { status: "ok"; service: "task-api" } {
    return { status: "ok", service: "task-api" };
  }

  readiness(): { status: "ok"; service: "task-api" } {
    if (process.env.READINESS_ENABLED === "false") {
      throw new ServiceUnavailableException({ status: "not_ready", service: "task-api" });
    }
    return { status: "ok", service: "task-api" };
  }
}

Controller("health")(HealthController);
Get("live")(
  HealthController.prototype,
  "health",
  Object.getOwnPropertyDescriptor(HealthController.prototype, "health") as PropertyDescriptor,
);
Get("ready")(
  HealthController.prototype,
  "readiness",
  Object.getOwnPropertyDescriptor(HealthController.prototype, "readiness") as PropertyDescriptor,
);
