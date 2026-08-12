import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const repositoryRoot = new URL('../../../', import.meta.url);

async function repositoryFile(path) {
  return readFile(new URL(path, repositoryRoot), 'utf8');
}

test('les parcours mock et Auth réel utilisent des configurations Playwright isolées', async () => {
  const mockConfig = await repositoryFile('apps/web/playwright.config.ts');
  const realConfig = await repositoryFile(
    'apps/web/playwright.real-auth.config.ts',
  );

  assert.match(mockConfig, /testIgnore: '\*\*\/authenticated\.spec\.ts'/);
  assert.match(mockConfig, /NEXT_PUBLIC_SUPABASE_URL: mockServicesURL/);
  assert.doesNotMatch(mockConfig, /E2E_SUPABASE_URL/);

  assert.match(realConfig, /testMatch: 'authenticated\.spec\.ts'/);
  assert.match(realConfig, /E2E_SUPABASE_URL/);
  assert.match(realConfig, /LOCAL|127\.0\.0\.1|localhost/);
  assert.match(realConfig, /trace: 'off'/);
  assert.match(realConfig, /video: 'off'/);
  assert.match(realConfig, /SUPABASE_SERVICE_ROLE_KEY: ''/);
});

test('le provisionneur Auth réel reste local, éphémère et strictement réservé à la CI', async () => {
  const provisioner = await repositoryFile(
    'apps/web/e2e/support/ci-real-auth.mjs',
  );
  const exportedEnvironment = provisioner.match(
    /appendGithubEnvironment\(\{(?<variables>[\s\S]*?)\n    \}\);/u,
  )?.groups?.variables;

  assert.ok(exportedEnvironment, 'variables Playwright exportées introuvables');
  assert.match(provisioner, /GITHUB_ACTIONS !== 'true'/);
  assert.match(provisioner, /CI !== 'true'/);
  assert.match(provisioner, /RUNNER_TEMP/);
  assert.match(provisioner, /LOCAL_HOSTS\.has\(parsedURL\.hostname\)/);
  assert.match(provisioner, /auth\.admin\.createUser/);
  assert.match(provisioner, /auth\.admin\.deleteUser/);
  assert.match(provisioner, /challengeAndVerify/);
  assert.match(provisioner, /::add-mask::/);
  assert.match(exportedEnvironment, /E2E_SUPABASE_PUBLISHABLE_KEY/);
  assert.doesNotMatch(
    exportedEnvironment,
    /SECRET_KEY|SERVICE_ROLE|SUPABASE_SECRET/,
  );
});

test('le job navigateur exécute mock puis Auth local et nettoie toujours', async () => {
  const workflow = await repositoryFile('.github/workflows/ci.yml');
  const browserJob = workflow
    .split('\n  browser:\n')[1]
    ?.split('\n  containers:\n')[0];

  assert.ok(browserJob, 'job browser absent');
  const mockIndex = browserJob.indexOf('run: pnpm test:e2e');
  const startIndex = browserJob.indexOf('run: pnpm db:start');
  const resetIndex = browserJob.indexOf('run: pnpm db:reset');
  const provisionIndex = browserJob.indexOf('ci-real-auth.mjs provision');
  const realIndex = browserJob.indexOf('run test:e2e:real-auth');
  const cleanupIndex = browserJob.indexOf('ci-real-auth.mjs cleanup');

  assert.ok(mockIndex >= 0);
  assert.ok(mockIndex < startIndex);
  assert.ok(startIndex < resetIndex);
  assert.ok(resetIndex < provisionIndex);
  assert.ok(provisionIndex < realIndex);
  assert.ok(realIndex < cleanupIndex);
  assert.match(
    browserJob,
    /name: Delete the ephemeral local Auth account\n        if: always\(\)/,
  );
  assert.match(browserJob, /name: Stop local Supabase\n        if: always\(\)/);
  assert.doesNotMatch(
    browserJob,
    /SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY|SECRET_KEY:/,
  );
});

test('le build web Playwright retire les identifiants et clés privilégiées', async () => {
  const launcher = await repositoryFile('apps/web/e2e/support/start-web.mjs');

  for (const environmentName of [
    'E2E_LOGIN_EMAIL',
    'E2E_LOGIN_PASSWORD',
    'E2E_LOGIN_TOTP_SECRET',
    'SUPABASE_SECRET_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ]) {
    assert.match(launcher, new RegExp(`'${environmentName}'`));
  }
  assert.match(launcher, /delete childEnvironment\[sensitiveName\]/);
  assert.match(launcher, /\['build'\], \{ env: childEnvironment \}/);
});
