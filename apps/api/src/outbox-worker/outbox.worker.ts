import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';

import type { Json } from '../database/database.types';
import { OutboxHeartbeatService } from './outbox-heartbeat.service';
import {
  AGENT_OFFBOARDING_MAX_RECONCILIATION_BATCHES,
  AGENT_OFFBOARDING_RECONCILIATION_BATCH_SIZE,
  AGENT_OFFBOARDING_RECONCILIATION_INTERVAL_MS,
  OUTBOX_BATCH_SIZE,
  OUTBOX_LEASE_SECONDS,
  OUTBOX_MAX_PRUNE_BATCHES,
  OUTBOX_MAINTENANCE_INTERVAL_MS,
  OUTBOX_POLL_INTERVAL_MS,
  OUTBOX_PRUNE_BATCH_SIZE,
  OUTBOX_RETENTION_DAYS,
  LOAD_FORECAST_MAX_RECONCILIATION_BATCHES,
  LOAD_FORECAST_RECONCILIATION_BATCH_SIZE,
  LOAD_FORECAST_RECONCILIATION_INTERVAL_MS,
  WORKFORCE_MAX_RECONCILIATION_BATCHES,
  WORKFORCE_RECONCILIATION_BATCH_SIZE,
} from './outbox-worker.constants';
import { OutboxSupabaseService } from './outbox-supabase.service';

type ClaimedEvent = Readonly<{
  id: string;
  lease_token: string;
  attempt_count: number;
  max_attempts: number;
}>;

type EventRunResult = Readonly<{
  processed: number;
  failed: number;
  deadLettered: number;
}>;

type OffboardingReconciliationResult = Readonly<{
  completedCount: number;
  failedCount: number;
  deadLetteredCount: number;
  remainingCount: number;
}>;

export type OutboxRunResult = Readonly<{
  claimed: number;
  processed: number;
  failed: number;
  deadLettered: number;
}>;

const EMPTY_RUN_RESULT: OutboxRunResult = {
  claimed: 0,
  processed: 0,
  failed: 0,
  deadLettered: 0,
};

