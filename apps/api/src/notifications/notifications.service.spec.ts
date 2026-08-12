import { NotFoundException } from '@nestjs/common';

import type { AuthIdentity } from '../auth/auth-context';
import type { SupabaseService } from '../database/supabase.service';
import { NotificationsService } from './notifications.service';

const auth: AuthIdentity = {
  userId: '00000000-0000-4000-8000-000000000001',
  accessToken: 'access-token',
  assuranceLevel: 'aal1',
};

function queryResult<T>(result: T) {
  const query: Record<string, jest.Mock> & {
    then?: (resolve: (value: T) => unknown) => Promise<unknown>;
  } = {};
  for (const method of [
    'eq',
    'maybeSingle',
    'not',
    'or',
    'order',
    'range',
    'select',
  ]) {
    query[method] = jest.fn().mockReturnValue(query);
  }
  query.then = (resolve) => Promise.resolve(result).then(resolve);
  return query;
}

describe('NotificationsService', () => {
  it('pagine et compte uniquement les notifications du collaborateur connecté', async () => {
    const agentQuery = queryResult({
      data: { id: '00000000-0000-4000-8000-000000000002' },
      error: null,
    });
    const notificationQuery = queryResult({
      count: 31,
      data: [
        {
          id: '00000000-0000-4000-8000-000000000003',
          organization_id: '00000000-0000-4000-8000-000000000004',
          site_id: '00000000-0000-4000-8000-000000000005',
          agent_id: '00000000-0000-4000-8000-000000000002',
          scenario_id: null,
          status: 'sent',
          channel: 'in_app',
          subject: 'Planning publié',
          body: 'Votre planning est prêt.',
          idempotency_key: 'planning-1',
          sent_at: '2026-08-11T08:00:00.000Z',
          acknowledged_at: null,
          failed_reason: null,
          created_at: '2026-08-11T08:00:00.000Z',
          updated_at: '2026-08-11T08:00:00.000Z',
        },
      ],
      error: null,
    });
    const from = jest.fn((table: string) =>
      table === 'agents' ? agentQuery : notificationQuery,
    );
    const service = new NotificationsService({
      forUser: jest.fn().mockReturnValue({ from }),
    } as unknown as SupabaseService);

    await expect(
      service.list(auth, {
        page: 1,
        pageSize: 30,
        unreadOnly: true,
        q: 'planning',
      }),
    ).resolves.toMatchObject({
      page: 1,
      pageSize: 30,
      total: 31,
      totalPages: 2,
      hasMore: true,
      items: [{ subject: 'Planning publié' }],
    });
    expect(agentQuery.eq).toHaveBeenCalledWith('user_id', auth.userId);
    expect(notificationQuery.eq).toHaveBeenCalledWith(
      'agent_id',
      '00000000-0000-4000-8000-000000000002',
    );
    expect(notificationQuery.not).toHaveBeenCalledWith(
      'status',
      'in',
      '(acknowledged,cancelled)',
    );
    expect(notificationQuery.range).toHaveBeenCalledWith(0, 29);
  });

  it('renvoie une page vide si le compte ne correspond à aucun agent actif', async () => {
    const service = new NotificationsService({
      forUser: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue(
          queryResult({
            data: null,
            error: null,
          }),
        ),
      }),
    } as unknown as SupabaseService);

    await expect(service.list(auth, {})).resolves.toEqual({
      items: [],
      page: 1,
      pageSize: 30,
      total: 0,
      totalPages: 1,
      hasMore: false,
    });
  });

  it('confirme une notification par une commande self-scoped', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: { id: 'notification-id', status: 'acknowledged' },
      error: null,
    });
    const service = new NotificationsService({
      forUser: jest.fn().mockReturnValue({ rpc }),
    } as unknown as SupabaseService);

    await expect(
      service.acknowledge('access-token', 'notification-id'),
    ).resolves.toEqual({
      id: 'notification-id',
      status: 'acknowledged',
    });
    expect(rpc).toHaveBeenCalledWith('acknowledge_my_notification', {
      target_notification_id: 'notification-id',
    });
  });

  it('ne révèle pas une notification absente ou appartenant à un autre agent', async () => {
    const service = new NotificationsService({
      forUser: jest.fn().mockReturnValue({
        rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
      }),
    } as unknown as SupabaseService);

    await expect(
      service.acknowledge('access-token', 'notification-id'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
