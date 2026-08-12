import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const artifactDirectory = 'ops/supabase-dr';

function parseChecksumManifest(source) {
  return source
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const match = line.match(/^([a-f0-9]{64}) {2}(.+)$/);
      assert.ok(match, `entrée SHA-256 invalide : ${line}`);
      return { hash: match[1], path: match[2] };
    });
}

async function assertManifestMatches(manifestPath) {
  const manifest = parseChecksumManifest(await readFile(manifestPath, 'utf8'));

  for (const entry of manifest) {
    const actual = createHash('sha256')
      .update(await readFile(`${artifactDirectory}/${entry.path}`))
      .digest('hex');
    assert.equal(actual, entry.hash, `${entry.path} a dérivé de son empreinte`);
  }

  return manifest;
}

test('le bootstrap DR est complet, ordonné et figé par SHA-256', async () => {
  const manifest = await assertManifestMatches(
    `${artifactDirectory}/bootstrap-checksums.sha256`,
  );
  const expectedFiles = [
    'bootstrap/webhooks.sql',
    'bootstrap/jwt.sql.template',
    'bootstrap/roles.sql.template',
    'bootstrap/_supabase.sql',
    'bootstrap/logs.sql',
    'bootstrap/pooler.sql',
    'bootstrap/realtime.sql',
    'bootstrap-order.txt',
    'recovery-acl.sql',
    'recovery-acl.expected.txt',
    'local-public-acl-hardening.sql',
  ];

  assert.deepEqual(
    manifest.map(({ path }) => path),
    expectedFiles,
  );

  const order = (
    await readFile(`${artifactDirectory}/bootstrap-order.txt`, 'utf8')
  )
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));

  assert.deepEqual(order, [
    'init-scripts/98-webhooks.sql postgres bootstrap/webhooks.sql',
    'init-scripts/99-jwt.sql postgres bootstrap/jwt.sql.template',
    'init-scripts/99-roles.sql postgres bootstrap/roles.sql.template',
    'migrations/97-_supabase.sql supabase_admin bootstrap/_supabase.sql',
    'migrations/99-logs.sql supabase_admin bootstrap/logs.sql',
    'migrations/99-pooler.sql supabase_admin bootstrap/pooler.sql',
    'migrations/99-realtime.sql supabase_admin bootstrap/realtime.sql',
  ]);
});

test('les cinq scripts Coolify non sensibles restent des copies exactes', async () => {
  const manifest = await assertManifestMatches(
    `${artifactDirectory}/coolify-source-checksums.sha256`,
  );

  assert.deepEqual(
    manifest.map(({ path }) => path),
    [
      'bootstrap/_supabase.sql',
      'bootstrap/logs.sql',
      'bootstrap/pooler.sql',
      'bootstrap/realtime.sql',
      'bootstrap/webhooks.sql',
    ],
  );
});

