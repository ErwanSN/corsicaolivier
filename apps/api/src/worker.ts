import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { OutboxWorkerModule } from './outbox-worker/outbox-worker.module';

async function bootstrap(): Promise<void> {
  const application = await NestFactory.createApplicationContext(
    OutboxWorkerModule,
    {
      logger:
        process.env.NODE_ENV === 'test' ? false : ['error', 'warn', 'log'],
    },
  );

  application.enableShutdownHooks(['SIGINT', 'SIGTERM']);
}

void bootstrap().catch(() => {
  Logger.error(
    'Le worker outbox n’a pas pu démarrer.',
    undefined,
    'OutboxWorkerBootstrap',
  );
  process.exitCode = 1;
});
