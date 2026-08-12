import type { SupabaseService } from '../database/supabase.service';
import { OperationsService } from './operations.service';

describe('OperationsService', () => {
  const scope = {
    organizationId: '00000000-0000-4000-8000-000000000001',
    siteId: '00000000-0000-4000-8000-000000000002',
    portCallId: '00000000-0000-4000-8000-000000000003',
  };

  it('lit uniquement la prévision effective déterminée en base', async () => {
    const forecast = { id: '00000000-0000-4000-8000-000000000004' };
    const rpc = jest.fn().mockResolvedValue({ data: [forecast], error: null });
    const service = new OperationsService({
      forUser: () => ({ rpc }),
    } as unknown as SupabaseService);

    await expect(
      service.listLoadForecasts('access-token', scope.portCallId),
    ).resolves.toEqual([forecast]);
    expect(rpc).toHaveBeenCalledWith('get_latest_call_load_forecasts', {
      target_port_call_ids: [scope.portCallId],
    });
  });

  it('crée une prévision par la commande manuelle sans provenance client', async () => {
    const forecast = {
      id: '00000000-0000-4000-8000-000000000004',
      source: 'tools-panel',
      source_revision: 'manual-server-generated',
    };
    const rpc = jest.fn().mockResolvedValue({ data: forecast, error: null });
    const service = new OperationsService({
      forUser: () => ({ rpc }),
    } as unknown as SupabaseService);

    await expect(
      service.createLoadForecast('access-token', {
        ...scope,
        passengerCount: 420,
        passengerQuota: undefined,
        vehicleCount: 96,
        freightUnitCount: undefined,
        coachCount: undefined,
        reason: 'Comptage terrain actualisé',
        validUntil: '2026-08-11T14:00:00.000Z',
      }),
    ).resolves.toEqual(forecast);

    expect(rpc).toHaveBeenCalledWith('create_manual_call_load_forecast', {
      target_organization_id: scope.organizationId,
      target_site_id: scope.siteId,
      target_port_call_id: scope.portCallId,
      new_passenger_count: 420,
      new_passenger_quota: null,
      new_vehicle_count: 96,
      new_freight_unit_count: 0,
      new_coach_count: 0,
    });
    const rpcCalls = rpc.mock.calls as unknown as Array<
      readonly [string, Record<string, unknown>]
    >;
    expect(rpcCalls[0]?.[1]).not.toHaveProperty('source');
    expect(rpcCalls[0]?.[1]).not.toHaveProperty('source_revision');
  });

  it('protège une correction temporaire par le CAS de la prévision effective', async () => {
    const forecast = { id: '00000000-0000-4000-8000-000000000005' };
    const rpc = jest.fn().mockResolvedValue({ data: forecast, error: null });
    const service = new OperationsService({
      forUser: () => ({ rpc }),
    } as unknown as SupabaseService);

    await service.createLoadForecast('access-token', {
      ...scope,
      passengerCount: 420,
      vehicleCount: 96,
      reason: 'Comptage terrain actualisé',
      validUntil: '2026-08-11T14:00:00.000Z',
      expectedEffectiveForecastId: '00000000-0000-4000-8000-000000000004',
    });

    expect(rpc).toHaveBeenCalledWith(
      'override_call_load_forecast',
      expect.objectContaining({
        expected_effective_forecast_id: '00000000-0000-4000-8000-000000000004',
        override_reason: 'Comptage terrain actualisé',
        override_valid_until: '2026-08-11T14:00:00.000Z',
      }),
    );
  });
});
