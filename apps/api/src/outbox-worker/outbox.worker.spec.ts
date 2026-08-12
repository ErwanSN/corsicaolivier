import type { OutboxHeartbeatService } from './outbox-heartbeat.service';
import {
  AGENT_OFFBOARDING_RECONCILIATION_BATCH_SIZE,
  AGENT_OFFBOARDING_MAX_RECONCILIATION_BATCHES,
  AGENT_OFFBOARDING_RECONCILIATION_INTERVAL_MS,
  LOAD_FORECAST_RECONCILIATION_INTERVAL_MS,
  LOAD_FORECAST_RECONCILIATION_BATCH_SIZE,
  OUTBOX_BATCH_SIZE,
  OUTBOX_LEASE_SAFETY_MARGIN_MS,
  OUTBOX_LEASE_SECONDS,
  OUTBOX_MAINTENANCE_INTERVAL_MS,
  OUTBOX_POLL_INTERVAL_MS,
  OUTBOX_PRUNE_BATCH_SIZE,
  OUTBOX_RPC_TIMEOUT_MS,
  WORKFORCE_RECONCILIATION_BATCH_SIZE,
} from './outbox-worker.constants';
import type { OutboxSupabaseService } from './outbox-supabase.service';
import { OutboxWorker } from './outbox.worker';

const firstEvent = {
  id: '10000000-0000-4000-8000-000000000001',
  lease_token: '10000000-0000-4000-8000-000000000002',
  attempt_count: 1,
  max_attempts: 8,
};

const finalAttemptEvent = {
  id: '20000000-0000-4000-8000-000000000001',
  lease_token: '20000000-0000-4000-8000-000000000002',
  attempt_count: 8,
  max_attempts: 8,
};

