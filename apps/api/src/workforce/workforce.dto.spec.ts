import 'reflect-metadata';

import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

import {
  CreateAgentUnavailabilityDto,
  EndAgentUnavailabilityDto,
  ListAgentUnavailabilityQuery,
} from './workforce.dto';

describe('DTO du cycle RH', () => {
  it('accepte une indisponibilité complète', async () => {
    const input = Object.assign(new CreateAgentUnavailabilityDto(), {
      organizationId: '00000000-0000-4000-8000-000000000001',
      siteId: '00000000-0000-4000-8000-000000000002',
      kind: 'training',
      startsAt: '2026-08-11T08:00:00.000Z',
      endsAt: '2026-08-11T16:00:00.000Z',
      note: 'Formation sûreté',
    });

    expect(await validate(input)).toHaveLength(0);
  });

  it('refuse un motif et des horodatages invalides', async () => {
    const input = Object.assign(new CreateAgentUnavailabilityDto(), {
      organizationId: 'organisation-invalide',
      siteId: 'site-invalide',
      kind: 'unknown',
      startsAt: 'demain matin',
      endsAt: 'demain soir',
    });

    expect((await validate(input)).length).toBeGreaterThanOrEqual(5);
  });

  it('exige un horodatage ISO pour terminer une indisponibilité', async () => {
    const input = Object.assign(new EndAgentUnavailabilityDto(), {
      endsAt: 'maintenant',
    });

    expect(await validate(input)).toHaveLength(1);
  });

  it('borne et normalise la pagination de l’historique', async () => {
    const input = plainToInstance(ListAgentUnavailabilityQuery, {
      page: '3',
      pageSize: '20',
      scope: 'past',
      q: '  formation  ',
    });

    expect(await validate(input)).toHaveLength(0);
    expect(input).toEqual({
      page: 3,
      pageSize: 20,
      scope: 'past',
      q: 'formation',
    });
  });
});
