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
});