describe('OutboxWorker', () => {
  it('borne le lot dans un bail couvrant les deux RPC possibles', () => {
    expect(OUTBOX_BATCH_SIZE).toBeLessThanOrEqual(10);
    expect(OUTBOX_LEASE_SECONDS * 1_000).toBeGreaterThanOrEqual(
      OUTBOX_RPC_TIMEOUT_MS * 2 + OUTBOX_LEASE_SAFETY_MARGIN_MS,
    );
  });

  it('traite un lot, bat le cœur et remet les erreurs en file bornée', async () => {
    let materializationCalls = 0;
    const rpc = jest.fn(
      (
        name: string,
      ): Promise<{
        data: unknown;
        error: Readonly<{ code: string }> | null;
      }> => {
        if (name === 'claim_outbox_events') {
          return Promise.resolve({
            data: [firstEvent, finalAttemptEvent],
            error: null,
          });
        }

        if (name === 'materialize_outbox_event') {
          materializationCalls += 1;

          return Promise.resolve(
            materializationCalls === 1
              ? { data: { processed: true }, error: null }
              : { data: null, error: { code: 'P0001' } },
          );
        }

        if (name === 'fail_outbox_event') {
          return Promise.resolve({
            data: { failed: true, deadLettered: true },
            error: null,
          });
        }

        return Promise.reject(new Error(`RPC inattendu : ${name}`));
      },
    );
    const markHealthy = jest.fn().mockResolvedValue(undefined);
    const worker = new OutboxWorker(
      {
        client: jest.fn().mockReturnValue({ rpc }),
      } as unknown as OutboxSupabaseService,
      { markHealthy } as unknown as OutboxHeartbeatService,
    );

    await expect(worker.runOnce()).resolves.toEqual({
      claimed: 2,
      processed: 1,
      failed: 1,
      deadLettered: 1,
    });
    expect(markHealthy).toHaveBeenCalledTimes(2);
    expect(markHealthy).toHaveBeenLastCalledWith(
      expect.objectContaining({ offboardingDeadLetteredCount: 0 }),
    );
    expect(rpc).toHaveBeenCalledWith(
      'fail_outbox_event',
      expect.objectContaining({
        target_event_id: finalAttemptEvent.id,
        target_lease_token: finalAttemptEvent.lease_token,
        failure_reason: 'Échec de matérialisation (P0001)',
      }),
    );
  });

  it('ne bat pas le cœur quand la base refuse la réclamation', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: null,
      error: { code: '503' },
    });
    const markHealthy = jest.fn();
    const worker = new OutboxWorker(
      {
        client: jest.fn().mockReturnValue({ rpc }),
      } as unknown as OutboxSupabaseService,
      { markHealthy } as unknown as OutboxHeartbeatService,
    );

    await expect(worker.runOnce()).resolves.toEqual({
      claimed: 0,
      processed: 0,
      failed: 0,
      deadLettered: 0,
    });
    expect(markHealthy).not.toHaveBeenCalled();
  });

  it('finalise les départs dus même si la réclamation outbox échoue', async () => {
    const baseTime = Date.parse('2026-08-11T12:00:00.000Z');
    const dateNow = jest.spyOn(Date, 'now').mockReturnValue(baseTime);
    const rpc = jest.fn((name: string) => {
      if (name === 'claim_outbox_events') {
        return Promise.resolve({ data: null, error: { code: '503' } });
      }
      if (name === 'finalize_due_agent_offboardings') {
        return Promise.resolve({
          data: {
            completedCount: 1,
            failedCount: 0,
            deadLetteredCount: 0,
            remainingCount: 0,
          },
          error: null,
        });
      }
      if (name === 'reconcile_expired_call_load_forecast_overrides') {
        return Promise.resolve({
          data: { reconciledCount: 0, remainingCount: 0 },
          error: null,
        });
      }
      return Promise.reject(new Error(`RPC inattendu : ${name}`));
    });
    const markHealthy = jest.fn();
    const worker = new OutboxWorker(
      { client: () => ({ rpc }) } as unknown as OutboxSupabaseService,
      { markHealthy } as unknown as OutboxHeartbeatService,
    );

    dateNow.mockReturnValue(
      baseTime + AGENT_OFFBOARDING_RECONCILIATION_INTERVAL_MS + 1,
    );
    await worker.runOnce();
    dateNow.mockRestore();

    expect(rpc).toHaveBeenCalledWith(
      'finalize_due_agent_offboardings',
      expect.objectContaining({
        reconciliation_batch_size: AGENT_OFFBOARDING_RECONCILIATION_BATCH_SIZE,
      }),
    );
    expect(markHealthy).not.toHaveBeenCalled();
  });

  it('publie un premier heartbeat avant d’attendre le traitement du lot', async () => {
    let resolveMaterialization:
      | ((value: { data: { processed: boolean }; error: null }) => void)
      | undefined;
    const materialization = new Promise<{
      data: { processed: boolean };
      error: null;
    }>((resolve) => {
      resolveMaterialization = resolve;
    });
    const rpc = jest.fn((name: string) => {
      if (name === 'claim_outbox_events') {
        return Promise.resolve({ data: [firstEvent], error: null });
      }

      return materialization;
    });
    const markHealthy = jest.fn().mockResolvedValue(undefined);
    const worker = new OutboxWorker(
      {
        client: jest.fn().mockReturnValue({ rpc }),
      } as unknown as OutboxSupabaseService,
      { markHealthy } as unknown as OutboxHeartbeatService,
    );

    const run = worker.runOnce();
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(markHealthy).toHaveBeenCalledTimes(1);
    resolveMaterialization?.({ data: { processed: true }, error: null });
    await run;
    expect(markHealthy).toHaveBeenCalledTimes(2);
  });

  it('attend le cycle en cours lors de l’arrêt applicatif', async () => {
    const markHealthy = jest.fn().mockResolvedValue(undefined);
    const rpc = jest.fn().mockResolvedValue({ data: [], error: null });
    const worker = new OutboxWorker(
      {
        client: jest.fn().mockReturnValue({ rpc }),
      } as unknown as OutboxSupabaseService,
      { markHealthy } as unknown as OutboxHeartbeatService,
    );

    worker.onApplicationBootstrap();
    await worker.onApplicationShutdown();

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(markHealthy).toHaveBeenCalledTimes(2);
  });

  it('n’exécute jamais deux cycles en parallèle et ne redémarre pas après l’arrêt', async () => {
    jest.useFakeTimers();
    let resolveClaim: ((value: { data: []; error: null }) => void) | undefined;
    const claim = new Promise<{ data: []; error: null }>((resolve) => {
      resolveClaim = resolve;
    });
    const rpc = jest.fn().mockReturnValue(claim);
    const markHealthy = jest.fn().mockResolvedValue(undefined);
    const worker = new OutboxWorker(
      { client: () => ({ rpc }) } as unknown as OutboxSupabaseService,
      { markHealthy } as unknown as OutboxHeartbeatService,
    );

    try {
      worker.onApplicationBootstrap();
      jest.advanceTimersByTime(OUTBOX_POLL_INTERVAL_MS * 3);

      expect(rpc).toHaveBeenCalledTimes(1);

      const shutdown = worker.onApplicationShutdown();
      jest.advanceTimersByTime(OUTBOX_POLL_INTERVAL_MS * 3);
      expect(rpc).toHaveBeenCalledTimes(1);

      resolveClaim?.({ data: [], error: null });
      await shutdown;

      await expect(worker.runOnce()).resolves.toEqual({
        claimed: 0,
        processed: 0,
        failed: 0,
        deadLettered: 0,
      });
      expect(rpc).toHaveBeenCalledTimes(1);
    } finally {
      resolveClaim?.({ data: [], error: null });
      await worker.onApplicationShutdown();
      jest.useRealTimers();
    }
  });

  it('termine les événements réclamés puis ignore toute maintenance après SIGTERM', async () => {
    const baseTime = Date.parse('2026-08-11T12:00:00.000Z');
    const dateNow = jest.spyOn(Date, 'now').mockReturnValue(baseTime);
    let resolveMaterialization:
      ((value: { data: { processed: true }; error: null }) => void) | undefined;
    const materialization = new Promise<{
      data: { processed: true };
      error: null;
    }>((resolve) => {
      resolveMaterialization = resolve;
    });
    const rpc = jest.fn((name: string) => {
      if (name === 'claim_outbox_events') {
        return Promise.resolve({ data: [firstEvent], error: null });
      }
      if (name === 'materialize_outbox_event') return materialization;

      return Promise.reject(new Error(`RPC inattendu : ${name}`));
    });
    const markHealthy = jest.fn().mockResolvedValue(undefined);
    const worker = new OutboxWorker(
      { client: () => ({ rpc }) } as unknown as OutboxSupabaseService,
      { markHealthy } as unknown as OutboxHeartbeatService,
    );
    dateNow.mockReturnValue(baseTime + OUTBOX_MAINTENANCE_INTERVAL_MS + 1);

    try {
      worker.onApplicationBootstrap();
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(rpc).toHaveBeenCalledWith(
        'materialize_outbox_event',
        expect.objectContaining({ target_event_id: firstEvent.id }),
      );

      const shutdown = worker.onApplicationShutdown();
      resolveMaterialization?.({ data: { processed: true }, error: null });
      await shutdown;

      expect(rpc.mock.calls.map(([name]) => name)).toEqual([
        'claim_outbox_events',
        'materialize_outbox_event',
      ]);
      expect(markHealthy).toHaveBeenCalledTimes(2);
    } finally {
      resolveMaterialization?.({ data: { processed: true }, error: null });
      await worker.onApplicationShutdown();
      dateNow.mockRestore();
    }
  });

  it('termine uniquement le RPC de maintenance en cours lors de l’arrêt', async () => {
    const baseTime = Date.parse('2026-08-11T12:00:00.000Z');
    const dateNow = jest.spyOn(Date, 'now').mockReturnValue(baseTime);
    let resolveReconciliation:
      | ((value: {
          data: { reconciledCount: number; remainingCount: number };
          error: null;
        }) => void)
      | undefined;
    const reconciliation = new Promise<{
      data: { reconciledCount: number; remainingCount: number };
      error: null;
    }>((resolve) => {
      resolveReconciliation = resolve;
    });
    const rpc = jest.fn((name: string) => {
      if (name === 'claim_outbox_events') {
        return Promise.resolve({ data: [], error: null });
      }
      if (name === 'reconcile_expired_call_load_forecast_overrides') {
        return reconciliation;
      }

      return Promise.reject(new Error(`RPC inattendu : ${name}`));
    });
    const markHealthy = jest.fn().mockResolvedValue(undefined);
    const worker = new OutboxWorker(
      { client: () => ({ rpc }) } as unknown as OutboxSupabaseService,
      { markHealthy } as unknown as OutboxHeartbeatService,
    );
    dateNow.mockReturnValue(baseTime + OUTBOX_MAINTENANCE_INTERVAL_MS + 1);

    try {
      worker.onApplicationBootstrap();
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(rpc).toHaveBeenCalledWith(
        'reconcile_expired_call_load_forecast_overrides',
        expect.any(Object),
      );

      const shutdown = worker.onApplicationShutdown();
      resolveReconciliation?.({
        data: { reconciledCount: 100, remainingCount: 100 },
        error: null,
      });
      await shutdown;

      expect(
        rpc.mock.calls.filter(
          ([name]) => name === 'reconcile_expired_call_load_forecast_overrides',
        ),
      ).toHaveLength(1);
      expect(rpc).not.toHaveBeenCalledWith(
        'finalize_due_agent_offboardings',
        expect.anything(),
      );
      expect(rpc).not.toHaveBeenCalledWith(
        'reconcile_expired_workforce_conflicts',
        expect.anything(),
      );
      expect(rpc).not.toHaveBeenCalledWith(
        'prune_processed_outbox_events',
        expect.anything(),
      );
    } finally {
      resolveReconciliation?.({
        data: { reconciledCount: 100, remainingCount: 0 },
        error: null,
      });
      await worker.onApplicationShutdown();
      dateNow.mockRestore();
    }
  });

  it('rafraîchit le heartbeat entre les lots longs après une réclamation réussie', async () => {
    const baseTime = Date.parse('2026-08-11T12:00:00.000Z');
    const dateNow = jest.spyOn(Date, 'now').mockReturnValue(baseTime);
    const markHealthy = jest.fn().mockResolvedValue(undefined);
    let forecastBatch = 0;
    const rpc = jest.fn((name: string) => {
      if (name === 'claim_outbox_events') {
        return Promise.resolve({ data: [], error: null });
      }
      if (name === 'reconcile_expired_call_load_forecast_overrides') {
        forecastBatch += 1;
        if (forecastBatch === 2) {
          expect(markHealthy).toHaveBeenCalledTimes(2);
        }
        return Promise.resolve({
          data: {
            reconciledCount: 100,
            remainingCount: forecastBatch === 1 ? 100 : 0,
          },
          error: null,
        });
      }
      if (name === 'finalize_due_agent_offboardings') {
        return Promise.resolve({
          data: {
            completedCount: 0,
            failedCount: 0,
            deadLetteredCount: 0,
            remainingCount: 0,
          },
          error: null,
        });
      }

      return Promise.reject(new Error(`RPC inattendu : ${name}`));
    });
    const worker = new OutboxWorker(
      { client: () => ({ rpc }) } as unknown as OutboxSupabaseService,
      { markHealthy } as unknown as OutboxHeartbeatService,
    );
    dateNow.mockReturnValue(
      baseTime + LOAD_FORECAST_RECONCILIATION_INTERVAL_MS + 1,
    );

    await worker.runOnce();
    dateNow.mockRestore();

    expect(forecastBatch).toBe(2);
    expect(markHealthy).toHaveBeenCalledTimes(5);
  });

  it('épuise plusieurs lots bornés de réconciliation et de rétention', async () => {
    const currentTime = Date.parse('2026-08-11T12:00:00.000Z');
    const dateNow = jest
      .spyOn(Date, 'now')
      .mockReturnValue(currentTime - OUTBOX_MAINTENANCE_INTERVAL_MS - 1);
    const reconciliationResults = [
      {
        data: {
          reconciledAgentCount: WORKFORCE_RECONCILIATION_BATCH_SIZE,
          remainingAgentCount: 12,
        },
        error: null,
      },
      {
        data: { reconciledAgentCount: 12, remainingAgentCount: 0 },
        error: null,
      },
    ];
    const pruneResults = [
      {
        data: { deletedCount: OUTBOX_PRUNE_BATCH_SIZE },
        error: null,
      },
      { data: { deletedCount: 17 }, error: null },
    ];
    const rpc = jest.fn((name: string) => {
      if (name === 'claim_outbox_events') {
        return Promise.resolve({ data: [], error: null });
      }
      if (name === 'reconcile_expired_workforce_conflicts') {
        return Promise.resolve(reconciliationResults.shift());
      }
      if (name === 'finalize_due_agent_offboardings') {
        return Promise.resolve({
          data: {
            completedCount: 1,
            failedCount: 0,
            deadLetteredCount: 0,
            remainingCount: 0,
          },
          error: null,
        });
      }
      if (name === 'reconcile_expired_call_load_forecast_overrides') {
        return Promise.resolve({
          data: { reconciledCount: 1, remainingCount: 0 },
          error: null,
        });
      }
      if (name === 'prune_processed_outbox_events') {
        return Promise.resolve(pruneResults.shift());
      }

      return Promise.reject(new Error(`RPC inattendu : ${name}`));
    });
    const markHealthy = jest.fn().mockResolvedValue(undefined);
    const worker = new OutboxWorker(
      {
        client: jest.fn().mockReturnValue({ rpc }),
      } as unknown as OutboxSupabaseService,
      { markHealthy } as unknown as OutboxHeartbeatService,
    );
    dateNow.mockReturnValue(currentTime);

    await worker.runOnce();
    dateNow.mockRestore();

    expect(
      rpc.mock.calls.filter(
        ([name]) => name === 'finalize_due_agent_offboardings',
      ),
    ).toEqual([
      [
        'finalize_due_agent_offboardings',
        {
          reconciliation_batch_size:
            AGENT_OFFBOARDING_RECONCILIATION_BATCH_SIZE,
        },
      ],
    ]);
    expect(
      rpc.mock.calls.filter(
        ([name]) => name === 'reconcile_expired_call_load_forecast_overrides',
      ),
    ).toEqual([
      [
        'reconcile_expired_call_load_forecast_overrides',
        {
          reconcile_batch_size: LOAD_FORECAST_RECONCILIATION_BATCH_SIZE,
        },
      ],
    ]);
    expect(
      rpc.mock.calls.filter(
        ([name]) => name === 'reconcile_expired_workforce_conflicts',
      ),
    ).toHaveLength(2);
    expect(
      rpc.mock.calls.filter(
        ([name]) => name === 'prune_processed_outbox_events',
      ),
    ).toHaveLength(2);
  });

  it('réconcilie les départs toutes les 60 secondes, même sans événement outbox', async () => {
    const baseTime = Date.parse('2026-08-11T12:00:00.000Z');
    const dateNow = jest.spyOn(Date, 'now').mockReturnValue(baseTime);
    const rpc = jest.fn((name: string) => {
      if (name === 'claim_outbox_events') {
        return Promise.resolve({ data: [], error: null });
      }
      if (name === 'finalize_due_agent_offboardings') {
        return Promise.resolve({
          data: {
            completedCount: 0,
            failedCount: 0,
            deadLetteredCount: 0,
            remainingCount: 0,
          },
          error: null,
        });
      }
      if (name === 'reconcile_expired_call_load_forecast_overrides') {
        return Promise.resolve({
          data: { reconciledCount: 0, remainingCount: 0 },
          error: null,
        });
      }
      return Promise.reject(new Error(`RPC inattendu : ${name}`));
    });
    const markHealthy = jest.fn().mockResolvedValue(undefined);
    const worker = new OutboxWorker(
      { client: () => ({ rpc }) } as unknown as OutboxSupabaseService,
      { markHealthy } as unknown as OutboxHeartbeatService,
    );

    dateNow.mockReturnValue(
      baseTime + AGENT_OFFBOARDING_RECONCILIATION_INTERVAL_MS,
    );
    await worker.runOnce();
    dateNow.mockReturnValue(
      baseTime + AGENT_OFFBOARDING_RECONCILIATION_INTERVAL_MS + 30_000,
    );
    await worker.runOnce();
    dateNow.mockReturnValue(
      baseTime + AGENT_OFFBOARDING_RECONCILIATION_INTERVAL_MS * 2 + 1,
    );
    await worker.runOnce();
    dateNow.mockRestore();

    expect(
      rpc.mock.calls.filter(
        ([name]) => name === 'finalize_due_agent_offboardings',
      ),
    ).toHaveLength(2);
  });

  it('plafonne les lots empoisonnés et publie le backlog dead-letter', async () => {
    const baseTime = Date.parse('2026-08-11T12:00:00.000Z');
    const dateNow = jest.spyOn(Date, 'now').mockReturnValue(baseTime);
    const rpc = jest.fn((name: string) => {
      if (name === 'claim_outbox_events') {
        return Promise.resolve({ data: [], error: null });
      }
      if (name === 'finalize_due_agent_offboardings') {
        return Promise.resolve({
          data: {
            completedCount: 0,
            failedCount: 1,
            deadLetteredCount: 2,
            remainingCount: 99,
          },
          error: null,
        });
      }
      if (name === 'reconcile_expired_call_load_forecast_overrides') {
        return Promise.resolve({
          data: { reconciledCount: 0, remainingCount: 0 },
          error: null,
        });
      }
      return Promise.reject(new Error(`RPC inattendu : ${name}`));
    });
    const markHealthy = jest.fn().mockResolvedValue(undefined);
    const worker = new OutboxWorker(
      { client: () => ({ rpc }) } as unknown as OutboxSupabaseService,
      { markHealthy } as unknown as OutboxHeartbeatService,
    );

    dateNow.mockReturnValue(
      baseTime + AGENT_OFFBOARDING_RECONCILIATION_INTERVAL_MS + 1,
    );
    await worker.runOnce();
    dateNow.mockRestore();

    expect(
      rpc.mock.calls.filter(
        ([name]) => name === 'finalize_due_agent_offboardings',
      ),
    ).toHaveLength(AGENT_OFFBOARDING_MAX_RECONCILIATION_BATCHES);
    expect(markHealthy).toHaveBeenLastCalledWith(
      expect.objectContaining({ offboardingDeadLetteredCount: 2 }),
    );
  });

  it('dégrade le heartbeat après trois erreurs de finalisation puis récupère', async () => {
    const baseTime = Date.parse('2026-08-11T12:00:00.000Z');
    const dateNow = jest.spyOn(Date, 'now').mockReturnValue(baseTime);
    let offboardingCall = 0;
    const rpc = jest.fn((name: string) => {
      if (name === 'claim_outbox_events') {
        return Promise.resolve({ data: [], error: null });
      }
      if (name === 'finalize_due_agent_offboardings') {
        offboardingCall += 1;
        if (offboardingCall <= 3) {
          return Promise.resolve({ data: null, error: { code: 'P0001' } });
        }
        return Promise.resolve({
          data: {
            completedCount: 0,
            failedCount: 0,
            deadLetteredCount: 0,
            remainingCount: 0,
          },
          error: null,
        });
      }
      if (name === 'reconcile_expired_call_load_forecast_overrides') {
        return Promise.resolve({
          data: { reconciledCount: 0, remainingCount: 0 },
          error: null,
        });
      }
      return Promise.reject(new Error(`RPC inattendu : ${name}`));
    });
    const markHealthy = jest.fn().mockResolvedValue(undefined);
    const worker = new OutboxWorker(
      { client: () => ({ rpc }) } as unknown as OutboxSupabaseService,
      { markHealthy } as unknown as OutboxHeartbeatService,
    );

    for (let cycle = 1; cycle <= 3; cycle += 1) {
      dateNow.mockReturnValue(
        baseTime + cycle * (AGENT_OFFBOARDING_RECONCILIATION_INTERVAL_MS + 1),
      );
      await worker.runOnce();
    }
    expect(markHealthy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        offboardingConsecutiveFailures: 3,
        offboardingLastErrorCode: 'P0001',
      }),
    );

    const recoveryTime =
      baseTime + 4 * (AGENT_OFFBOARDING_RECONCILIATION_INTERVAL_MS + 1);
    dateNow.mockReturnValue(recoveryTime);
    await worker.runOnce();
    dateNow.mockRestore();

    expect(markHealthy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        offboardingConsecutiveFailures: 0,
        offboardingLastErrorCode: null,
        offboardingLastSuccessAt: recoveryTime,
      }),
    );
  });
});
