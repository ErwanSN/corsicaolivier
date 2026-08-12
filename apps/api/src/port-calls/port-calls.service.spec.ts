import { BadRequestException } from '@nestjs/common';

import type { SupabaseService } from '../database/supabase.service';
import { PortCallsService } from './port-calls.service';

const call = {
  id: '00000000-0000-4000-8000-000000000501',
  organization_id: '00000000-0000-4000-8000-000000000001',
  site_id: '00000000-0000-4000-8000-000000000101',
  vessel_id: '00000000-0000-4000-8000-000000000201',
  route_id: null,
  demand_profile_id: null,
  external_reference: 'MRS-501',
  status: 'scheduled' as const,
  scheduled_arrival_at: '2026-08-11T08:00:00.000Z',
  scheduled_departure_at: '2026-08-11T10:00:00.000Z',
  estimated_arrival_at: null,
  estimated_departure_at: null,
  actual_arrival_at: null,
  actual_departure_at: null,
  source: 'corsica-linea-feed',
  source_revision: 'feed-41',
  source_priority: 200,
  source_sequence: 41,
  source_received_at: '2026-08-11T07:00:00.000Z',
  source_override_until: null,
  timing_lock_version: 12,
  received_at: '2026-08-11T07:00:00.000Z',
  created_at: '2026-08-11T07:00:00.000Z',
  updated_at: '2026-08-11T07:00:00.000Z',
};

