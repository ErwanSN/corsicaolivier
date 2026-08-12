import { readFile } from 'node:fs/promises';

import { DEFAULT_OUTBOX_HEALTH_FILE } from './outbox-worker/outbox-heartbeat.service';
import { OUTBOX_HEALTH_MAX_AGE_MS } from './outbox-worker/outbox-worker.constants';

async function checkHealth(): Promise<void> {
  const path =
    process.env.OUTBOX_HEALTH_FILE?.trim() || DEFAULT_OUTBOX_HEALTH_FILE;
  const configuredMaxAge = Number(
    process.env.OUTBOX_HEALTH_MAX_AGE_MS ?? OUTBOX_HEALTH_MAX_AGE_MS,
  );
  const maxAge =
    Number.isFinite(configuredMaxAge) && configuredMaxAge >= 10_000
      ? configuredMaxAge
      : OUTBOX_HEALTH_MAX_AGE_MS;
  const rawHeartbeat = await readFile(path, 'utf8');
  let heartbeat: number;
  let offboardingDeadLetteredCount = 0;
  let offboardingLastSuccessAt = 0;
  let offboardingConsecutiveFailures = 0;

  try {
    const status = JSON.parse(rawHeartbeat) as Record<string, unknown>;
    heartbeat = Number(status.timestamp);
    offboardingDeadLetteredCount = Number(
      status.offboardingDeadLetteredCount ?? 0,
    );
    offboardingLastSuccessAt = Number(
      status.offboardingLastSuccessAt ?? heartbeat,
    );
    offboardingConsecutiveFailures = Number(
      status.offboardingConsecutiveFailures ?? 0,
    );
  } catch {
    // Accept the previous timestamp-only heartbeat during rolling deploys.
    heartbeat = Number(rawHeartbeat);
    offboardingLastSuccessAt = heartbeat;
  }

  if (
    !Number.isFinite(heartbeat) ||
    heartbeat > Date.now() + 5_000 ||
    Date.now() - heartbeat > maxAge
  ) {
    throw new Error('heartbeat stale');
  }

  if (
    !Number.isFinite(offboardingDeadLetteredCount) ||
    offboardingDeadLetteredCount > 0
  ) {
    throw new Error('offboarding dead letters pending');
  }

  if (
    !Number.isFinite(offboardingLastSuccessAt) ||
    !Number.isFinite(offboardingConsecutiveFailures) ||
    offboardingConsecutiveFailures >= 3 ||
    Date.now() - offboardingLastSuccessAt > 3 * 60_000
  ) {
    throw new Error('offboarding reconciliation degraded');
  }
}

void checkHealth().catch(() => {
  process.exitCode = 1;
});
