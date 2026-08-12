import { validate } from 'class-validator';

import {
  CreateDemandProfileLineDto,
  CreateLoadForecastDto,
} from './operations.dto';

describe('DTO des opérations', () => {
  it('accepte une règle de besoin complète', async () => {
    const input = Object.assign(new CreateDemandProfileLineDto(), {
      organizationId: '00000000-0000-4000-8000-000000000001',
      siteId: '00000000-0000-4000-8000-000000000002',
      positionId: '00000000-0000-4000-8000-000000000003',
      anchor: 'arrival',
      startsOffsetMinutes: -120,
      durationMinutes: 240,
      baseAgents: 2,
      passengersPerExtraAgent: 150,
      vehiclesPerExtraAgent: 50,
      freightUnitsPerExtraAgent: 20,
      coachesPerExtraAgent: 4,
      minimumAgents: 2,
      maximumAgents: 12,
    });

    await expect(validate(input)).resolves.toHaveLength(0);
  });

  it('refuse les coefficients de charge nuls et les fenêtres excessives', async () => {
    const input = Object.assign(new CreateDemandProfileLineDto(), {
      organizationId: '00000000-0000-4000-8000-000000000001',
      siteId: '00000000-0000-4000-8000-000000000002',
      positionId: '00000000-0000-4000-8000-000000000003',
      anchor: 'departure',
      startsOffsetMinutes: 1600,
      durationMinutes: 0,
      baseAgents: 1,
      passengersPerExtraAgent: 0,
      freightUnitsPerExtraAgent: 0,
      minimumAgents: 1,
    });

    expect((await validate(input)).length).toBeGreaterThanOrEqual(4);
  });

  it('accepte une prévision vide mais jamais une charge négative', async () => {
    const valid = Object.assign(new CreateLoadForecastDto(), {
      organizationId: '00000000-0000-4000-8000-000000000001',
      siteId: '00000000-0000-4000-8000-000000000002',
      portCallId: '00000000-0000-4000-8000-000000000003',
      passengerCount: 0,
      vehicleCount: 0,
      reason: 'Comptage terrain actualisé',
      validUntil: '2026-08-11T14:00:00.000Z',
    });
    const invalid = Object.assign(new CreateLoadForecastDto(), {
      ...valid,
      passengerCount: -1,
    });

    await expect(validate(valid)).resolves.toHaveLength(0);
    expect(await validate(invalid)).not.toHaveLength(0);
  });

  it('n’accepte aucune provenance maritime choisie par le navigateur', async () => {
    const input = Object.assign(new CreateLoadForecastDto(), {
      organizationId: '00000000-0000-4000-8000-000000000001',
      siteId: '00000000-0000-4000-8000-000000000002',
      portCallId: '00000000-0000-4000-8000-000000000003',
      passengerCount: 10,
      vehicleCount: 5,
      source: 'corsica-linea-feed',
      sourceRevision: 'reserved-feed-41',
    });

    expect(
      await validate(input, {
        forbidNonWhitelisted: true,
        whitelist: true,
      }),
    ).not.toHaveLength(0);
  });
});
