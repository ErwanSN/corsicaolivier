import { validateEnvironment } from './validate-environment';

describe('validateEnvironment', () => {
  it('accepte une configuration valide', () => {
    const variables = {
      API_PORT: '3001',
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_PUBLISHABLE_KEY: 'publishable',
    };

    expect(validateEnvironment(variables)).toBe(variables);
  });

  it('refuse une configuration Supabase incomplète', () => {
    expect(() => validateEnvironment({})).toThrow(
      'SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY',
    );
  });

  it('refuse une URL Supabase non HTTP et une origine CORS avec chemin', () => {
    expect(() =>
      validateEnvironment({
        SUPABASE_URL: 'file:///tmp/database',
        SUPABASE_PUBLISHABLE_KEY: 'publishable',
      }),
    ).toThrow('SUPABASE_URL');

    expect(() =>
      validateEnvironment({
        CORS_ORIGIN: 'https://corsica.example.test/login',
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_PUBLISHABLE_KEY: 'publishable',
      }),
    ).toThrow('origines HTTP exactes');
  });

  it('refuse une clé secrète moderne sans l’inclure dans l’erreur', () => {
    const unsafeKey = 'sb_secret_forbidden_test_value';

    expect(() =>
      validateEnvironment({
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_PUBLISHABLE_KEY: unsafeKey,
      }),
    ).toThrow('clé publiable non privilégiée');

    try {
      validateEnvironment({
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_PUBLISHABLE_KEY: unsafeKey,
      });
    } catch (error) {
      expect(String(error)).not.toContain(unsafeKey);
    }
  });

  it('refuse un ancien JWT service_role mais accepte un JWT anon', () => {
    const jwt = (role: string) =>
      [
        Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url'),
        Buffer.from(JSON.stringify({ role })).toString('base64url'),
        'signature',
      ].join('.');

    expect(() =>
      validateEnvironment({
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_PUBLISHABLE_KEY: jwt('service_role'),
      }),
    ).toThrow('clé publiable non privilégiée');

    expect(() =>
      validateEnvironment({
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_PUBLISHABLE_KEY: jwt('anon'),
      }),
    ).not.toThrow();
  });
});
