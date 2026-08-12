import { Reflector } from '@nestjs/core';
import type { ThrottlerStorage } from '@nestjs/throttler';

import { IdentityThrottlerGuard } from './identity-throttler.guard';
import { PreAuthThrottlerGuard } from './pre-auth-throttler.guard';

class TestPreAuthGuard extends PreAuthThrottlerGuard {
  tracker(request: Record<string, unknown>): Promise<string> {
    return this.getTracker(request);
  }

  key(context: never, tracker: string): string {
    return this.generateKey(context, tracker, 'preauth');
  }
}

class TestIdentityGuard extends IdentityThrottlerGuard {
  tracker(request: Record<string, unknown>): Promise<string> {
    return this.getTracker(request);
  }
}

const storage = {} as ThrottlerStorage;
const options = [
  { limit: 1_800, name: 'preauth', ttl: 60_000 },
  { limit: 120, name: 'default', ttl: 60_000 },
];

describe('limitation de débit par identité', () => {
  it('agrège les bearers non validés sur le plafond réseau pré-auth', async () => {
    const guard = new TestPreAuthGuard(options, storage, new Reflector());
    const first = await guard.tracker({
      headers: { authorization: 'Bearer random-a' },
      ip: '192.0.2.10',
    });
    const second = await guard.tracker({
      headers: { authorization: 'Bearer random-b' },
      ip: '192.0.2.10',
    });

    expect(first).toBe('192.0.2.10');
    expect(second).toBe(first);
    expect(guard.key({ route: '/api/agents' } as never, first)).toBe(
      guard.key({ route: '/api/planning' } as never, second),
    );
  });

  it('isole le quota d’une identité validée du réseau SSR partagé', async () => {
    const guard = new TestIdentityGuard(options, storage, new Reflector());
    const first = await guard.tracker({
      auth: {
        accessToken: 'not-logged',
        assuranceLevel: 'aal1',
        userId: '00000000-0000-4000-8000-000000000010',
      },
      ip: '172.18.0.5',
    });
    const second = await guard.tracker({
      auth: {
        accessToken: 'not-logged-either',
        assuranceLevel: 'aal1',
        userId: '00000000-0000-4000-8000-000000000011',
      },
      ip: '172.18.0.5',
    });

    expect(first).toBe('user:00000000-0000-4000-8000-000000000010');
    expect(second).toBe('user:00000000-0000-4000-8000-000000000011');
  });

  it('retombe sur le réseau lorsqu’aucune identité validée n’existe', async () => {
    const guard = new TestIdentityGuard(options, storage, new Reflector());

    await expect(
      guard.tracker({
        headers: { authorization: 'Bearer forged' },
        ip: '192.0.2.20',
      }),
    ).resolves.toBe('192.0.2.20');
  });
});