test('les templates de secrets sont obligatoires et échouent fermés', async () => {
  const roles = await readFile(
    `${artifactDirectory}/bootstrap/roles.sql.template`,
    'utf8',
  );
  const jwt = await readFile(
    `${artifactDirectory}/bootstrap/jwt.sql.template`,
    'utf8',
  );

  assert.match(roles, /\\getenv dr_postgres_password POSTGRES_PASSWORD/);
  assert.match(roles, /octet_length\(:'dr_postgres_password'\) >= 16/);
  assert.match(roles, /PASSWORD :'dr_postgres_password'/);
  assert.match(jwt, /\\getenv dr_jwt_secret JWT_SECRET/);
  assert.match(jwt, /\\getenv dr_jwt_exp JWT_EXP/);
  assert.match(jwt, /octet_length\(:'dr_jwt_secret'\) >= 32/);
  assert.match(jwt, /ALTER DATABASE :"dr_database_name"/);

  for (const template of [roles, jwt]) {
    assert.match(template, /\\set ON_ERROR_STOP on/);
    assert.match(template, /SELECT 1 \/ 0 AS dr_bootstrap_guard/);
    assert.doesNotMatch(template, /\\quit\b/);
    assert.doesNotMatch(template, /`|\becho\b/);
    assert.doesNotMatch(template, /\beyJ[A-Za-z0-9_-]{20,}\./);
    assert.doesNotMatch(template, /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/);
  }

  assert.doesNotMatch(roles, /PASSWORD\s+(?:E)?'/i);
  assert.doesNotMatch(jwt, /jwt_secret"\s+TO\s+(?:E)?'/i);
});

test('le lancement DR ne fournit aucun secret littéral et refuse une cible ambiguë', async () => {
  const compose = await readFile(
    `${artifactDirectory}/docker-compose.bootstrap.yml`,
    'utf8',
  );
  const dockerfile = await readFile(
    `${artifactDirectory}/Dockerfile.bootstrap`,
    'utf8',
  );
  const runner = await readFile('scripts/supabase-dr-bootstrap.sh', 'utf8');
  const readme = await readFile(`${artifactDirectory}/README.md`, 'utf8');

  assert.match(
    dockerfile,
    /postgres:15\.8\.1\.085@sha256:af083ef64d0408c8f098ee6f5c364a59b26f36fbc0f3a334a62c5c1d57362e9b/,
  );
  for (const destination of [
    'init-scripts/98-webhooks.sql',
    'init-scripts/99-jwt.sql',
    'init-scripts/99-roles.sql',
    'migrations/97-_supabase.sql',
    'migrations/99-logs.sql',
    'migrations/99-pooler.sql',
    'migrations/99-realtime.sql',
  ]) {
    assert.match(dockerfile, new RegExp(destination.replaceAll('.', '\\.')));
  }
  assert.match(compose, /dockerfile: Dockerfile\.bootstrap/);
  assert.match(compose, /POSTGRES_PASSWORD: \$\{POSTGRES_PASSWORD:\?/);
  assert.match(compose, /JWT_SECRET: \$\{JWT_SECRET:\?/);
  assert.match(compose, /JWT_EXP: \$\{JWT_EXP:\?/);
  assert.match(compose, /name: \$\{DR_PGDATA_VOLUME:\?/);
  assert.doesNotMatch(compose, /^name:/m);
  assert.doesNotMatch(compose, /DR_PGDATA_VOLUME:-/);
  assert.match(compose, /external: true/);
  assert.doesNotMatch(compose, /^\s*ports:/m);
  assert.match(compose, /internal: true/);

  assert.match(runner, /^set \+x$/m);
  assert.match(runner, /YES-I-CONFIRM-EMPTY-TARGET/);
  assert.match(runner, /preflight_empty_target/);
  assert.match(runner, /supabase_functions existe déjà : cible non vide/);
  assert.match(runner, /alter role postgres superuser/);
  assert.match(runner, /alter role postgres nosuperuser/);
  assert.match(runner, /trap cleanup EXIT/);
  assert.match(runner, /volume-preflight/);
  assert.match(runner, /require_environment DR_PGDATA_VOLUME/);
  assert.match(runner, /require_environment COMPOSE_PROJECT_NAME/);
  assert.match(
    runner,
    /COMPOSE_PROJECT_NAME.*DR_PGDATA_VOLUME.*même identifiant unique/,
  );
  assert.match(runner, /\^corsica-supabase-dr-/);
  assert.match(runner, /com\.docker\.compose\.project/);
  assert.match(runner, /volume ls --quiet/);
  assert.match(runner, /volume create/);
  assert.match(runner, /existe déjà ; choisissez un nouveau nom/);
  assert.match(runner, /com\.corsica\.dr\.preflight-claim/);
  assert.match(runner, /création concurrente détectée/);
  assert.match(runner, /from auth\.users/);
  assert.match(runner, /from auth\.schema_migrations/);
  assert.match(runner, /from storage\.objects/);
  assert.match(runner, /to_regnamespace\('supabase_migrations'\) is null/);
  assert.match(runner, /un objet public non fourni par une extension existe/);
  for (const authBaseline of [
    '20171026211738',
    '20171026211808',
    '20171026211834',
    '20180103212743',
    '20180108183307',
    '20180119214651',
    '20180125194653',
  ]) {
    assert.match(runner, new RegExp(authBaseline));
  }

  const grantFunction = runner.slice(
    runner.indexOf('grant_temporary_bootstrap_superuser()'),
    runner.indexOf('revoke_temporary_bootstrap_superuser()'),
  );
  assert.ok(
    grantFunction.indexOf('temporary_postgres_superuser=true') <
      grantFunction.indexOf('alter role postgres superuser'),
  );
  assert.match(grantFunction, /select rolsuper from pg_roles/);
  assert.match(runner, /select not rolsuper from pg_roles/);
  assert.doesNotMatch(runner, /volume\s+(?:rm|prune)\b/);
  assert.doesNotMatch(runner, /(?:--set|-v)\s+[^\n]*(?:password|secret)/i);

  const preflightPosition = readme.indexOf(
    'bash scripts/supabase-dr-bootstrap.sh volume-preflight',
  );
  const composePosition = readme.indexOf('docker compose');
  assert.notEqual(preflightPosition, -1);
  assert.ok(preflightPosition < composePosition);
  assert.match(readme, /ne supprime jamais de volume/);
  assert.match(readme, /déclaré `external`/);
  assert.match(readme, /SIGKILL/);
  assert.match(readme, /cible en quarantaine/);
  assert.match(readme, /alter role postgres nosuperuser/);
});

test('les ACL de reprise reproduisent la référence stricte sans accès public métier', async () => {
  const recoveryAcl = await readFile(
    `${artifactDirectory}/recovery-acl.sql`,
    'utf8',
  );
  const expected = await readFile(
    `${artifactDirectory}/recovery-acl.expected.txt`,
    'utf8',
  );
  const expectedRows = expected.trim().split('\n');
  const fingerprint = await readFile(
    'scripts/public-schema-fingerprint.sql',
    'utf8',
  );

  assert.equal(expectedRows.length, 27);
  assert.match(recoveryAcl, /SET LOCAL ROLE postgres/);
  assert.match(recoveryAcl, /SET LOCAL ROLE supabase_admin/);
  assert.match(recoveryAcl, /SET LOCAL ROLE supabase_auth_admin/);
  assert.match(recoveryAcl, /REVOKE ALL PRIVILEGES ON DATABASE %I FROM PUBLIC/);
  assert.match(
    recoveryAcl,
    /GRANT CONNECT, TEMPORARY ON DATABASE %I TO PUBLIC/,
  );
  assert.match(
    recoveryAcl,
    /supabase_admin IN SCHEMA public GRANT ALL PRIVILEGES ON FUNCTIONS TO postgres, service_role/,
  );
  assert.match(
    recoveryAcl,
    /PUBLIC\/anon\/authenticated must not receive postgres or supabase_admin public defaults/,
  );
  assert.doesNotMatch(
    expected,
    /(?:postgres|supabase_admin)\|public\|[^\n]+\b(?:anon|authenticated)=/,
  );
  assert.match(
    fingerprint,
    /54608488df650684a9136d081f22e0149ec7e9ffee76d6ecfdd059eaa31140a4/,
  );
  assert.doesNotMatch(fingerprint, /3fb3d433/);
});

test('le reset local et la CI appliquent toujours le hardening ACL reproductible', async () => {
  const packageSource = JSON.parse(await readFile('package.json', 'utf8'));
  const workflow = await readFile('.github/workflows/ci.yml', 'utf8');
  const hardeningRunner = await readFile(
    'scripts/database-hardening.mjs',
    'utf8',
  );

  assert.equal(
    packageSource.scripts['db:harden'],
    'node scripts/database-hardening.mjs',
  );
  assert.match(packageSource.scripts['db:reset'], /&& pnpm db:harden$/);
  assert.match(workflow, /run: pnpm db:reset/);
  assert.match(hardeningRunner, /DATABASE_HARDENING_CONTAINER/);
  assert.match(hardeningRunner, /local-public-acl-hardening\.sql/);
  assert.match(hardeningRunner, /actual !== '6\|0'/);
  assert.doesNotMatch(hardeningRunner, /postgres(?:ql)?:\/\//i);
  assert.doesNotMatch(hardeningRunner, /PGPASSWORD|POSTGRES_PASSWORD/);
});

test('le runbook impose le pipeline canonique et la barrière MFA TOTP', async () => {
  const runbook = await readFile('docs/EXPLOITATION.md', 'utf8');

  assert.match(
    runbook,
    /clean schema → baseline 001 à 030 → data-only\s+→ migrations 031 à 043/,
  );
  assert.match(runbook, /GOTRUE_MFA_TOTP_ENROLL_ENABLED=true/);
  assert.match(runbook, /GOTRUE_MFA_TOTP_VERIFY_ENABLED=true/);
  assert.match(runbook, /challenge TOTP réel/i);
  assert.match(runbook, /TABLE DATA supabase_migrations/);
  assert.match(runbook, /on_auth_user_created/);
  assert.match(runbook, /session_user=supabase_admin/);
  assert.match(runbook, /SET LOCAL ROLE postgres/);
});
