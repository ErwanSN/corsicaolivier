import type { SupabaseService } from '../database/supabase.service';
import { PlanningService } from './planning.service';

describe('PlanningService - conflits RH', () => {
  it('charge une fenêtre bornée via le read model RLS', async () => {
    const rpc = jest
      .fn()
      .mockResolvedValue({ data: [{ id: 'conflict' }], error: null });
    const service = new PlanningService({
      forUser: jest.fn().mockReturnValue({ rpc }),
    } as unknown as SupabaseService);

    await service.listPlanningWorkforceConflicts('access-token', {
      siteId: '00000000-0000-4000-8000-000000000001',
      startsOn: '2026-08-10',
      endsOn: '2026-08-16',
      includeResolved: false,
      limit: 20,
    });

    expect(rpc).toHaveBeenCalledWith('get_planning_workforce_conflict_page', {
      target_site_id: '00000000-0000-4000-8000-000000000001',
      range_starts_on: '2026-08-10',
      range_ends_on: '2026-08-16',
      include_resolved: false,
      result_limit: 20,
      result_offset: 0,
    });
  });

  it('prépare le brouillon puis confirme une résolution réelle par commande', async () => {
    const rpc = jest
      .fn()
      .mockResolvedValue({ data: { id: 'result' }, error: null });
    const service = new PlanningService({
      forUser: jest.fn().mockReturnValue({ rpc }),
    } as unknown as SupabaseService);
    const conflictId = '00000000-0000-4000-8000-000000000002';

    await service.preparePlanningWorkforceConflictDraft(
      'access-token',
      conflictId,
    );
    await service.resolvePlanningWorkforceConflict('access-token', conflictId, {
      reason: 'Planning corrigé et publié',
    });

    expect(rpc).toHaveBeenNthCalledWith(1, 'prepare_workforce_conflict_draft', {
      target_conflict_id: conflictId,
    });
    expect(rpc).toHaveBeenNthCalledWith(
      2,
      'resolve_planning_workforce_conflict',
      {
        target_conflict_id: conflictId,
        resolution_reason: 'Planning corrigé et publié',
      },
    );
  });
});
