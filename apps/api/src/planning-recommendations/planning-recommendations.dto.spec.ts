import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { FindPlanningCandidatesDto } from './planning-recommendations.dto';

const validInput = {
  startsAt: '2026-08-11T06:00:00.000Z',
  endsAt: '2026-08-11T14:00:00.000Z',
  segments: [
    {
      positionId: '00000000-0000-4000-8000-000000000001',
      startsAt: '2026-08-11T06:00:00.000Z',
      endsAt: '2026-08-11T14:00:00.000Z',
    },
  ],
  breaks: [
    {
      startsAt: '2026-08-11T10:00:00.000Z',
      endsAt: '2026-08-11T10:30:00.000Z',
    },
  ],
  excludedShiftId: '00000000-0000-4000-8000-000000000002',
  q: '  Marin  ',
  limit: 20,
  offset: 0,
};

describe('DTO des recommandations de candidats', () => {
  it('accepte des segments et pauses bornés et normalise la recherche', async () => {
    const input = plainToInstance(FindPlanningCandidatesDto, validInput);

    await expect(validate(input)).resolves.toHaveLength(0);
    expect(input.q).toBe('Marin');
  });

  it('valide récursivement les segments et refuse une page excessive', async () => {
    const input = plainToInstance(FindPlanningCandidatesDto, {
      ...validInput,
      segments: [
        {
          positionId: 'poste-invalide',
          startsAt: 'demain',
          endsAt: 'plus tard',
        },
      ],
      limit: 51,
      offset: 501,
    });

    expect((await validate(input)).length).toBeGreaterThanOrEqual(3);
  });

  it('refuse une recherche trop courte et un service sans segment', async () => {
    const input = plainToInstance(FindPlanningCandidatesDto, {
      ...validInput,
      segments: [],
      q: 'x',
    });

    expect(await validate(input)).toHaveLength(2);
  });
});
