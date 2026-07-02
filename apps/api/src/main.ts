import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import { Logger, ValidationPipe, VersioningType } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";

import { AppModule } from "./app.module";

const defaultDevelopmentCorsOrigins = true;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());

  await app.register(helmet);
  await app.register(cors, {
    credentials: true,
    origin:
      process.env.NODE_ENV === "production"
        ? (process.env.CORS_ORIGIN?.split(",") ?? false)
        : defaultDevelopmentCorsOrigins
  });

  app.enableShutdownHooks();
  app.enableVersioning({ type: VersioningType.URI });
  app.setGlobalPrefix("api");
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true
    })
  );

  const port = Number.parseInt(process.env.API_PORT ?? "3001", 10);
  await app.listen({ host: "0.0.0.0", port });

  Logger.log(`API listening on ${String(port)}`, "Bootstrap");
}

void bootstrap();
