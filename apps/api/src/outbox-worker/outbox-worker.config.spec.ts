import { validateOutboxWorkerEnvironment } from './outbox-worker.config';

describe('validateOutboxWorkerEnvironment', () => {
  it('exige le secret seulement au démarrage du runtime worker', () => {
    expect(() =>
      validateOutboxWorkerEnvironment({
        SUPABASE_URL: 'https://example.supabase.co',
      }),
    ).toThrow('SUPABASE_SERVICE_ROLE_KEY');
  });

  it('accepte une configuration worker isolée', () => {
    const variables = {
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_worker-placeholder',
    };

    expect(validateOutboxWorkerEnvironment(variables)).toBe(variables);
  });

  it('refuse une clé publiable sans jamais la recopier dans l’erreur', () => {
    const publishableKey = 'sb_publishable_should-not-leak';

    expect(() =>
      validateOutboxWorkerEnvironment({
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: publishableKey,
      }),
    ).toThrow('clé privilégiée valide');

    try {
      validateOutboxWorkerEnvironment({
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: publishableKey,
      });
    } catch (error) {
      expect(String(error)).not.toContain(publishableKey);
    }
  });

  it('refuse une URL Supabase non HTTP', () => {
    expect(() =>
      validateOutboxWorkerEnvironment({
        SUPABASE_URL: 'file:///etc/passwd',
        SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_worker-placeholder',
      }),
    ).toThrow('URL HTTP valide');
  });
});
