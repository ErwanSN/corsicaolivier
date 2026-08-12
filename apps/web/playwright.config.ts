import { defineConfig, devices } from '@playwright/test';

const webPort = 3100;
const servicesPort = 3101;
const baseURL = `http://127.0.0.1:${webPort}`;
const mockServicesURL = `http://127.0.0.1:${servicesPort}`;
const publishableKey = 'sb_publishable_e2e_only';

export default defineConfig({
  testDir: './e2e',
  testIgnore: '**/authenticated.spec.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  outputDir: 'test-results/mock',
  use: {
    baseURL,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
  webServer: [
    {
      command: 'node e2e/support/mock-services.mjs',
      env: { E2E_MOCK_SERVICES_PORT: String(servicesPort) },
      port: servicesPort,
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: 'node e2e/support/start-web.mjs',
      env: {
        API_URL: mockServicesURL,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
        NEXT_PUBLIC_SUPABASE_URL: mockServicesURL,
        SUPABASE_AUTH_INTERNAL_URL: `${mockServicesURL}/auth/v1`,
        SUPABASE_AUTH_RATE_LIMIT_SECRET:
          'ZWUyLXRlc3Qtb25seS1yYXRlLWxpbWl0LXNlY3JldC0wMDAwMA',
        SUPABASE_SERVER_URL: mockServicesURL,
        NEXT_TELEMETRY_DISABLED: '1',
        PORT: String(webPort),
      },
      url: `${baseURL}/login`,
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
});
