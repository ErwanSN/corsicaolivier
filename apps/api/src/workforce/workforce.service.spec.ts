import type { AuthIdentity } from '../auth/auth-context';
import type { SupabaseService } from '../database/supabase.service';
import { WorkforceService } from './workforce.service';

const auth: AuthIdentity = {
  userId: '00000000-0000-4000-8000-000000000001',
  accessToken: 'access-token',
  assuranceLevel: 'aal1',
};

describe('WorkforceService', () => {
  it('pagine les indisponibilités sans masquer la suite', async () => {
    const calls: Array<{ method: string; args: unknown[] }> = [];
    class Query {
      select(...args: unknown[]) {
        calls.push({ method: 'select', args });
        return this;
      }
      eq(...args: unknown[]) {
        calls.push({ method: 'eq', args });
        return this;
      }
      lte(...args: unknown[]) {
        calls.push({ method: 'lte', args });
        return this;
      }
      ilike(...args: unknown[]) {
        calls.push({ method: 'ilike', args });
        return this;
      }
      order(...args: unknown[]) {
        calls.push({ method: 'order', args });
        return this;
      }
      range(...args: unknown[]) {
        calls.push({ method: 'range', args });
        return this;
      }
      then(resolve: (value: unknown) => unknown) {
        return Promise.resolve({
          data: [{ id: 'absence' }],
          count: 21,
          error: null,
        }).then(resolve);
      }
    }
    const service = new WorkforceService({
      forUser: jest.fn().mockReturnValue({ from: () => new Query() }),
    } as unknown as SupabaseService);

    await expect(
      service.listAgentUnavailability(auth.accessToken, auth.userId, {
        page: 1,
        pageSize: 20,
        scope: 'past',
        q: 'formation',
      }),
    ).resolves.toMatchObject({
      page: 1,
      pageSize: 20,
      total: 21,
      totalPages: 2,
      hasMore: true,
    });
    expect(calls).toContainEqual({ method: 'range', args: [0, 19] });
    expect(calls.find((call) => call.method === 'ilike')?.args).toEqual([
      'note',
      '%formation%',
    ]);
  });

  it('remplace une version contractuelle avec la commande atomique', async () => {
    const rpc = jest
      .fn()
      .mockResolvedValue({ data: { id: 'contract' }, error: null });
    const service = new WorkforceService({
      forUser: jest.fn().mockReturnValue({ rpc }),
    } as unknown as SupabaseService);

    await service.setAgentContract(
      auth.accessToken,
      '00000000-0000-4000-8000-000000000002',
      {
        organizationId: '00000000-0000-4000-8000-000000000003',
        effectiveFrom: '2026-08-11',
        weeklyTargetMinutes: 2_100,
        label: 'Temps plein',
      },
    );

    expect(rpc).toHaveBeenCalledWith('replace_agent_contract', {
      target_agent_id: '00000000-0000-4000-8000-000000000002',
      target_organization_id: '00000000-0000-4000-8000-000000000003',
      new_effective_from: '2026-08-11',
      new_effective_until: undefined,
      new_weekly_target_minutes: 2_100,
      new_monthly_target_minutes: undefined,
      new_label: 'Temps plein',
    });
  });

  it('crée puis termine une indisponibilité avec les commandes dédiées', async () => {
    const rpc = jest
      .fn()
      .mockResolvedValue({ data: { id: 'absence' }, error: null });
    const service = new WorkforceService({
      forUser: jest.fn().mockReturnValue({ rpc }),
    } as unknown as SupabaseService);
    const agentId = '00000000-0000-4000-8000-000000000002';

    await service.createAgentUnavailability(auth, agentId, {
      organizationId: '00000000-0000-4000-8000-000000000003',
      siteId: '00000000-0000-4000-8000-000000000004',
      kind: 'leave',
      startsAt: '2026-08-11T08:00:00.000Z',
      endsAt: '2026-08-12T18:00:00.000Z',
      note: 'Congé validé',
    });
    await service.endAgentUnavailability(
      auth.accessToken,
      agentId,
      '00000000-0000-4000-8000-000000000005',
      { endsAt: '2026-08-11T12:00:00.000Z' },
    );

    expect(rpc).toHaveBeenNthCalledWith(1, 'create_agent_unavailability', {
      target_agent_id: agentId,
      target_organization_id: '00000000-0000-4000-8000-000000000003',
      target_site_id: '00000000-0000-4000-8000-000000000004',
      new_kind: 'leave',
      new_starts_at: '2026-08-11T08:00:00.000Z',
      new_ends_at: '2026-08-12T18:00:00.000Z',
      new_note: 'Congé validé',
    });
    expect(rpc).toHaveBeenNthCalledWith(2, 'end_agent_unavailability', {
      target_unavailability_id: '00000000-0000-4000-8000-000000000005',
      target_agent_id: agentId,
      new_ends_at: '2026-08-11T12:00:00.000Z',
    });
  });

  it('remplace explicitement le groupe principal au lieu de créer un doublon', async () => {
    const rpc = jest
      .fn()
      .mockResolvedValue({ data: { id: 'membership' }, error: null });
    const service = new WorkforceService({
      forUser: jest.fn().mockReturnValue({ rpc }),
    } as unknown as SupabaseService);

    await service.addMember(
      auth.accessToken,
      '00000000-0000-4000-8000-000000000010',
      {
        organizationId: '00000000-0000-4000-8000-000000000003',
        agentId: '00000000-0000-4000-8000-000000000002',
        effectiveFrom: '2026-08-11',
        isPrimary: true,
      },
    );

    expect(rpc).toHaveBeenCalledWith('replace_agent_group_membership', {
      target_group_id: '00000000-0000-4000-8000-000000000010',
      target_agent_id: '00000000-0000-4000-8000-000000000002',
      target_organization_id: '00000000-0000-4000-8000-000000000003',
      new_effective_from: '2026-08-11',
      new_effective_until: undefined,
      new_is_primary: true,
    });
  });

  it('termine un rattachement via la commande contrôlée', async () => {
    const rpc = jest
      .fn()
      .mockResolvedValue({ data: { id: 'membership' }, error: null });
    const service = new WorkforceService({
      forUser: jest.fn().mockReturnValue({ rpc }),
    } as unknown as SupabaseService);

    await service.endMembership(
      auth.accessToken,
      '00000000-0000-4000-8000-000000000010',
      '00000000-0000-4000-8000-000000000011',
      {
        organizationId: '00000000-0000-4000-8000-000000000003',
        effectiveUntil: '2026-08-31',
      },
    );

    expect(rpc).toHaveBeenCalledWith('end_agent_group_membership', {
      target_group_id: '00000000-0000-4000-8000-000000000010',
      target_membership_id: '00000000-0000-4000-8000-000000000011',
      target_organization_id: '00000000-0000-4000-8000-000000000003',
      new_effective_until: '2026-08-31',
    });
  });

  it('enregistre un objectif horaire via la commande qui dérive l’auteur', async () => {
    const rpc = jest
      .fn()
      .mockResolvedValue({ data: { id: 'target' }, error: null });
    const service = new WorkforceService({
      forUser: jest.fn().mockReturnValue({ rpc }),
    } as unknown as SupabaseService);

    await service.setHourTarget(auth, {
      organizationId: '00000000-0000-4000-8000-000000000003',
      siteId: '00000000-0000-4000-8000-000000000004',
      agentId: '00000000-0000-4000-8000-000000000002',
      weekStart: '2026-08-10',
      targetMinutes: 1_800,
      reason: 'Semaine de formation',
    });

    expect(rpc).toHaveBeenCalledWith('set_hour_target_override', {
      target_organization_id: '00000000-0000-4000-8000-000000000003',
      target_site_id: '00000000-0000-4000-8000-000000000004',
      target_agent_id: '00000000-0000-4000-8000-000000000002',
      target_group_id: null,
      target_week_start: '2026-08-10',
      new_target_minutes: 1_800,
      new_reason: 'Semaine de formation',
    });
  });
});
