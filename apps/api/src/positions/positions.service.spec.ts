import type { SupabaseService } from '../database/supabase.service';
import { PositionsService } from './positions.service';

const position = {
  id: '00000000-0000-4000-8000-000000000003',
  organization_id: '00000000-0000-4000-8000-000000000001',
  site_id: '00000000-0000-4000-8000-000000000002',
  code: 'ACC',
  name: 'Accueil',
  description: null,
  color_token: 'slate',
  active: true,
  created_at: '2026-08-11T08:00:00.000Z',
  updated_at: '2026-08-11T08:00:00.000Z',
};

describe('PositionsService', () => {
  it('retourne une page comptée et signale les postes suivants', async () => {
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
          data: [position],
          count: 51,
          error: null,
        }).then(resolve);
      }
    }
    const service = new PositionsService({
      forUser: jest.fn().mockReturnValue({ from: () => new Query() }),
    } as unknown as SupabaseService);

    await expect(
      service.list(
        'access-token',
        position.organization_id,
        position.site_id,
        1,
        50,
        'acc%_',
      ),
    ).resolves.toMatchObject({
      items: [position],
      page: 1,
      pageSize: 50,
      total: 51,
      totalPages: 2,
      hasMore: true,
    });
    expect(calls).toContainEqual({ method: 'range', args: [0, 49] });
    expect(calls.find((call) => call.method === 'or')?.args[0]).toBe(
      `and(site_id.is.null,name.ilike."%acc\\%\\_%"),and(site_id.is.null,code.ilike."%acc\\%\\_%"),and(site_id.eq.${position.site_id},name.ilike."%acc\\%\\_%"),and(site_id.eq.${position.site_id},code.ilike."%acc\\%\\_%")`,
    );
  });
});
