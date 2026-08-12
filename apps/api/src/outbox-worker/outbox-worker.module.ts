import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { OutboxHeartbeatService } from './outbox-heartbeat.service';
import { validateOutboxWorkerEnvironment } from './outbox-worker.config';
import { OutboxWorker } from './outbox.worker';
import { OutboxSupabaseService } from './outbox-supabase.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      expandVariables: false,
      isGlobal: true,
      envFilePath: '.env.worker',
      validate: validateOutboxWorkerEnvironment,
    }),
  ],
  providers: [OutboxSupabaseService, OutboxHeartbeatService, OutboxWorker],
})
export class OutboxWorkerModule {}
