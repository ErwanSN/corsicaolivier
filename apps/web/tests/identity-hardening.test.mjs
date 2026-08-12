import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { readAgentDetailSource } from './agent-detail-source.mjs';

test('le parcours MFA couvre enrôlement, challenge et erreurs réseau sans clé privilégiée', async () => {
  const actions = await readFile('src/app/mfa/actions.ts', 'utf8');
  const page = await readFile('src/app/mfa/page.tsx', 'utf8');
  const login = await readFile('src/app/login/actions.ts', 'utf8');
  const loginPage = await readFile('src/app/login/page.tsx', 'utf8');
  const tools = await readFile('src/app/tools/layout.tsx', 'utf8');

  assert.match(actions, /mfa\.enroll/);
  assert.match(actions, /mfa\.challengeAndVerify/);
  assert.match(actions, /currentLevel !== 'aal2'/);
  assert.match(actions, /catch \{/);
  assert.doesNotMatch(actions, /SERVICE_ROLE|serviceRole|secretKey/);
  assert.match(page, /Vérification indisponible/);
  assert.match(login, /destination = '\/mfa'/);
  assert.match(loginPage, /catch \{/);
  assert.match(loginPage, /Le service de sécurité répond mal/);
  assert.match(tools, /redirect\('\/mfa'\)/);
});

test('login et MFA fournissent une identité stable au proxy Auth serveur', async () => {
  const rateLimit = await readFile(
    'src/lib/supabase/auth-rate-limit.ts',
    'utf8',
  );
  const server = await readFile('src/lib/supabase/server.ts', 'utf8');
  const login = await readFile('src/app/login/actions.ts', 'utf8');
  const mfa = await readFile('src/app/mfa/actions.ts', 'utf8');

  assert.match(rateLimit, /createHmac\('sha256'/);
  assert.match(rateLimit, /headers\.set\(\s*GOTRUE_RATE_LIMIT_HEADER/);
  assert.match(rateLimit, /AUTH_PATH_PREFIX = '\/auth\/v1'/);
  assert.doesNotMatch(rateLimit, /SERVICE_ROLE|serviceRole|sb_secret_/);
  assert.match(server, /createSupabaseFetchWithAuthRateLimit/);
  assert.match(login, /createAuthRateLimitIdentity\('login', email\)/);
  assert.match(mfa, /createAuthRateLimitIdentity\('mfa-factor', factorId\)/);
});

test('la fiche RH expose un suivi de départ compact et une relance motivée', async () => {
  const detail = await readAgentDetailSource();
  const list = await readFile('src/app/tools/planning/agents/page.tsx', 'utf8');
  const actions = await readFile('src/app/tools/planning/actions.ts', 'utf8');

  assert.match(detail, /Suivi du départ/);
  assert.match(detail, /offboardingPlan\.failureCode/);
  assert.match(detail, /action=\{retryAgentOffboarding\}/);
  assert.match(detail, /Annuler le départ programmé/);
  assert.match(detail, /Suivi du départ indisponible/);
  assert.match(detail, /<details/);
  assert.match(list, /name="offboardingReason"/);
  assert.match(list, /Réactiver avec accès minimal/);
  assert.match(actions, /\/offboarding-plan\/retry/);
  assert.match(actions, /offboardingReason/);
});