describe('PortCallsService', () => {
  it('crée une escale uniquement par la commande manuelle contrôlée', async () => {
    const createdCall = {
      ...call,
      source: 'tools-panel',
      source_revision: 'manual-server-generated',
    };
    const rpc = jest.fn().mockResolvedValue({
      data: createdCall,
      error: null,
    });
    const service = new PortCallsService({
      forUser: () => ({ rpc }),
    } as unknown as SupabaseService);

    await expect(
      service.create('access-token', {
        organizationId: call.organization_id,
        siteId: call.site_id,
        vesselId: call.vessel_id,
        routeId: undefined,
        externalReference: 'MRS-MANUAL',
        scheduledArrivalAt: call.scheduled_arrival_at,
        scheduledDepartureAt: undefined,
      }),
    ).resolves.toEqual(createdCall);

    expect(rpc).toHaveBeenCalledWith('create_manual_port_call', {
      target_organization_id: call.organization_id,
      target_site_id: call.site_id,
      target_vessel_id: call.vessel_id,
      target_route_id: null,
      new_external_reference: 'MRS-MANUAL',
      new_scheduled_arrival_at: call.scheduled_arrival_at,
      new_scheduled_departure_at: null,
    });
    const rpcCalls = rpc.mock.calls as unknown as Array<
      readonly [string, Record<string, unknown>]
    >;
    expect(rpcCalls[0]?.[1]).not.toHaveProperty('source');
    expect(rpcCalls[0]?.[1]).not.toHaveProperty('source_revision');
  });

  it('pagine et filtre les escales sans interpréter la recherche utilisateur', async () => {
    type QueryCall = Readonly<{ method: string; arguments_: unknown[] }>;
    type QueryResult = Readonly<{
      data: (typeof call)[];
      error: null;
      count?: number;
    }>;
    const calls: QueryCall[] = [];
    const includedCall = {
      ...call,
      id: '00000000-0000-4000-8000-000000000777',
      external_reference: 'MRS-777',
    };

    class FakePortCallQuery implements PromiseLike<QueryResult> {
      private counted = false;
      private included = false;
      private from = 0;

      select(_columns: string, options?: { count?: string }) {
        this.counted = options?.count === 'exact';
        calls.push({ method: 'select', arguments_: [_columns, options] });
        return this;
      }

      eq(...arguments_: [string, unknown]) {
        if (arguments_[0] === 'id') this.included = true;
        calls.push({ method: 'eq', arguments_ });
        return this;
      }

      order(...arguments_: unknown[]) {
        calls.push({ method: 'order', arguments_ });
        return this;
      }

      range(...arguments_: [number, number]) {
        this.from = arguments_[0];
        calls.push({ method: 'range', arguments_ });
        return this;
      }

      limit(...arguments_: unknown[]) {
        calls.push({ method: 'limit', arguments_ });
        return this;
      }

      in(...arguments_: unknown[]) {
        calls.push({ method: 'in', arguments_ });
        return this;
      }

      ilike(...arguments_: unknown[]) {
        calls.push({ method: 'ilike', arguments_ });
        return this;
      }

      or(...arguments_: unknown[]) {
        calls.push({ method: 'or', arguments_ });
        return this;
      }

      then<TResult1 = QueryResult, TResult2 = never>(
        onfulfilled?:
          ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?:
          ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
      ): Promise<TResult1 | TResult2> {
        const result: QueryResult = this.included
          ? { data: [includedCall], error: null }
          : {
              data: this.from === 50 ? [call] : [],
              error: null,
              count: this.counted ? 51 : undefined,
            };
        return Promise.resolve(result).then(onfulfilled, onrejected);
      }
    }

    const service = new PortCallsService({
      forUser: () => ({ from: () => new FakePortCallQuery() }),
    } as unknown as SupabaseService);

    const result = await service.search('access-token', {
      siteId: call.site_id,
      page: 9,
      pageSize: 25,
      q: 'MRS%_,(A)"*',
      status: ['scheduled', 'delayed'],
      from: '2026-08-01T00:00:00.000Z',
      to: '2026-09-01T00:00:00.000Z',
      includeId: includedCall.id,
    });

    expect(result).toEqual({
      items: [call],
      included: [includedCall],
      page: 3,
      pageSize: 25,
      total: 51,
      totalPages: 3,
    });
    expect(
      calls
        .filter((entry) => entry.method === 'range')
        .map((entry) => entry.arguments_),
    ).toEqual([
      [200, 224],
      [50, 74],
    ]);
    expect(calls).toContainEqual({
      method: 'in',
      arguments_: ['status', ['scheduled', 'delayed']],
    });
    expect(calls).toContainEqual({
      method: 'ilike',
      arguments_: ['external_reference', '%MRS\\%\\_,(A)\\"\\*%'],
    });
    const filters = calls
      .filter((entry) => entry.method === 'or')
      .map((entry) => String(entry.arguments_[0]));
    expect(
      filters.some(
        (filter) =>
          filter.includes('estimated_arrival_at.gte.2026-08-01') &&
          filter.includes('estimated_departure_at.is.null') &&
          filter.includes('scheduled_departure_at.lt.2026-09-01'),
      ),
    ).toBe(true);
  });

  it('conserve la liste historique tout en la limitant à 250 résultats', async () => {
    const limits: number[] = [];

    class FakeListQuery implements PromiseLike<{
      data: (typeof call)[];
      error: null;
    }> {
      select() {
        return this;
      }
      eq() {
        return this;
      }
      order() {
        return this;
      }
      limit(value: number) {
        limits.push(value);
        return this;
      }
      in() {
        return this;
      }
      ilike() {
        return this;
      }
      or() {
        return this;
      }
      then<TResult1 = { data: (typeof call)[]; error: null }, TResult2 = never>(
        onfulfilled?:
          | ((value: {
              data: (typeof call)[];
              error: null;
            }) => TResult1 | PromiseLike<TResult1>)
          | null,
        onrejected?:
          ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
      ): Promise<TResult1 | TResult2> {
        const result: { data: (typeof call)[]; error: null } = {
          data: [call],
          error: null,
        };
        return Promise.resolve(result).then(onfulfilled, onrejected);
      }
    }

    const service = new PortCallsService({
      forUser: () => ({ from: () => new FakeListQuery() }),
    } as unknown as SupabaseService);

    await expect(
      service.list('access-token', { siteId: call.site_id }),
    ).resolves.toEqual([call]);
    expect(limits).toEqual([250]);
  });

  it('refuse une fenêtre non bornée avant d’interroger la base', async () => {
    const forUser = jest.fn();
    const service = new PortCallsService({
      forUser,
    } as unknown as SupabaseService);

    await expect(
      service.search('access-token', {
        siteId: call.site_id,
        from: '2024-01-01T00:00:00.000Z',
        to: '2026-01-02T00:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(forUser).not.toHaveBeenCalled();
  });

  it('transforme la correction opérateur en override temporaire avec CAS', async () => {
    const now = Date.parse('2026-08-11T08:00:00.000Z');
    jest.spyOn(Date, 'now').mockReturnValue(now);
    let rpcFunction: string | undefined;
    let rpcArguments: Record<string, unknown> | undefined;
    const rpc = jest.fn<
      Promise<{ data: { changed: boolean }; error: null }>,
      [functionName: string, arguments_: Record<string, unknown>]
    >((functionName: string, arguments_: Record<string, unknown>) => {
      rpcFunction = functionName;
      rpcArguments = arguments_;
      return Promise.resolve({ data: { changed: true }, error: null });
    });
    const service = new PortCallsService({
      forUser: () => ({ rpc }),
    } as unknown as SupabaseService);

    await expect(
      service.updateTiming('access-token', call.id, {
        estimatedArrivalAt: '2026-08-11T09:00:00.000Z',
        estimatedDepartureAt: '2026-08-11T11:00:00.000Z',
        status: 'delayed',
        expectedCurrentSourceRevision: 'feed-41',
        expectedTimingLockVersion: 12,
        reason: '  Retard confirmé par le port  ',
        validUntil: '2026-08-11T10:00:00.000Z',
      }),
    ).resolves.toEqual({ changed: true });

    expect(rpc).toHaveBeenCalledWith(
      'override_port_call_timing',
      expect.objectContaining({
        override_source: 'tools-panel',
        expected_current_source_revision: 'feed-41',
        expected_timing_lock_version: 12,
        override_reason: 'Retard confirmé par le port',
        override_valid_until: '2026-08-11T10:00:00.000Z',
      }),
    );
    expect(rpcFunction).toBe('override_port_call_timing');
    expect(rpcArguments?.override_source_revision).toBeNull();
    expect(rpcArguments).not.toHaveProperty('update_source');
    jest.restoreAllMocks();
  });

  it('refuse une correction permanente ou quasi immédiate', async () => {
    const now = Date.parse('2026-08-11T08:00:00.000Z');
    jest.spyOn(Date, 'now').mockReturnValue(now);
    const rpc = jest.fn();
    const service = new PortCallsService({
      forUser: () => ({ rpc }),
    } as unknown as SupabaseService);

    await expect(
      service.updateTiming('access-token', call.id, {
        status: 'delayed',
        expectedTimingLockVersion: 12,
        reason: 'Correction trop courte',
        validUntil: '2026-08-11T08:04:59.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(rpc).not.toHaveBeenCalled();
    jest.restoreAllMocks();
  });
});
