import compress from '@fastify/compress';
import helmet from '@fastify/helmet';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';

import { AppModule } from './app.module';
import type { Environment } from './config/environment';
import { createHttpLoggerOptions } from './config/http-logger';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: createHttpLoggerOptions(process.env.NODE_ENV ?? 'development'),
      // The API is reachable only from the private web service. Never derive
      // throttling identities from caller-controlled forwarding headers.
      trustProxy: false,
    }),
  );
  const configService =
    app.get<ConfigService<Environment, true>>(ConfigService);
  const corsOrigins = configService.get<string[]>('corsOrigins');
  const port = configService.get<number>('port');

  await app.register(helmet);
  await app.register(compress, {
    encodings: ['br', 'gzip', 'deflate'],
    global: true,
  });

  app
    .getHttpAdapter()
    .getInstance()
    .addHook('onRequest', (request, reply, done) => {
      void reply.header('x-request-id', request.id);
      done();
    });

  app.enableCors({
    credentials: true,
    origin: corsOrigins,
  });
  app.enableShutdownHooks();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    }),
  );

  await app.listen(port, '0.0.0.0');
}

void bootstrap();
