import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

test('les types Supabase restent une sortie générée reproductible', async () => {
  const [generated, aliases, prettierIgnore, eslintConfig] = await Promise.all([
    readFile('apps/api/src/database/database.types.ts', 'utf8'),
    readFile('apps/api/src/database/database.aliases.ts', 'utf8'),
    readFile('.prettierignore', 'utf8'),
    readFile('apps/api/eslint.config.mjs', 'utf8'),
  ]);

  assert.ok(generated.startsWith('export type Json ='));
  assert.match(generated, /export type Database =/);
  assert.match(generated, /agent_contract_versions:/);
  assert.match(generated, /planning_workforce_conflicts:/);
  assert.match(generated, /get_planning_agent_candidates:/);
  assert.match(generated, /reconcile_expired_workforce_conflicts:/);
  assert.match(generated, /app_role:/);
  assert.doesNotMatch(generated, /export type AppRole/);
  assert.match(aliases, /Database\['public'\]\['Enums'\]\['app_role'\]/);
  assert.match(prettierIgnore, /apps\/api\/src\/database\/database\.types\.ts/);
  assert.match(eslintConfig, /src\/database\/database\.types\.ts/);
});

test('la CI détecte toute dérive après la reconstruction de la base', async () => {
  const [manifest, workflow, generator] = await Promise.all([
    readFile('package.json', 'utf8').then(JSON.parse),
    readFile('.github/workflows/ci.yml', 'utf8'),
    readFile('scripts/database-types.mjs', 'utf8'),
  ]);

  assert.equal(manifest.scripts['db:types'], 'node scripts/database-types.mjs');
  assert.equal(
    manifest.scripts['db:types:check'],
    'node scripts/database-types.mjs --check',
  );
  assert.ok(workflow.indexOf('pnpm db:reset') >= 0);
  assert.ok(
    workflow.indexOf('pnpm db:types:check') > workflow.indexOf('pnpm db:reset'),
  );
  assert.match(generator, /supabaseBinary/);
  assert.match(generator, /committed !== generated/);
  assert.doesNotMatch(generator, /SERVICE_ROLE|DATABASE_URL|password/iu);
});

test('le garde accepte une sortie identique et refuse une dérive', async () => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'corsica-db-types-'));
  const fakeSupabase = join(temporaryDirectory, 'supabase-fixture.mjs');
  const currentFixture = join(temporaryDirectory, 'current.ts');
  const driftedFixture = join(temporaryDirectory, 'drifted.ts');
  const generated = await readFile(
    'apps/api/src/database/database.types.ts',
    'utf8',
  );

  try {
    await writeFile(
      fakeSupabase,
      `#!/usr/bin/env node
import { readFileSync } from 'node:fs';
process.stdout.write(readFileSync(process.env.DATABASE_TYPES_FIXTURE, 'utf8'));
`,
    );
    await chmod(fakeSupabase, 0o755);
    await writeFile(currentFixture, generated);
    await writeFile(
      driftedFixture,
      generated.replace(
        'export type Database =',
        'export type DriftedDatabase =',
      ),
    );

    const runCheck = (fixture) =>
      spawnSync(process.execPath, ['scripts/database-types.mjs', '--check'], {
        cwd: process.cwd(),
        encoding: 'utf8',
        env: {
          ...process.env,
          DATABASE_TYPES_FIXTURE: fixture,
          DATABASE_TYPES_SUPABASE_BINARY: fakeSupabase,
        },
      });

    const synchronized = runCheck(currentFixture);
    assert.equal(synchronized.status, 0, synchronized.stderr);
    assert.match(synchronized.stdout, /synchronisés/);

    const drifted = runCheck(driftedFixture);
    assert.equal(drifted.status, 1);
    assert.match(drifted.stderr, /ont dérivé/);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});
