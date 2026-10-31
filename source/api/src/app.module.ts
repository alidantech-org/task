import { Module } from "@nestjs/common";
import { HealthController } from "#/health.controller";

export class AppModule {}

Module({ controllers: [HealthController] })(AppModule);
