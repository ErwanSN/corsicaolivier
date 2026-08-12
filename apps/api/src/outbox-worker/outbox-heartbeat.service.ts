import { writeFile } from 'node:fs/promises';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const DEFAULT_OUTBOX_HEALTH_FILE =
  '/tmp/corsica-outbox-worker.heartbeat';

export type OutboxHeartbeatStatus = Readonly<{
  offboardingDeadLetteredCount: number;
  offboardingLastSuccessAt: number;
  offboardingConsecutiveFailures: number;
  offboardingLastErrorCode: string | null;
}>;

@Injectable()
export class OutboxHeartbeatService {
  private readonly path: string;

  constructor(config: ConfigService) {
    this.path =
      config.get<string>('OUTBOX_HEALTH_FILE')?.trim() ||
      DEFAULT_OUTBOX_HEALTH_FILE;
  }

  async markHealthy(
    status: OutboxHeartbeatStatus = {
      offboardingDeadLetteredCount: 0,
      offboardingLastSuccessAt: Date.now(),
      offboardingConsecutiveFailures: 0,
      offboardingLastErrorCode: null,
    },
  ): Promise<void> {
    await writeFile(
      this.path,
      JSON.stringify({
        timestamp: Date.now(),
        offboardingDeadLetteredCount: Math.max(
          0,
          Math.trunc(status.offboardingDeadLetteredCount),
        ),
        offboardingLastSuccessAt: status.offboardingLastSuccessAt,
        offboardingConsecutiveFailures: Math.max(
          0,
          Math.trunc(status.offboardingConsecutiveFailures),
        ),
        offboardingLastErrorCode: status.offboardingLastErrorCode,
      }),
      {
        encoding: 'utf8',
        mode: 0o600,
      },
    );
  }
}
