import { type IncomingMessage } from "node:http";

import "./telemetry/instrumentation";

import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import helmet from "@fastify/helmet";
import { Logger, ValidationPipe, VersioningType } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";

import { AppModule } from "./app.module";
import { resolveCorsOrigins } from "./cors-origins";
import { shouldRejectCookieWrite } from "./csrf-protection";
import { ApiExceptionFilter } from "./errors/api-exception.filter";
import { recordHttpRequest } from "./metrics/metrics.registry";
import { resolveRequestId } from "./request-id";
import { shutdownTelemetry } from "./telemetry/instrumentation";
import { getActiveTraceContext } from "./telemetry/trace-context";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      genReqId: (request: IncomingMessage) => resolveRequestId(request.headers["x-request-id"]),
      logger: {
        level: process.env.LOG_LEVEL ?? "info",
        mixin: () => getActiveTraceContext() ?? {},
        redact: {
          censor: "[REDACTED]",
          paths: ["req.headers.authorization", "req.headers.cookie"]
        }
      },
      trustProxy: process.env.TRUST_PROXY === "true"
    })
  );

  const allowedOrigins = resolveCorsOrigins(process.env.NODE_ENV, process.env.CORS_ORIGIN);
  await app.register(cookie);
  app
    .getHttpAdapter()
    .getInstance()
    .addHook("onRequest", async (request, reply) => {
      reply.header("X-Request-Id", request.id);
      const traceContext = getActiveTraceContext();
      if (traceContext) reply.header("X-Trace-Id", traceContext.traceId);
      if (
        shouldRejectCookieWrite(
          {
            authorization: request.headers.authorization,
            method: request.method,
            origin: request.headers.origin,
            sessionCookie: request.cookies.corsica_session ?? request.cookies.corsica_refresh
          },
          allowedOrigins
        )
      ) {
        await reply.code(403).send({
          code: "CSRF_ORIGIN_REJECTED",
          message: "L’origine de cette requête n’est pas autorisée.",
          requestId: request.id
        });
      }
    })
    .addHook("onResponse", async (request, reply) => {
      recordHttpRequest(
        request.method,
        request.routeOptions.url ?? "unmatched",
        reply.statusCode,
        reply.elapsedTime
      );
    });
  await app.register(rateLimit, {
    allowList: (request) => {
      const path = request.url.split("?", 1)[0];
      return path === "/api/health" || path === "/api/metrics";
    },
    errorResponseBuilder: (request) => ({
      code: "RATE_LIMIT_EXCEEDED",
      message: "Trop de requêtes. Réessayez dans quelques instants.",
      requestId: request.id
    }),
    max: 120,
    timeWindow: "1 minute"
  });
  await app.register(helmet);
  await app.register(cors, {
    allowedHeaders: ["Authorization", "Content-Type", "Traceparent", "Tracestate", "X-Request-Id"],
    credentials: true,
    exposedHeaders: ["X-Request-Id", "X-Trace-Id"],
    maxAge: 600,
    methods: ["GET", "HEAD", "POST", "PATCH", "PUT", "OPTIONS"],
    origin: allowedOrigins
  });

  app.enableVersioning({ type: VersioningType.URI });
  app.setGlobalPrefix("api");
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true
    })
  );

  const port = Number.parseInt(process.env.API_PORT ?? "3001", 10);
  await app.listen({ host: "0.0.0.0", port });
  registerShutdownHandlers(app);

  Logger.log(`API listening on ${String(port)}`, "Bootstrap");
}

function registerShutdownHandlers(app: NestFastifyApplication): void {
  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    Logger.log(`Stopping API after ${signal}`, "Bootstrap");
    await app.close().finally(shutdownTelemetry);
  };
  const handle = (signal: NodeJS.Signals): void => {
    void shutdown(signal).catch((error: unknown) => {
      Logger.error(
        error instanceof Error ? error.message : "Telemetry shutdown failed",
        "Bootstrap"
      );
      process.exitCode = 1;
    });
  };
  process.once("SIGINT", () => {
    handle("SIGINT");
  });
  process.once("SIGTERM", () => {
    handle("SIGTERM");
  });
}

void bootstrap();
