import type { SupabaseService } from '../database/supabase.service';
import { AgentsService } from './agents.service';

const agent = {
  id: '00000000-0000-4000-8000-000000000501',
  organization_id: '00000000-0000-4000-8000-000000000001',
  primary_site_id: '00000000-0000-4000-8000-000000000101',
  user_id: null,
  employee_number: 'MRS-501',
  display_name: 'AGENT TEST',
  active: true,
  hired_on: null,
  left_on: null,
  created_at: '2026-07-19T00:00:00.000Z',
  updated_at: '2026-07-19T00:00:00.000Z',
};

describe('AgentsService', () => {
  it('pagine, recherche et compte toute l’équipe sans perdre les agents inclus', async () => {
    type QueryCall = Readonly<{ method: string; arguments_: unknown[] }>;
    type QueryResult = Readonly<{
      data: (typeof agent)[] | null;
      error: null;
      count?: number | null;
    }>;
    const calls: QueryCall[] = [];
    const includedAgent = {
      ...agent,
      id: '00000000-0000-4000-8000-000000000777',
      employee_number: 'MRS-777',
      display_name: 'AGENT DÉJÀ AFFECTÉ',
      active: false,
    };

    class FakeAgentQuery implements PromiseLike<QueryResult> {
      private head = false;
      private count = false;
      private active: boolean | undefined;
      private included = false;
      private from = 0;

      select(_columns: string, options?: { count?: string; head?: boolean }) {
        calls.push({ method: 'select', arguments_: [_columns, options] });
        this.head = options?.head ?? false;
        this.count = options?.count === 'exact';
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

      eq(...arguments_: [string, unknown]) {
        if (arguments_[0] === 'active') this.active = Boolean(arguments_[1]);
        calls.push({ method: 'eq', arguments_ });
        return this;
      }

      or(...arguments_: unknown[]) {
        calls.push({ method: 'or', arguments_ });
        return this;
      }

      in(...arguments_: unknown[]) {
        this.included = true;
        calls.push({ method: 'in', arguments_ });
        return this;
      }

      then<TResult1 = QueryResult, TResult2 = never>(
        onfulfilled?:
          ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?:
          ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
      ): Promise<TResult1 | TResult2> {
        let result: QueryResult;

        if (this.head) {
          result = {
            data: null,
            error: null,
            count: this.active ? 64 : 11,
          };
        } else if (this.included) {
          result = { data: [includedAgent], error: null };
        } else if (this.count) {
          result = {
            data: this.from === 50 ? [agent] : [],
            error: null,
            count: 75,
          };
        } else {
          result = { data: [], error: null };
        }

        return Promise.resolve(result).then(onfulfilled, onrejected);
      }
    }

    const from = jest.fn(() => new FakeAgentQuery());
    const forUser = jest.fn(() => ({ from }));
    const service = new AgentsService({
      forUser,
    } as unknown as SupabaseService);

    const result = await service.search('access-token', {
      siteId: agent.primary_site_id,
      page: 9,
      pageSize: 25,
      q: 'Anne%_,(A)"*',
      status: 'active',
      includeIds: [includedAgent.id, includedAgent.id],
    });

    expect(result).toEqual({
      items: [agent],
      included: [includedAgent],
      page: 3,
      pageSize: 25,
      total: 75,
      totalPages: 3,
      hasMore: false,
      counts: { all: 75, active: 64, inactive: 11 },
    });
    expect(
      calls
        .filter((call) => call.method === 'range')
        .map((call) => call.arguments_),
    ).toEqual([
      [200, 224],
      [50, 74],
    ]);
    expect(calls.find((call) => call.method === 'or')?.arguments_[0]).toBe(
      'display_name.ilike."%Anne\\%\\_,(A)\\"\\*%",employee_number.ilike."%Anne\\%\\_,(A)\\"\\*%"',
    );
    expect(calls.find((call) => call.method === 'in')?.arguments_[1]).toEqual([
      includedAgent.id,
    ]);
    expect(calls).toContainEqual({
      method: 'select',
      arguments_: ['*', { count: 'exact' }],
    });
    expect(
      calls.filter(
        (call) =>
          call.method === 'select' &&
          (call.arguments_[1] as { head?: boolean } | undefined)?.head,
      ),
    ).toHaveLength(2);
  });

  it('conserve la liste historique mais la charge par lots au-delà de 500', async () => {
    type QueryResult = Readonly<{ data: (typeof agent)[]; error: null }>;
    const ranges: Array<[number, number]> = [];

    class FakeLegacyQuery implements PromiseLike<QueryResult> {
      private from = 0;

      select() {
        return this;
      }

      order() {
        return this;
      }

      range(from: number, to: number) {
        this.from = from;
        ranges.push([from, to]);
        return this;
      }

      eq() {
        return this;
      }

      then<TResult1 = QueryResult, TResult2 = never>(
        onfulfilled?:
          ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?:
          ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
      ): Promise<TResult1 | TResult2> {
        const data =
          this.from === 0
            ? Array.from({ length: 500 }, (_, index) => ({
                ...agent,
                id: `agent-${index}`,
              }))
            : [{ ...agent, id: 'agent-500' }];
        return Promise.resolve({ data, error: null } as QueryResult).then(
          onfulfilled,
          onrejected,
        );
      }
    }

    const service = new AgentsService({
      forUser: () => ({ from: () => new FakeLegacyQuery() }),
    } as unknown as SupabaseService);

    const result = await service.list('access-token', agent.primary_site_id);

    expect(result).toHaveLength(501);
    expect(ranges).toEqual([
      [0, 499],
      [500, 999],
    ]);
  });

  it('délègue la création et le matricule par défaut à la commande atomique', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: agent, error: null });
    const forUser = jest.fn().mockReturnValue({ rpc });
    const service = new AgentsService({
      forUser,
    } as unknown as SupabaseService);

    await service.create('access-token', {
      organizationId: agent.organization_id,
      primarySiteId: agent.primary_site_id,
      displayName: agent.display_name,
    });

    expect(rpc).toHaveBeenCalledWith('create_agent_record', {
      target_organization_id: agent.organization_id,
      target_primary_site_id: agent.primary_site_id,
      new_user_id: undefined,
      new_employee_number: undefined,
      new_display_name: agent.display_name,
      new_active: undefined,
      new_hired_on: undefined,
    });
  });

  it('modifie la fiche via un patch atomique borné à son organisation', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: agent, error: null });
    const forUser = jest.fn().mockReturnValue({ rpc });
    const service = new AgentsService({
      forUser,
    } as unknown as SupabaseService);

    await service.update('access-token', agent.id, {
      organizationId: agent.organization_id,
      primarySiteId: agent.primary_site_id,
      employeeNumber: agent.employee_number,
      displayName: 'NOUVEAU NOM',
      active: false,
      hiredOn: null,
      leftOn: '2026-07-31',
      offboardingReason: 'Fin de mission confirmée',
    });

    expect(rpc).toHaveBeenCalledWith('update_agent_record', {
      target_agent_id: agent.id,
      target_organization_id: agent.organization_id,
      changes: {
        primarySiteId: agent.primary_site_id,
        employeeNumber: agent.employee_number,
        displayName: 'NOUVEAU NOM',
        active: false,
        hiredOn: null,
        leftOn: '2026-07-31',
        offboardingReason: 'Fin de mission confirmée',
      },
    });
  });

  it('expose un suivi borné et relance un départ en échec par RPC auditée', async () => {
    const failedPlan = {
      status: 'failed',
      effectiveAt: '2026-08-11T00:00:00.000Z',
      retryCount: 5,
      failureCode: 'P0001',
      failedAt: '2026-08-11T00:05:00.000Z',
    };
    const rpc = jest
      .fn()
      .mockResolvedValueOnce({ data: failedPlan, error: null })
      .mockResolvedValueOnce({
        data: { ...failedPlan, status: 'scheduled', retryCount: 0 },
        error: null,
      });
    const service = new AgentsService({
      forUser: () => ({ rpc }),
    } as unknown as SupabaseService);

    await expect(
      service.getOffboardingPlan(
        'access-token',
        agent.id,
        agent.organization_id,
      ),
    ).resolves.toEqual(failedPlan);
    await expect(
      service.retryOffboarding(
        'access-token',
        agent.id,
        agent.organization_id,
        'Incident corrigé par les opérations',
      ),
    ).resolves.toEqual(
      expect.objectContaining({ status: 'scheduled', retryCount: 0 }),
    );

    expect(rpc).toHaveBeenNthCalledWith(1, 'get_agent_offboarding_plan', {
      target_agent_id: agent.id,
      target_organization_id: agent.organization_id,
    });
    expect(rpc).toHaveBeenNthCalledWith(2, 'retry_failed_agent_offboarding', {
      target_agent_id: agent.id,
      target_organization_id: agent.organization_id,
      retry_reason: 'Incident corrigé par les opérations',
    });
  });
});
