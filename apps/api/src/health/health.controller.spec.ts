import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('retourne le statut de disponibilité', () => {
    expect(new HealthController().check()).toEqual({ status: 'ok' });
  });
});
