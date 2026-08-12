import 'reflect-metadata';

import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

import {
  CreatePortCallDto,
  SearchPortCallsQuery,
  UpdatePortCallTimingDto,
} from './port-call.dto';

describe('DTO des escales', () => {
  const scope = {
    organizationId: '00000000-0000-4000-8000-000000000001',
    siteId: '00000000-0000-4000-8000-000000000002',
    vesselId: '00000000-0000-4000-8000-000000000003',
  };

  it('exige au moins une heure d’arrivée ou de départ', async () => {
    const empty = Object.assign(new CreatePortCallDto(), scope);
    const arrival = Object.assign(new CreatePortCallDto(), scope, {
      scheduledArrivalAt: '2026-07-19T08:30:00.000Z',
    });

    expect(await validate(empty)).not.toHaveLength(0);
    await expect(validate(arrival)).resolves.toHaveLength(0);
  });

  it('limite l’état aux statuts opérationnels connus', async () => {
    const valid = Object.assign(new UpdatePortCallTimingDto(), {
      estimatedArrivalAt: '2026-07-19T09:30:00.000Z',
      status: 'delayed',
      expectedCurrentSourceRevision: 'feed-41',
      expectedTimingLockVersion: 12,
      reason: 'Retard confirmé par le port',
      validUntil: '2026-07-19T11:30:00.000Z',
    });
    const invalid = Object.assign(new UpdatePortCallTimingDto(), {
      ...valid,
      status: 'unknown',
    });

    await expect(validate(valid)).resolves.toHaveLength(0);
    expect(await validate(invalid)).not.toHaveLength(0);
  });

  it('valide et borne les filtres de recherche serveur', async () => {
    const query = plainToInstance(SearchPortCallsQuery, {
      siteId: scope.siteId,
      page: '3',
      pageSize: '50',
      q: '  MRS%_,(A)"*  ',
      status: 'scheduled,delayed',
      from: '2026-07-01T00:00:00.000Z',
      to: '2026-08-01T00:00:00.000Z',
    });

    await expect(validate(query)).resolves.toHaveLength(0);
    expect(query).toEqual(
      expect.objectContaining({
        page: 3,
        pageSize: 50,
        q: 'MRS%_,(A)"*',
        status: ['scheduled', 'delayed'],
      }),
    );

    const oversized = plainToInstance(SearchPortCallsQuery, {
      siteId: scope.siteId,
      pageSize: '101',
      status: 'unknown',
    });
    expect(await validate(oversized)).not.toHaveLength(0);
  });

  it('n’accepte plus une source choisie par le navigateur', async () => {
    const timingInput = Object.assign(new UpdatePortCallTimingDto(), {
      status: 'delayed',
      source: 'tools-panel',
      expectedTimingLockVersion: 12,
      reason: 'Correction opérateur',
      validUntil: '2026-07-19T11:30:00.000Z',
    });
    const creationInput = Object.assign(new CreatePortCallDto(), scope, {
      scheduledArrivalAt: '2026-07-19T08:30:00.000Z',
      source: 'corsica-linea-feed',
    });

    expect(
      await validate(timingInput, {
        forbidNonWhitelisted: true,
        whitelist: true,
      }),
    ).not.toHaveLength(0);
    expect(
      await validate(creationInput, {
        forbidNonWhitelisted: true,
        whitelist: true,
      }),
    ).not.toHaveLength(0);
  });
});
