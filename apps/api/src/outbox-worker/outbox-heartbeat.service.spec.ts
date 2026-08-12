import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { ConfigService } from '@nestjs/config';

import { OutboxHeartbeatService } from './outbox-heartbeat.service';

describe('OutboxHeartbeatService', () => {
  it('publie un statut borné incluant les départs en file d’échec', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'corsica-heartbeat-'));
    const path = join(directory, 'heartbeat.json');
    const service = new OutboxHeartbeatService({
      get: jest.fn().mockReturnValue(path),
    } as unknown as ConfigService);

    try {
      await service.markHealthy({
        offboardingDeadLetteredCount: 3.8,
        offboardingLastSuccessAt: 123_456,
        offboardingConsecutiveFailures: 2,
        offboardingLastErrorCode: 'P0001',
      });
      const payload = JSON.parse(await readFile(path, 'utf8')) as {
        timestamp: number;
        offboardingDeadLetteredCount: number;
        offboardingLastSuccessAt: number;
        offboardingConsecutiveFailures: number;
        offboardingLastErrorCode: string | null;
      };

      expect(payload.timestamp).toBeGreaterThan(0);
      expect(payload.offboardingDeadLetteredCount).toBe(3);
      expect(payload.offboardingLastSuccessAt).toBe(123_456);
      expect(payload.offboardingConsecutiveFailures).toBe(2);
      expect(payload.offboardingLastErrorCode).toBe('P0001');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
