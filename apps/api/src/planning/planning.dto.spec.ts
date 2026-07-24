import { validate } from 'class-validator';

import { UpdatePlanningAssignmentDto } from './planning.dto';

describe('DTO de modification du planning', () => {
  it('accepte une modification complète et la dissociation d’une escale', async () => {
    const input = Object.assign(new UpdatePlanningAssignmentDto(), {
      agentId: '00000000-0000-4000-8000-000000000001',
      positionId: '00000000-0000-4000-8000-000000000002',
      portCallId: null,
      startsAt: '2026-07-22T06:00:00.000Z',
      endsAt: '2026-07-22T13:00:00.000Z',
      breakMinutes: 30,
      note: null,
    });

    await expect(validate(input)).resolves.toHaveLength(0);
  });

  it('refuse un agent invalide et une pause excessive', async () => {
    const input = Object.assign(new UpdatePlanningAssignmentDto(), {
      agentId: 'agent-invalide',
      positionId: '00000000-0000-4000-8000-000000000002',
      startsAt: '2026-07-22T06:00:00.000Z',
      endsAt: '2026-07-22T13:00:00.000Z',
      breakMinutes: 721,
    });

    expect((await validate(input)).length).toBeGreaterThanOrEqual(2);
  });
});
