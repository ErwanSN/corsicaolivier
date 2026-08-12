import type { SupabaseService } from '../database/supabase.service';
import { PlanningService } from './planning.service';

describe('PlanningService - scénarios bornés', () => {
  it('filtre avant pagination et expose le total restant', async () => {
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
      in(...args: unknown[]) {
        calls.push({ method: 'in', args });
        return this;
      }
      or(...args: unknown[]) {
        calls.push({ method: 'or', args });
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
          data: [{ id: 'scenario' }],
          count: 4,
          error: null,
        }).then(resolve);
      }
    }
    const service = new PlanningService({
      forUser: jest.fn().mockReturnValue({ from: () => new Query() }),
    } as unknown as SupabaseService);
    const versionId = '00000000-0000-4000-8000-000000000002';

    await expect(
      service.listReplanningScenarios('access-token', {
        siteId: '00000000-0000-4000-8000-000000000001',
        page: 1,
        pageSize: 3,
        status: 'simulated',
        baseScheduleVersionIds: [versionId],
        q: 'retard',
      }),
    ).resolves.toMatchObject({
      page: 1,
      pageSize: 3,
      total: 4,
      totalPages: 2,
      hasMore: true,
    });
    expect(calls).toContainEqual({ method: 'range', args: [0, 2] });
    expect(calls).toContainEqual({
      method: 'in',
      args: ['base_schedule_version_id', [versionId]],
    });
  });

  it('pagine les besoins figés au-delà de la limite PostgREST', async () => {
    const firstPage = Array.from({ length: 500 }, (_, index) => ({
      id: `requirement-${String(index)}`,
    }));
    const secondPage = [{ id: 'requirement-500' }];
    const range = jest
      .fn()
      .mockResolvedValueOnce({ data: firstPage, error: null })
      .mockResolvedValueOnce({ data: secondPage, error: null });
    const query = { order: jest.fn(), range };
    query.order.mockReturnValue(query);
    const rpc = jest.fn().mockReturnValue(query);
    const service = new PlanningService({
      forUser: jest.fn().mockReturnValue({ rpc }),
    } as unknown as SupabaseService);
    const versionId = '00000000-0000-4000-8000-000000000002';

    await expect(
      service.getScheduleRequirements('access-token', versionId),
    ).resolves.toHaveLength(501);
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenNthCalledWith(1, 'get_schedule_requirements', {
      target_schedule_version_id: versionId,
    });
    expect(query.order).toHaveBeenCalledWith('starts_at');
    expect(query.order).toHaveBeenCalledWith('id');
    expect(range).toHaveBeenNthCalledWith(1, 0, 499);
    expect(range).toHaveBeenNthCalledWith(2, 500, 999);
  });
});
