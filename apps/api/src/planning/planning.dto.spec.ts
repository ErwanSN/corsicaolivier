import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import {
  ListPlanningWorkforceConflictsQuery,
  ListReplanningScenariosQuery,
  ResolvePlanningWorkforceConflictDto,
  SavePlanningShiftServiceDto,
  UpdatePlanningAssignmentDto,
} from './planning.dto';

describe('DTO de modification du planning', () => {
  it('borne et normalise la recherche des scénarios de replanification', async () => {
    const input = plainToInstance(ListReplanningScenariosQuery, {
      siteId: '00000000-0000-4000-8000-000000000001',
      page: '2',
      pageSize: '3',
      status: 'simulated',
      baseScheduleVersionIds:
        '00000000-0000-4000-8000-000000000002,00000000-0000-4000-8000-000000000003',
      q: '  retard  ',
    });

    await expect(validate(input)).resolves.toHaveLength(0);
    expect(input.page).toBe(2);
    expect(input.pageSize).toBe(3);
    expect(input.baseScheduleVersionIds).toHaveLength(2);
    expect(input.q).toBe('retard');
  });

  it('accepte une modification complète et la dissociation d’une escale', async () => {
    const input = Object.assign(new UpdatePlanningAssignmentDto(), {
      lockVersion: 3,
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
      lockVersion: -1,
      agentId: 'agent-invalide',
      positionId: '00000000-0000-4000-8000-000000000002',
      startsAt: '2026-07-22T06:00:00.000Z',
      endsAt: '2026-07-22T13:00:00.000Z',
      breakMinutes: 721,
    });

    expect((await validate(input)).length).toBeGreaterThanOrEqual(3);
  });

  it('valide un service multi-poste avec une pause horaire exacte', async () => {
    const input = plainToInstance(SavePlanningShiftServiceDto, {
      lockVersion: 9,
      agentId: '00000000-0000-4000-8000-000000000001',
      startsAt: '2026-07-22T06:00:00.000Z',
      endsAt: '2026-07-22T13:00:00.000Z',
      segments: [
        {
          positionId: '00000000-0000-4000-8000-000000000002',
          startsAt: '2026-07-22T06:00:00.000Z',
          endsAt: '2026-07-22T09:00:00.000Z',
        },
        {
          positionId: '00000000-0000-4000-8000-000000000003',
          startsAt: '2026-07-22T09:00:00.000Z',
          endsAt: '2026-07-22T13:00:00.000Z',
        },
      ],
      breaks: [
        {
          startsAt: '2026-07-22T10:00:00.000Z',
          endsAt: '2026-07-22T10:30:00.000Z',
          label: 'Déjeuner',
        },
      ],
    });

    await expect(validate(input)).resolves.toHaveLength(0);
  });

  it('refuse une liste de segments vide et une pause mal formée', async () => {
    const input = plainToInstance(SavePlanningShiftServiceDto, {
      lockVersion: 2,
      agentId: '00000000-0000-4000-8000-000000000001',
      startsAt: '2026-07-22T06:00:00.000Z',
      endsAt: '2026-07-22T13:00:00.000Z',
      segments: [],
      breaks: [{ startsAt: 'pas-une-date', endsAt: 'pas-une-date' }],
    });

    expect((await validate(input)).length).toBeGreaterThanOrEqual(2);
  });

  it('borne la recherche de conflits RH et transforme explicitement le booléen', async () => {
    const valid = plainToInstance(ListPlanningWorkforceConflictsQuery, {
      siteId: '00000000-0000-4000-8000-000000000001',
      startsOn: '2026-08-10',
      endsOn: '2026-08-16',
      includeResolved: 'false',
      limit: '50',
    });
    const invalid = plainToInstance(ListPlanningWorkforceConflictsQuery, {
      siteId: 'site-invalide',
      includeResolved: 'yes',
      limit: '101',
    });

    expect(valid.includeResolved).toBe(false);
    await expect(validate(valid)).resolves.toHaveLength(0);
    expect((await validate(invalid)).length).toBeGreaterThanOrEqual(2);
  });

  it('exige un motif traçable pour confirmer la résolution', async () => {
    const input = plainToInstance(ResolvePlanningWorkforceConflictDto, {
      reason: 'ok',
    });

    expect(await validate(input)).toHaveLength(1);
  });
});
