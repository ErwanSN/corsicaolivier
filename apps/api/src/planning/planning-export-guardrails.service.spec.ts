import { ConflictException, PayloadTooLargeException } from '@nestjs/common';

import type { SupabaseService } from '../database/supabase.service';
import { PlanningService } from './planning.service';

const SCHEDULE_ID = '00000000-0000-4000-8000-000000000001';
const ASSIGNMENT_ID = '00000000-0000-4000-8000-000000000002';
const AGENT_ID = '00000000-0000-4000-8000-000000000003';
const POSITION_ID = '00000000-0000-4000-8000-000000000004';

describe('PlanningService - garde-fous export et anciennes commandes', () => {
  it('refuse un export démesuré avant de charger les référentiels', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: {
        assignments: [],
        breaks: [],
        period: {},
        shifts: Array.from({ length: 5_001 }, (_, index) => ({ id: index })),
        version: {},
      },
      error: null,
    });
    const from = jest.fn();
    const service = new PlanningService({
      forUser: jest.fn().mockReturnValue({ from, rpc }),
    } as unknown as SupabaseService);

    await expect(
      service.exportSchedule('access-token', SCHEDULE_ID),
    ).rejects.toBeInstanceOf(PayloadTooLargeException);
    expect(from).not.toHaveBeenCalled();
  });

  const legacyOperations: Array<
    [string, (service: PlanningService) => Promise<unknown>]
  > = [
    [
      'déplacement',
      (service) =>
        service.moveAssignment('access-token', SCHEDULE_ID, ASSIGNMENT_ID, {
          lockVersion: 1,
          positionId: POSITION_ID,
          workDate: '2026-08-11',
        }),
    ],
    [
      'modification',
      (service) =>
        service.updateAssignment('access-token', SCHEDULE_ID, ASSIGNMENT_ID, {
          agentId: AGENT_ID,
          breakMinutes: 0,
          endsAt: '2026-08-11T12:00:00.000Z',
          lockVersion: 1,
          positionId: POSITION_ID,
          startsAt: '2026-08-11T08:00:00.000Z',
        }),
    ],
    [
      'suppression',
      (service) =>
        service.deleteAssignment('access-token', SCHEDULE_ID, ASSIGNMENT_ID, {
          lockVersion: 1,
        }),
    ],
  ];

  it.each(legacyOperations)(
    'refuse la %s mono-affectation sur un service multi-postes',
    async (_label, run) => {
      const assignmentQuery = createQuery({
        data: { planning_shift_id: 'shift-multi' },
        error: null,
      });
      const segmentQuery = createQuery({ count: 2, data: null, error: null });
      const rpc = jest.fn();
      const service = new PlanningService({
        forUser: jest.fn().mockReturnValue({
          from: jest
            .fn()
            .mockReturnValueOnce(assignmentQuery)
            .mockReturnValueOnce(segmentQuery),
          rpc,
        }),
      } as unknown as SupabaseService);

      await expect(run(service)).rejects.toBeInstanceOf(ConflictException);
      expect(rpc).not.toHaveBeenCalled();
    },
  );
});

function createQuery(result: Record<string, unknown>) {
  const query: Record<string, jest.Mock> = {};
  query.select = jest.fn(() => query);
  query.eq = jest.fn(() => query);
  query.single = jest.fn().mockResolvedValue(result);
  query.then = jest.fn((resolve: (value: unknown) => unknown) =>
    Promise.resolve(result).then(resolve),
  );
  return query;
}
