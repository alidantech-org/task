import "reflect-metadata";
import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { AppModule } from "#/app.module";

function readPort(raw: string | undefined): number {
  const value = Number(raw ?? "3000");
  if (!Number.isInteger(value) || value < 1 || value > 65_535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }
  return value;
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    logger: new Logger("TaskApi"),
  });
  app.enableShutdownHooks();
  app.use(helmet());
  app.setGlobalPrefix("api/v1");
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(",").map((origin) => origin.trim()) ?? false,
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  app.use(
    (
      request: { headers: Record<string, string | string[] | undefined>; taskRequestId?: string },
      response: { setHeader: (name: string, value: string) => void },
      next: () => void,
    ) => {
      const header = request.headers["x-request-id"];
      const requestId =
        typeof header === "string" && /^[A-Za-z0-9._-]{1,100}$/.test(header)
          ? header
          : crypto.randomUUID();
      request.taskRequestId = requestId;
      response.setHeader("x-request-id", requestId);
      process.stdout.write(`${JSON.stringify({ level: "info", event: "request", requestId })}\n`);
      next();
    },
  );
  const openApi = new DocumentBuilder()
    .setTitle("Task API")
    .setDescription("Task Cloud API foundation")
    .setVersion("1")
    .build();
  SwaggerModule.setup("api/docs", app, SwaggerModule.createDocument(app, openApi));
  await app.listen(readPort(process.env.PORT), process.env.HOST ?? "0.0.0.0");
}

void bootstrap();
