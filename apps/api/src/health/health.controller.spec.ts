import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('retourne le statut de disponibilité lorsque les dépendances répondent', async () => {
    const supabase = {
      checkHealth: jest
        .fn()
        .mockResolvedValue({ auth: true, database: true, schema: true }),
    };

    await expect(
      new HealthController(supabase as never).check(),
    ).resolves.toEqual({ status: 'ok' });
  });

  it('refuse la disponibilité lorsque Supabase est indisponible', async () => {
    const supabase = {
      checkHealth: jest
        .fn()
        .mockResolvedValue({ auth: true, database: false, schema: true }),
    };

    await expect(
      new HealthController(supabase as never).check(),
    ).rejects.toMatchObject({ status: 503 });
  });

  it('refuse la disponibilité lorsque le schéma 043 manque', async () => {
    const supabase = {
      checkHealth: jest
        .fn()
        .mockResolvedValue({ auth: true, database: true, schema: false }),
    };

    await expect(
      new HealthController(supabase as never).check(),
    ).rejects.toMatchObject({ status: 503 });
  });
});
