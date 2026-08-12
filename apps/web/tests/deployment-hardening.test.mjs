import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('le runtime web read-only garde uniquement ses caches éphémères accessibles', async () => {
  const compose = await readFile(
    new URL('../../../docker-compose.coolify.yml', import.meta.url),
    'utf8',
  );
  const webService = compose.split('\n  web:\n')[1];

  assert.ok(webService, 'service web absent de la composition');
  assert.match(webService, /read_only: true/);
  assert.match(
    webService,
    /\/app\/apps\/web\/\.next\/cache:rw,noexec,nosuid,uid=1001,gid=1001,mode=0750,size=128m/,
  );
  assert.match(
    webService,
    /\/tmp:rw,noexec,nosuid,uid=1001,gid=1001,mode=1777,size=64m/,
  );
  assert.doesNotMatch(webService, /NEXT_PUBLIC_SSO_DOMAIN|SSO_DOMAIN/);
});

test('l’image prépare le point de montage du cache Next pour l’UID non-root', async () => {
  const dockerfile = await readFile(
    new URL('../Dockerfile', import.meta.url),
    'utf8',
  );

  assert.match(dockerfile, /adduser -S nextjs -u 1001/);
  assert.match(
    dockerfile,
    /mkdir -p \/app\/apps\/web\/\.next\/cache && chown nextjs:nodejs/,
  );
  assert.ok(dockerfile.indexOf('USER nextjs') > dockerfile.indexOf('mkdir -p'));
});

test('l’image API ne copie que ses dépendances de production', async () => {
  const dockerfile = await readFile(
    new URL('../../api/Dockerfile', import.meta.url),
    'utf8',
  );

  assert.match(
    dockerfile,
    /pnpm --filter @corsica\/planning-api deploy --prod --legacy \/prod\/api/,
  );
  assert.match(
    dockerfile,
    /COPY --from=build --chown=nestjs:nodejs \/prod\/api\/node_modules \.\/node_modules/,
  );
  assert.doesNotMatch(
    dockerfile,
    /COPY --from=build[^\n]*\/repo\/node_modules/,
  );
});

test('le backplane Auth relie uniquement le web et exige ses secrets runtime', async () => {
  const compose = await readFile(
    new URL('../../../docker-compose.coolify.yml', import.meta.url),
    'utf8',
  );
  const apiService = compose.split('\n  api:\n')[1]?.split('\n  worker:\n')[0];
  const workerService = compose
    .split('\n  worker:\n')[1]
    ?.split('\n  web:\n')[0];
  const webService = compose.split('\n  web:\n')[1]?.split('\nnetworks:\n')[0];

  assert.ok(apiService);
  assert.ok(workerService);
  assert.ok(webService);
  assert.doesNotMatch(apiService, /auth-backplane|SUPABASE_AUTH_INTERNAL_URL/);
  assert.match(apiService, /SUPABASE_AUTH_RATE_LIMIT_SECRET: (?:''|"")/);
  assert.doesNotMatch(
    workerService,
    /auth-backplane|SUPABASE_AUTH_INTERNAL_URL/,
  );
  assert.match(workerService, /SUPABASE_AUTH_RATE_LIMIT_SECRET: (?:''|"")/);
  assert.match(webService, /- auth-backplane/);
  assert.match(
    webService,
    /SUPABASE_AUTH_INTERNAL_URL: \$\{SUPABASE_AUTH_INTERNAL_URL:\?[^}]+\}/,
  );
  assert.match(
    webService,
    /SUPABASE_AUTH_RATE_LIMIT_SECRET: \$\{SUPABASE_AUTH_RATE_LIMIT_SECRET:-\}/,
  );
  assert.match(webService, /SUPABASE_SERVICE_ROLE_KEY: (?:''|"")/);
  assert.match(webService, /traefik\.enable=true/);
  assert.match(webService, /traefik\.docker\.network=coolify/);
  assert.match(
    webService,
    /traefik\.http\.routers\.corsica-planning-https\.rule=Host\(`corsica\.skynet-initiative\.com`\)/,
  );
  assert.match(
    webService,
    /traefik\.http\.services\.corsica-planning\.loadbalancer\.server\.port=3000/,
  );
  assert.doesNotMatch(
    webService.split('\n    environment:\n')[0],
    /SUPABASE_AUTH_RATE_LIMIT_SECRET/,
  );
  assert.match(
    compose,
    /auth-backplane:\n    name: \$\{SUPABASE_AUTH_NETWORK:\?[^}]+\}\n    external: true/,
  );
});

test('le runbook verrouille les prérequis GoTrue et la chaîne proxy publique', async () => {
  const runbook = await readFile(
    new URL('../../../docs/EXPLOITATION.md', import.meta.url),
    'utf8',
  );

  assert.match(runbook, /GOTRUE_RATE_LIMIT_HEADER=X-Forwarded-For/);
  assert.match(runbook, /GOTRUE_SECURITY_SB_FORWARDED_FOR_ENABLED=false/);
  assert.match(runbook, /GOTRUE_MFA_RATE_LIMIT_CHALLENGE_AND_VERIFY=15/);
  assert.match(runbook, /docker network create --internal/);
  assert.match(runbook, /aliases:\n\s+- supabase-auth/);
  assert.match(
    runbook,
    /SUPABASE_AUTH_INTERNAL_URL=http:\/\/supabase-auth:9999/,
  );
  assert.match(runbook, /forwardedHeaders\.insecure=false/);
  assert.match(runbook, /forwardedHeaders\.notAppendXForwardedFor=false/);
  assert.match(runbook, /exactement deux\s+endpoints/);
  assert.match(
    runbook,
    /plusieurs\s+réplicas multiplient la capacité effective/,
  );
});
