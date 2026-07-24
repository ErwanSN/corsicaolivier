import { validate } from 'class-validator';

import { CreatePortCallDto, UpdatePortCallTimingDto } from './port-call.dto';

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
      source: 'tools-panel',
    });
    const invalid = Object.assign(new UpdatePortCallTimingDto(), {
      ...valid,
      status: 'unknown',
    });

    await expect(validate(valid)).resolves.toHaveLength(0);
    expect(await validate(invalid)).not.toHaveLength(0);
  });
});
