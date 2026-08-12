import { defineConfig, devices } from '@playwright/test';

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} est obligatoire pour le parcours Auth réel.`);
  }

  return value;
}

const webPort = 3200;
const servicesPort = 3201;
const baseURL = `http://127.0.0.1:${webPort}`;
const mockServicesURL = `http://127.0.0.1:${servicesPort}`;
const supabaseURL = requiredEnvironment('E2E_SUPABASE_URL');
const publishableKey = requiredEnvironment('E2E_SUPABASE_PUBLISHABLE_KEY');
const authRateLimitSecret = requiredEnvironment('E2E_AUTH_RATE_LIMIT_SECRET');
const parsedSupabaseURL = new URL(supabaseURL);

if (
  parsedSupabaseURL.protocol !== 'http:' ||
  !['127.0.0.1', 'localhost', '::1'].includes(parsedSupabaseURL.hostname) ||
  parsedSupabaseURL.username ||
  parsedSupabaseURL.password ||
  parsedSupabaseURL.pathname !== '/' ||
  parsedSupabaseURL.search ||
  parsedSupabaseURL.hash
) {
  throw new Error(
    'E2E_SUPABASE_URL doit cibler la racine HTTP d’un Supabase local en boucle locale.',
  );
}

export default defineConfig({
  testDir: './e2e',
  testMatch: 'authenticated.spec.ts',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  outputDir: 'test-results/real-auth',
  use: {
    baseURL,
    screenshot: 'off',
    trace: 'off',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium-real-auth',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
  webServer: [
    {
      command: 'node e2e/support/mock-services.mjs',
      env: {
        E2E_LOGIN_EMAIL: '',
        E2E_LOGIN_PASSWORD: '',
        E2E_LOGIN_TOTP_SECRET: '',
        E2E_MOCK_SERVICES_PORT: String(servicesPort),
        SECRET_KEY: '',
        SERVICE_ROLE_KEY: '',
        SUPABASE_SECRET_KEY: '',
        SUPABASE_SERVICE_ROLE_KEY: '',
      },
      port: servicesPort,
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: 'node e2e/support/start-web.mjs',
      env: {
        API_URL: mockServicesURL,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
        NEXT_PUBLIC_SUPABASE_URL: supabaseURL,
        SUPABASE_AUTH_INTERNAL_URL: `${supabaseURL.replace(/\/$/u, '')}/auth/v1`,
        SUPABASE_AUTH_RATE_LIMIT_SECRET: authRateLimitSecret,
        SUPABASE_SERVER_URL: supabaseURL,
        NEXT_TELEMETRY_DISABLED: '1',
        PORT: String(webPort),
      },
      url: `${baseURL}/login`,
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
});