@Injectable()
export class OutboxWorker
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(OutboxWorker.name);
  private readonly workerId = crypto.randomUUID();
  private interval: ReturnType<typeof setInterval> | undefined;
  private inFlight: Promise<OutboxRunResult> | null = null;
  private stopping = false;
  private lastMaintenanceAt = Date.now();
  private lastLoadForecastReconciliationAt = Date.now();
  private lastOffboardingReconciliationAt = Date.now();
  private offboardingDeadLetteredCount = 0;
  private offboardingLastSuccessAt = Date.now();
  private offboardingConsecutiveFailures = 0;
  private offboardingLastErrorCode: string | null = null;

  constructor(
    private readonly supabase: OutboxSupabaseService,
    private readonly heartbeat: OutboxHeartbeatService,
  ) {}

  onApplicationBootstrap(): void {
    if (this.stopping) return;

    this.trigger();
    this.interval = setInterval(() => this.trigger(), OUTBOX_POLL_INTERVAL_MS);
  }

  async onApplicationShutdown(): Promise<void> {
    this.stopping = true;

    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }

    const inFlight = this.inFlight;
    if (inFlight) await inFlight;
  }

  async runOnce(): Promise<OutboxRunResult> {
    if (this.stopping) return EMPTY_RUN_RESULT;

    const client = this.supabase.client();
    let claimSucceeded = false;
    let claimData: unknown = null;
    try {
      const { data, error } = await client.rpc('claim_outbox_events', {
        claim_worker_id: this.workerId,
        claim_batch_size: OUTBOX_BATCH_SIZE,
        claim_lease_seconds: OUTBOX_LEASE_SECONDS,
      });

      if (!error) {
        claimSucceeded = true;
        claimData = data;
      } else {
        this.logger.error(
          `Réclamation outbox indisponible (code ${error.code || 'inconnu'}).`,
        );
      }
    } catch {
      this.logger.error(
        'Réclamation outbox indisponible après une erreur réseau.',
      );
    }

    const events = claimSucceeded ? this.parseClaims(claimData) : [];
    if (claimSucceeded) await this.markHeartbeatSafely();
    const eventResults = await Promise.all(
      events.map((event) => this.processEvent(client, event)),
    );
    if (!this.stopping) {
      await this.reconcileExpiredLoadForecastOverridesIfDue(
        client,
        claimSucceeded,
      );
    }
    if (!this.stopping) {
      await this.finalizeDueAgentOffboardingsIfDue(client, claimSucceeded);
    }
    if (!this.stopping) {
      await this.runMaintenanceIfDue(client, claimSucceeded);
    }
    if (claimSucceeded) await this.markHeartbeatSafely();
    const processed = eventResults.reduce(
      (count, result) => count + result.processed,
      0,
    );
    const failed = eventResults.reduce(
      (count, result) => count + result.failed,
      0,
    );
    const deadLettered = eventResults.reduce(
      (count, result) => count + result.deadLettered,
      0,
    );

    if (events.length > 0) {
      this.logger.log(
        `Outbox : ${String(processed)} traité(s), ${String(failed)} échec(s), ${String(deadLettered)} en file d’échec.`,
      );
    }

    return {
      claimed: events.length,
      processed,
      failed,
      deadLettered,
    };
  }

  private async processEvent(
    client: ReturnType<OutboxSupabaseService['client']>,
    event: ClaimedEvent,
  ): Promise<EventRunResult> {
    try {
      const materialization = await client.rpc('materialize_outbox_event', {
        target_event_id: event.id,
        target_lease_token: event.lease_token,
      });

      if (
        !materialization.error &&
        this.isProcessedResult(materialization.data)
      ) {
        return { processed: 1, failed: 0, deadLettered: 0 };
      }

      if (!materialization.error) {
        this.logger.warn(
          `Bail outbox ${event.id} devenu obsolète avant traitement.`,
        );
        return { processed: 0, failed: 0, deadLettered: 0 };
      }

      return this.failEvent(client, event, materialization.error.code);
    } catch {
      return this.failEvent(client, event, undefined);
    }
  }

  private async failEvent(
    client: ReturnType<OutboxSupabaseService['client']>,
    event: ClaimedEvent,
    errorCode: string | undefined,
  ): Promise<EventRunResult> {
    try {
      const failure = await client.rpc('fail_outbox_event', {
        target_event_id: event.id,
        target_lease_token: event.lease_token,
        failure_reason: this.safeFailureReason(errorCode),
      });

      if (failure.error) {
        this.logger.error(
          `Impossible de libérer le bail outbox ${event.id} (code ${failure.error.code || 'inconnu'}).`,
        );
        return { processed: 0, failed: 1, deadLettered: 0 };
      }

      const deadLettered = this.isDeadLetterResult(failure.data);

      if (deadLettered) {
        this.logger.warn(
          `Événement outbox ${event.id} placé en file d’échec après ${event.attempt_count}/${event.max_attempts} tentatives.`,
        );
      }

      return {
        processed: 0,
        failed: 1,
        deadLettered: deadLettered ? 1 : 0,
      };
    } catch {
      this.logger.error(
        `Impossible de libérer le bail outbox ${event.id} après une erreur réseau.`,
      );
      return { processed: 0, failed: 1, deadLettered: 0 };
    }
  }

  private async markHeartbeatSafely(): Promise<void> {
    try {
      await this.heartbeat.markHealthy({
        offboardingDeadLetteredCount: this.offboardingDeadLetteredCount,
        offboardingLastSuccessAt: this.offboardingLastSuccessAt,
        offboardingConsecutiveFailures: this.offboardingConsecutiveFailures,
        offboardingLastErrorCode: this.offboardingLastErrorCode,
      });
    } catch {
      this.logger.error(
        'Impossible d’actualiser le heartbeat du worker outbox.',
      );
    }
  }

  private async markBatchHeartbeatSafely(
    claimSucceeded: boolean,
  ): Promise<void> {
    if (claimSucceeded) await this.markHeartbeatSafely();
  }

  private async runMaintenanceIfDue(
    client: ReturnType<OutboxSupabaseService['client']>,
    claimSucceeded: boolean,
  ): Promise<void> {
    const now = Date.now();
    if (
      this.stopping ||
      now - this.lastMaintenanceAt < OUTBOX_MAINTENANCE_INTERVAL_MS
    ) {
      return;
    }

    this.lastMaintenanceAt = now;
    const retainBefore = new Date(
      now - OUTBOX_RETENTION_DAYS * 24 * 60 * 60 * 1_000,
    ).toISOString();

    await this.reconcileElapsedWorkforceConflicts(client, claimSucceeded);
    if (this.stopping) return;
    await this.pruneProcessedEvents(client, retainBefore, claimSucceeded);
  }

  private async finalizeDueAgentOffboardingsIfDue(
    client: ReturnType<OutboxSupabaseService['client']>,
    claimSucceeded: boolean,
  ): Promise<void> {
    const now = Date.now();
    if (
      this.stopping ||
      now - this.lastOffboardingReconciliationAt <
        AGENT_OFFBOARDING_RECONCILIATION_INTERVAL_MS
    ) {
      return;
    }
    this.lastOffboardingReconciliationAt = now;

    try {
      let completedCount = 0;
      let failedCount = 0;
      let deadLetteredCount = 0;
      for (
        let batch = 0;
        batch < AGENT_OFFBOARDING_MAX_RECONCILIATION_BATCHES;
        batch += 1
      ) {
        if (this.stopping) return;

        const result = await client.rpc('finalize_due_agent_offboardings', {
          reconciliation_batch_size:
            AGENT_OFFBOARDING_RECONCILIATION_BATCH_SIZE,
        });

        if (result.error) {
          this.recordOffboardingFailure(result.error.code);
          this.logger.warn(
            `Finalisation des départs différée (code ${result.error.code || 'inconnu'}).`,
          );
          return;
        }

        const parsed = this.parseOffboardingResult(result.data);
        if (!parsed) {
          this.recordOffboardingFailure('INVALID_RESPONSE');
          this.logger.warn(
            'Finalisation des départs différée (réponse invalide).',
          );
          return;
        }

        completedCount += parsed.completedCount;
        failedCount += parsed.failedCount;
        deadLetteredCount = Math.max(
          deadLetteredCount,
          parsed.deadLetteredCount,
        );
        this.offboardingDeadLetteredCount = deadLetteredCount;

        if (parsed.remainingCount === 0) {
          this.recordOffboardingSuccess(now);
          await this.markBatchHeartbeatSafely(claimSucceeded);
          this.logOffboardingReconciliation(
            completedCount,
            failedCount,
            deadLetteredCount,
            false,
          );
          return;
        }

        await this.markBatchHeartbeatSafely(claimSucceeded);
        if (this.stopping) return;
      }

      this.logOffboardingReconciliation(
        completedCount,
        failedCount,
        deadLetteredCount,
        true,
      );
      this.recordOffboardingSuccess(now);
      this.logger.warn(
        'Finalisation des départs plafonnée ; elle reprendra au prochain cycle.',
      );
    } catch {
      this.recordOffboardingFailure('NETWORK');
      this.logger.warn(
        'Finalisation des départs différée après une erreur réseau.',
      );
    }
  }

  private recordOffboardingSuccess(at: number): void {
    this.offboardingLastSuccessAt = at;
    this.offboardingConsecutiveFailures = 0;
    this.offboardingLastErrorCode = null;
  }

  private recordOffboardingFailure(code: string | undefined): void {
    this.offboardingConsecutiveFailures = Math.min(
      this.offboardingConsecutiveFailures + 1,
      1_000_000,
    );
    this.offboardingLastErrorCode =
      code?.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) || 'UNKNOWN';
  }

  private parseOffboardingResult(
    value: unknown,
  ): OffboardingReconciliationResult | null {
    if (!this.isRecord(value)) return null;

    const keys = [
      'completedCount',
      'failedCount',
      'deadLetteredCount',
      'remainingCount',
    ] as const;
    for (const key of keys) {
      const candidate = value[key];
      if (
        typeof candidate !== 'number' ||
        !Number.isSafeInteger(candidate) ||
        candidate < 0
      ) {
        return null;
      }
    }

    return {
      completedCount: value.completedCount as number,
      failedCount: value.failedCount as number,
      deadLetteredCount: value.deadLetteredCount as number,
      remainingCount: value.remainingCount as number,
    };
  }

  private logOffboardingReconciliation(
    completedCount: number,
    failedCount: number,
    deadLetteredCount: number,
    capped: boolean,
  ): void {
    if (completedCount + failedCount + deadLetteredCount === 0 && !capped) {
      return;
    }

    const message =
      `Départs : completed=${String(completedCount)} failed=${String(failedCount)} ` +
      `deadLettered=${String(deadLetteredCount)} capped=${String(capped)}.`;

    if (failedCount > 0 || deadLetteredCount > 0 || capped) {
      this.logger.warn(message);
    } else {
      this.logger.log(message);
    }
  }

  private async reconcileExpiredLoadForecastOverridesIfDue(
    client: ReturnType<OutboxSupabaseService['client']>,
    claimSucceeded: boolean,
  ): Promise<void> {
    const now = Date.now();
    if (
      this.stopping ||
      now - this.lastLoadForecastReconciliationAt <
        LOAD_FORECAST_RECONCILIATION_INTERVAL_MS
    ) {
      return;
    }

    this.lastLoadForecastReconciliationAt = now;
    try {
      for (
        let batch = 0;
        batch < LOAD_FORECAST_MAX_RECONCILIATION_BATCHES;
        batch += 1
      ) {
        if (this.stopping) return;

        const result = await client.rpc(
          'reconcile_expired_call_load_forecast_overrides',
          {
            reconcile_batch_size: LOAD_FORECAST_RECONCILIATION_BATCH_SIZE,
          },
        );

        if (result.error) {
          this.logger.warn(
            `Reprise des charges maritimes différée (code ${result.error.code || 'inconnu'}).`,
          );
          return;
        }

        await this.markBatchHeartbeatSafely(claimSucceeded);
        if (this.stopping) return;
        if (this.numericResult(result.data, 'remainingCount') === 0) return;
      }

      this.logger.warn(
        'Reprise des charges maritimes plafonnée ; elle continuera au prochain cycle.',
      );
    } catch {
      this.logger.warn(
        'Reprise des charges maritimes différée après une erreur réseau.',
      );
    }
  }

  private async reconcileElapsedWorkforceConflicts(
    client: ReturnType<OutboxSupabaseService['client']>,
    claimSucceeded: boolean,
  ): Promise<void> {
    try {
      for (
        let batch = 0;
        batch < WORKFORCE_MAX_RECONCILIATION_BATCHES;
        batch += 1
      ) {
        if (this.stopping) return;

        const result = await client.rpc(
          'reconcile_expired_workforce_conflicts',
          {
            reconcile_batch_size: WORKFORCE_RECONCILIATION_BATCH_SIZE,
          },
        );

        if (result.error) {
          this.logger.warn(
            `Réconciliation RH différée (code ${result.error.code || 'inconnu'}).`,
          );
          return;
        }

        await this.markBatchHeartbeatSafely(claimSucceeded);
        if (this.stopping) return;
        if (this.numericResult(result.data, 'remainingAgentCount') === 0) {
          return;
        }
      }

      this.logger.warn(
        'Réconciliation RH plafonnée pour ce cycle ; elle reprendra au prochain passage.',
      );
    } catch {
      this.logger.warn('Réconciliation RH différée après une erreur réseau.');
    }
  }

  private async pruneProcessedEvents(
    client: ReturnType<OutboxSupabaseService['client']>,
    retainBefore: string,
    claimSucceeded: boolean,
  ): Promise<void> {
    try {
      for (let batch = 0; batch < OUTBOX_MAX_PRUNE_BATCHES; batch += 1) {
        if (this.stopping) return;

        const result = await client.rpc('prune_processed_outbox_events', {
          retain_before: retainBefore,
          prune_batch_size: OUTBOX_PRUNE_BATCH_SIZE,
        });

        if (result.error) {
          this.logger.warn(
            `Rétention outbox différée (code ${result.error.code || 'inconnu'}).`,
          );
          return;
        }

        await this.markBatchHeartbeatSafely(claimSucceeded);
        if (this.stopping) return;
        if (
          this.numericResult(result.data, 'deletedCount') <
          OUTBOX_PRUNE_BATCH_SIZE
        ) {
          return;
        }
      }

      this.logger.warn(
        'Rétention outbox plafonnée pour ce cycle ; elle reprendra au prochain passage.',
      );
    } catch {
      this.logger.warn('Rétention outbox différée après une erreur réseau.');
    }
  }

  private trigger(): void {
    if (this.stopping || this.inFlight) {
      return;
    }

    this.inFlight = this.runOnce()
      .catch(() => {
        this.logger.error('Cycle outbox interrompu par une erreur inattendue.');
        return EMPTY_RUN_RESULT;
      })
      .finally(() => {
        this.inFlight = null;
      });
  }

  private parseClaims(value: unknown): ClaimedEvent[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter((item): item is ClaimedEvent => {
      if (!this.isRecord(item)) {
        return false;
      }

      return (
        typeof item.id === 'string' &&
        typeof item.lease_token === 'string' &&
        typeof item.attempt_count === 'number' &&
        typeof item.max_attempts === 'number'
      );
    });
  }

  private isProcessedResult(value: Json): boolean {
    return this.isRecord(value) && value.processed === true;
  }

  private isDeadLetterResult(value: Json): boolean {
    return this.isRecord(value) && value.deadLettered === true;
  }

  private numericResult(value: unknown, key: string): number {
    if (!this.isRecord(value)) return 0;
    const candidate = value[key];

    return typeof candidate === 'number' && Number.isFinite(candidate)
      ? Math.max(0, candidate)
      : 0;
  }

  private safeFailureReason(code: string | undefined): string {
    const safeCode = code?.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32);

    return safeCode
      ? `Échec de matérialisation (${safeCode})`
      : 'Échec de matérialisation';
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
