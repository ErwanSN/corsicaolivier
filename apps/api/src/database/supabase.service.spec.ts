import { SupabaseService } from './supabase.service';

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({ auth: { getClaims: jest.fn() } })),
}));

const configService = {
  get: jest.fn((key: string) => {
    if (key === 'supabase.url') {
      return 'https://supabase.example.invalid';
    }

    if (key === 'supabase.publishableKey') {
      return 'publishable-test-key';
    }

    throw new Error(`Clé de configuration inattendue : ${key}`);
  }),
};

const ok = () => new Response(null, { status: 200 });
const denied = () =>
  new Response(
    JSON.stringify({ code: '42501', message: 'permission denied' }),
    {
      headers: { 'Content-Type': 'application/json' },
      status: 401,
    },
  );

describe('SupabaseService.checkHealth', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('valide Auth, PostgREST et les deux marqueurs de lecture de la migration 043', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(ok())
      .mockResolvedValueOnce(ok())
      .mockResolvedValueOnce(denied())
      .mockResolvedValueOnce(denied());

    await expect(
      new SupabaseService(configService as never).checkHealth(),
    ).resolves.toEqual({ auth: true, database: true, schema: true });

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[2]?.[0]).toBeInstanceOf(URL);
    expect(fetchMock.mock.calls[2]?.[0]).toMatchObject({
      pathname: '/rest/v1/agent_offboarding_plans',
      search: '?select=id&limit=0',
    });
    expect(fetchMock.mock.calls[3]?.[0]).toBeInstanceOf(URL);
    expect(fetchMock.mock.calls[3]?.[0]).toMatchObject({
      pathname: '/rest/v1/rpc/get_agent_offboarding_plan',
    });
    expect(fetchMock.mock.calls[3]?.[1]).toMatchObject({
      body: JSON.stringify({
        target_agent_id: '00000000-0000-0000-0000-000000000000',
        target_organization_id: '00000000-0000-0000-0000-000000000000',
      }),
      method: 'POST',
    });
  });

  it.each([
    [404, 'PGRST205'],
    [404, 'PGRST202'],
    [200, '42501'],
    [401, 'PGRST301'],
  ])('refuse un marqueur au statut %s et au code %s', async (status, code) => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(ok())
      .mockResolvedValueOnce(ok())
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code }), {
          headers: { 'Content-Type': 'application/json' },
          status,
        }),
      )
      .mockResolvedValueOnce(denied());

    await expect(
      new SupabaseService(configService as never).checkHealth(),
    ).resolves.toEqual({ auth: true, database: true, schema: false });
  });

  it('ferme la sonde si la réponse ou le réseau est invalide', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(ok())
      .mockResolvedValueOnce(ok())
      .mockResolvedValueOnce(new Response('not-json', { status: 401 }))
      .mockRejectedValueOnce(new Error('network unavailable'));

    await expect(
      new SupabaseService(configService as never).checkHealth(),
    ).resolves.toEqual({ auth: false, database: false, schema: false });
  });
});
