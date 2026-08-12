import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { glob, readFile } from 'node:fs/promises';
import test from 'node:test';

import { parse } from 'pgsql-parser';

async function loadMigrations() {
  const migrations = [];

  for await (const path of glob('supabase/migrations/*.sql')) {
    migrations.push({ path, sql: await readFile(path, 'utf8') });
  }

  return migrations.sort((left, right) => left.path.localeCompare(right.path));
}

test('toutes les migrations publiées restent figées par checksum', async () => {
  const manifest = await readFile(
    'supabase/migration-checksums.sha256',
    'utf8',
  );
  const entries = manifest
    .trim()
    .split('\n')
    .map((line) => {
      const match = line.match(/^([a-f0-9]{64})  (.+\.sql)$/);
      assert.ok(match, `entrée de checksum invalide : ${line}`);

      return { expected: match[1], path: match[2] };
    });
  const frozenMigrations = await loadMigrations();

  assert.deepEqual(
    entries.map(({ path }) => path).sort(),
    frozenMigrations.map(({ path }) => path).sort(),
    'le manifeste doit couvrir exactement toutes les migrations 001 à 043',
  );

  for (const { expected, path } of entries) {
    const actual = createHash('sha256')
      .update(await readFile(path))
      .digest('hex');
    assert.equal(actual, expected, `${path} a été réécrite après son gel`);
  }
});

test('le dépôt ne contient que des données locales explicitement fictives', async () => {
  const seed = await readFile('supabase/seed.sql', 'utf8');
  const ignoredPaths = await readFile('.gitignore', 'utf8');
  const migrationSource = (await loadMigrations())
    .map(({ sql }) => sql)
    .join('\n');
  const corpusFiles = [];

  for await (const path of glob('corpus/**/*')) corpusFiles.push(path);

  assert.deepEqual(
    corpusFiles,
    [],
    'le corpus opérationnel ne doit pas être versionné',
  );
  assert.match(ignoredPaths, /^\/corpus\/$/m);
  assert.match(seed, /strictement fictif/i);
  assert.match(seed, /Agent Démo Alpha/);
  assert.doesNotMatch(seed, /DOC-/);
  assert.doesNotMatch(migrationSource, /otourre|Olivier Tourre/i);
});

test('le Supabase local permet le parcours TOTP exigé par AAL2', async () => {
  const config = await readFile('supabase/config.toml', 'utf8');
  const authConfig = config.slice(
    config.indexOf('[auth]'),
    config.indexOf('[auth.email]'),
  );
  const emailConfig = config.slice(
    config.indexOf('[auth.email]'),
    config.indexOf('[auth.mfa]'),
  );

  assert.match(authConfig, /enable_signup\s*=\s*false/);
  assert.match(emailConfig, /enable_signup\s*=\s*true/);
  assert.match(config, /\[auth\.mfa\.totp\]/);
  assert.match(config, /\[auth\.mfa\.totp\][\s\S]*?enroll_enabled\s*=\s*true/);
  assert.match(config, /\[auth\.mfa\.totp\][\s\S]*?verify_enabled\s*=\s*true/);
});

test('la migration identité refuse une reprise aux ACL ou owners permissifs', async () => {
  const migration = await readFile(
    'supabase/migrations/202608110043_identity_assurance_and_offboarding.sql',
    'utf8',
  );

  assert.match(migration, /session_user\s*=\s*'supabase_admin'/i);
  assert.match(migration, /current_user\s*<>\s*'postgres'/i);
  assert.match(migration, /actual_default_acl/i);
  assert.match(migration, /expected_default_acl/i);
  assert.match(migration, /except\s+select \* from expected_default_acl/i);
  assert.match(migration, /public_default_acl_difference_count\s*<>\s*0/i);
  assert.match(migration, /non_postgres_owner_count\s*<>\s*0/i);
  assert.match(migration, /Public objects must remain owned by postgres/);
});

test('toutes les migrations sont acceptées par le parseur PostgreSQL', async () => {
  const migrations = await loadMigrations();

  assert.ok(migrations.length >= 4, 'les migrations fondatrices sont absentes');

  for (const migration of migrations) {
    await assert.doesNotReject(
      parse(migration.sql),
      `${migration.path} contient une syntaxe SQL invalide`,
    );
  }
});

test('les invariants de sécurité structurants restent présents', async () => {
  const migrations = await loadMigrations();
  const source = migrations
    .map(({ sql }) => sql)
    .join('\n')
    .toLowerCase();

  assert.match(
    source,
    /alter table public\.audit_events enable row level security/,
  );
  assert.match(source, /audit_events are append-only/);
  assert.match(source, /published or archived schedules are immutable/);
  assert.match(source, /published schedules can only be archived/);
  assert.match(source, /create unique index schedule_versions_one_published/);
  assert.match(source, /planning_shifts_no_agent_overlap/);
  assert.match(source, /drop trigger if exists memberships_same_zone/);
  assert.match(
    source,
    /alter table public\.agent_groups[\s\S]*?alter column site_id drop not null/,
  );
  assert.match(source, /hour_targets_agent_requires_zone/);
  assert.match(source, /agent_groups_global_code/);
  assert.match(source, /port_calls_effective_timing_order/);
  assert.match(source, /port_call_revisions_source_idempotency/);
  assert.match(source, /create table public\.outbox_events/);
  assert.doesNotMatch(source, /grant all on public\.[a-z_]+ to authenticated/);
});

test('les commandes métier critiques restent atomiques et autorisées en base', async () => {
  const migrations = await loadMigrations();
  const source = migrations
    .map(({ sql }) => sql)
    .join('\n')
    .toLowerCase();

  for (const command of [
    'generate_staffing_requirements',
    'update_port_call_timing',
    'create_schedule_version',
    'create_planning_shift',
    'approve_replanning_scenario',
    'publish_schedule_version',
  ]) {
    assert.match(source, new RegExp(`function public\\.${command}`));
    assert.match(
      source,
      new RegExp(`revoke all on function public\\.${command}\\(`),
    );
  }

  assert.match(
    source,
    /function public\.generate_staffing_requirements[\s\S]*?for update/,
  );
  assert.match(
    source,
    /function public\.approve_replanning_scenario[\s\S]*?for update/,
  );
  assert.match(source, /candidate_schedule_version_id = new\.id/);
  assert.match(source, /status = 'applied'/);
  assert.match(source, /insert into public\.agent_notifications/);
  assert.match(
    source,
    /on conflict \(organization_id, idempotency_key\) do nothing/,
  );
});

test('les règles temporelles et de charge sont protégées par PostgreSQL', async () => {
  const migrations = await loadMigrations();
  const source = migrations
    .map(({ sql }) => sql)
    .join('\n')
    .toLowerCase();

  assert.match(source, /agent_contract_versions_no_overlap/);
  assert.match(source, /agent_group_memberships_no_overlap/);
  assert.match(source, /agent_position_restrictions_no_overlap/);
  assert.match(source, /passengers_per_extra_agent/);
  assert.match(source, /vehicles_per_extra_agent/);
  assert.match(source, /port_call\.status <> 'cancelled'/);
  assert.match(source, /demand_profile_line_id is not null/);
  assert.match(source, /arrival_delta_minutes/);
  assert.match(source, /departure_delta_minutes/);
  assert.match(source, /generatedrequirementcount/i);
});

test('les objectifs horaires des groupes alimentent les compteurs', async () => {
  const migrations = await loadMigrations();
  const source = migrations
    .map(({ sql }) => sql)
    .join('\n')
    .toLowerCase();

  assert.match(
    source,
    /alter table public\.agent_groups[\s\S]*?weekly_target_minutes integer/,
  );
  assert.match(source, /monthly_target_minutes integer/);
  assert.match(
    source,
    /weekly_target_minutes := target_group\.weekly_target_minutes/,
  );
  assert.match(
    source,
    /monthly_target_minutes := target_group\.monthly_target_minutes/,
  );
});

test('les escales initialisent et actualisent automatiquement le planning', async () => {
  const migrations = await loadMigrations();
  const source = migrations
    .map(({ sql }) => sql)
    .join('\n')
    .toLowerCase();

  assert.match(
    source,
    /function public\.ensure_planning_workspace_for_port_call/,
  );
  assert.match(source, /trigger port_calls_sync_planning/);
  assert.match(source, /trigger call_load_forecasts_sync_planning/);
  assert.match(source, /planning automatique/);
  assert.match(source, /generate_staffing_requirements\(target_period\.id\)/);
});

test('l’ancien orchestrateur manuel de planning est supprimé', async () => {
  const migrations = await loadMigrations();
  const cleanup = migrations.find(({ path }) =>
    path.endsWith('202607220027_remove_parallel_planning_workspace.sql'),
  )?.sql;

  assert.ok(cleanup);
  assert.match(cleanup, /drop function public\.start_planning_workspace/);
  assert.match(cleanup, /from authenticated/);
  assert.match(
    cleanup,
    /revoke execute on function public\.create_schedule_version/,
  );
  assert.match(
    cleanup,
    /revoke execute on function public\.generate_staffing_requirements/,
  );
  assert.match(
    cleanup,
    /revoke execute on function public\.ensure_planning_workspace_for_port_call/,
  );
});

test('les règles fondamentales de repos sont imposées à chaque planning', async () => {
  const migrations = await loadMigrations();
  const sql = migrations.find(({ path }) =>
    path.endsWith('202607200023_fundamental_planning_rules.sql'),
  )?.sql;

  assert.ok(sql);
  assert.match(sql, /interval '11 hours'/);
  assert.match(sql, /time '06:00'/);
  assert.match(sql, /time '12:00'/);
  assert.match(sql, /first_day\.work_date \+ 6/);
  assert.match(sql, /planning_shifts_enforce_fundamental_rules/);
  assert.match(sql, /schedule_versions_validate_fundamental_rules/);
  assert.match(sql, /version\.status = 'published'/);
});

test('un mois complet d’escales alimente les plannings hebdomadaires', async () => {
  const migrations = await loadMigrations();
  const sql = migrations.find(({ path }) =>
    path.endsWith('202607200024_generated_month_planning.sql'),
  )?.sql;

  assert.ok(sql);
  assert.match(sql, /date '2026-07-27'/);
  assert.match(sql, /date '2026-08-19'/);
  assert.match(sql, /generate_series/);
  assert.match(sql, /'AM'::text as slot_code/);
  assert.match(sql, /'PM'::text as slot_code/);
  assert.match(sql, /demo-month-generator/);
  assert.match(sql, /generated_call_count <> 34/);
  assert.match(sql, /generated_week_count <> 4/);
  assert.match(sql, /status = excluded\.status/);
});

test('les affectations peuvent être déplacées atomiquement entre les cases', async () => {
  const migrations = await loadMigrations();
  const sql = migrations.find(({ path }) =>
    path.endsWith('202607200025_drag_drop_planning_assignments.sql'),
  )?.sql;

  assert.ok(sql);
  assert.match(sql, /function public\.move_planning_assignment/);
  assert.match(sql, /target_schedule\.status <> 'draft'/);
  assert.match(sql, /agent_unavailability/);
  assert.match(sql, /agent_position_restrictions/);
  assert.match(sql, /position_skill_requirements/);
  assert.match(sql, /update public\.planning_shifts/);
  assert.match(sql, /update public\.shift_assignments/);
  assert.match(sql, /planning\.assignment\.moved/);
  assert.match(
    sql,
    /grant execute on function public\.move_planning_assignment/,
  );
});

test('toute une affectation peut être modifiée ou supprimée atomiquement', async () => {
  const migrations = await loadMigrations();
  const sql = migrations.find(({ path }) =>
    path.endsWith('202607220026_full_manual_planning_editor.sql'),
  )?.sql;

  assert.ok(sql);
  assert.match(sql, /function public\.update_planning_assignment/);
  assert.match(sql, /function public\.delete_planning_assignment/);
  assert.match(sql, /target_schedule\.status <> 'draft'/);
  assert.match(sql, /agent_unavailability/);
  assert.match(sql, /agent_position_restrictions/);
  assert.match(sql, /position_skill_requirements/);
  assert.match(sql, /origin = 'manual'/);
  assert.match(sql, /planning\.assignment\.updated/);
  assert.match(sql, /planning\.assignment\.deleted/);
  assert.match(sql, /'before', jsonb_build_object/);
  assert.match(sql, /'after', jsonb_build_object/);
  assert.match(
    sql,
    /grant execute on function public\.update_planning_assignment/,
  );
  assert.match(
    sql,
    /grant execute on function public\.delete_planning_assignment/,
  );
});

test('chaque semaine publiée conserve automatiquement un brouillon éditable', async () => {
  const migrations = await loadMigrations();
  const sql = migrations.find(({ path }) =>
    path.endsWith('202607200026_automatic_editable_schedule.sql'),
  )?.sql;

  assert.ok(sql);
  assert.match(sql, /function public\.ensure_editable_schedule_for_period/);
  assert.match(sql, /schedule\.status = 'draft'/);
  assert.match(sql, /source_shift_id/);
  assert.match(sql, /port_calls_zz_ensure_editable_schedule/);
  assert.match(sql, /schedule_versions_create_followup_draft/);
  assert.match(sql, /copie de travail automatique du planning publié/i);
});

test('un approbateur peut publier et déclencher le brouillon de suivi', async () => {
  const migrations = await loadMigrations();
  const sql = migrations.find(({ path }) =>
    path.endsWith('202607240028_allow_approver_followup_draft.sql'),
  )?.sql;

  assert.ok(sql);
  assert.match(sql, /function public\.ensure_editable_schedule_for_period/);
  assert.match(sql, /'platform_admin',\s*'planning_admin',\s*'planner'/);
  assert.match(sql, /pg_trigger_depth\(\) > 0/);
  assert.match(sql, /array\['approver'\]::public\.app_role\[\]/);
  assert.match(sql, /source_shift_id/);
  assert.match(
    sql,
    /grant execute on function public\.ensure_editable_schedule_for_period/,
  );
});

test('le correctif P0 ferme les accès par défaut et suspend réellement les comptes', async () => {
  const migrations = await loadMigrations();
  const sql = migrations.find(({ path }) =>
    path.endsWith('202608110030_p0_security_hardening.sql'),
  )?.sql;

  assert.ok(sql);

  for (const table of [
    'skills',
    'agent_skills',
    'agent_position_restrictions',
  ]) {
    assert.match(
      sql,
      new RegExp(`alter table public\\.${table} enable row level security`),
    );
    assert.match(
      sql,
      new RegExp(`alter table public\\.${table} force row level security`),
    );
  }

  assert.match(sql, /function public\.is_current_app_user_active\(\)/);
  assert.match(sql, /as restrictive for all to authenticated/);
  assert.match(
    sql,
    /revoke all privileges on table %I\.%I from public, anon, authenticated/,
  );
  assert.match(
    sql,
    /revoke all privileges on function %s from public, anon, authenticated/,
  );
  assert.match(
    sql,
    /grant update \(email, display_name\) on table public\.app_users to authenticated/,
  );
  assert.doesNotMatch(sql, /grant (?:delete|truncate|trigger|references)/i);
  assert.match(
    sql,
    /current_setting\('app\.environment', true\) = 'development'/,
  );
  assert.match(
    sql,
    /current_setting\('app\.allow_legacy_demo_account', true\) = 'true'/,
  );
  assert.match(sql, /set status = 'disabled'/);
  assert.match(sql, /set banned_until = timestamptz/);
  assert.doesNotMatch(sql, /encrypted_password|crypt\s*\(/i);
});

test('les scénarios de démonstration restent identifiables et complets', async () => {
  const migrations = await loadMigrations();
  const demoMigration = migrations.find(({ path }) =>
    path.endsWith('202607190019_demo_operational_scenarios.sql'),
  )?.sql;
  const source = migrations
    .map(({ sql }) => sql)
    .join('\n')
    .toLowerCase();

  for (const marker of [
    'demo-rot-0720',
    'demo-update-advance-0721',
    'demo-update-delay-0722',
    'demo-update-departure-only-0723',
    'demo-update-cancel-0725',
    'demo-equipe-mixte',
  ]) {
    assert.match(source, new RegExp(marker));
  }

  assert.ok(demoMigration);
  assert.match(demoMigration, /current_setting\('app\.load_demo_data', true\)/);
  assert.match(demoMigration, /<> 'true'[\s\S]*?return/);
  assert.doesNotMatch(demoMigration, /encrypted_password|crypt\(/i);
});

test('un planning incomplet ne peut pas être publié', async () => {
  const migrations = await loadMigrations();
  const sql = migrations.find(({ path }) =>
    path.endsWith('202607190020_schedule_publication_readiness.sql'),
  )?.sql;

  assert.ok(sql);
  assert.match(sql, /cannot be published without shifts/);
  assert.match(
    sql,
    /Every shift must contain at least one position assignment/,
  );
  assert.match(sql, /assignments for cancelled port calls/);
});

test('la flotte Corsica Linea active est synchronisée', async () => {
  const migrations = await loadMigrations();
  const source = migrations
    .map(({ sql }) => sql)
    .join('\n')
    .toLowerCase();

  for (const vessel of [
    'a galeotta',
    'capu di muru',
    'capu rossu',
    'danielle casanova',
    'jean nicoli',
    'méditerranée',
    'paglia orba',
    'pascal paoli',
    'vizzavona',
  ]) {
    assert.match(source, new RegExp(vessel));
  }
});

test('la clé privilégiée reste confinée au processus worker sans HTTP', async () => {
  let browserSource = '';

  for await (const path of glob('apps/web/src/**/*.{ts,tsx,js,jsx}')) {
    if (path.endsWith('/supabase/publishable-key.ts')) continue;
    browserSource += await readFile(path, 'utf8');
  }

  assert.doesNotMatch(
    browserSource,
    /SUPABASE_SECRET_KEY|service_role|sb_secret_/i,
  );

  const publicKeyValidator = await readFile(
    'apps/web/src/lib/supabase/publishable-key.ts',
    'utf8',
  );
  assert.match(publicKeyValidator, /startsWith\('sb_secret_'\)/);
  assert.match(publicKeyValidator, /=== 'service_role'/);
  assert.doesNotMatch(
    publicKeyValidator,
    /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/,
  );

  let httpApiSource = '';

  for await (const path of glob('apps/api/src/**/*.{ts,tsx,js,jsx}')) {
    if (
      path.includes('/outbox-worker/') ||
      path.endsWith('/worker.ts') ||
      path.endsWith('/worker-health.ts')
    ) {
      continue;
    }

    httpApiSource += await readFile(path, 'utf8');
  }

  assert.doesNotMatch(
    httpApiSource,
    /SUPABASE_SERVICE_ROLE_KEY|OutboxWorkerModule|OutboxSupabaseService/,
  );

  const apiEnvironmentExample = await readFile('apps/api/.env.example', 'utf8');
  const workerEnvironmentExample = await readFile(
    'apps/api/worker.env.example',
    'utf8',
  );

  assert.doesNotMatch(apiEnvironmentExample, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(workerEnvironmentExample, /SUPABASE_SERVICE_ROLE_KEY/);

  let workerSource = '';

  for await (const path of glob('apps/api/src/outbox-worker/**/*.ts')) {
    workerSource += await readFile(path, 'utf8');
  }

  const workerEntrypoint = await readFile('apps/api/src/worker.ts', 'utf8');
  const workerHealth = await readFile('apps/api/src/worker-health.ts', 'utf8');

  assert.match(workerSource, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(workerSource, /createClient<Database>\(url, serviceRoleKey/);
  assert.match(workerEntrypoint, /createApplicationContext/);
  assert.doesNotMatch(workerEntrypoint, /\.listen\s*\(/);
  assert.match(workerSource, /corsica-outbox-worker\.heartbeat/);
  assert.match(workerHealth, /OUTBOX_HEALTH_MAX_AGE_MS/);
  assert.doesNotMatch(
    `${workerSource}\n${workerEntrypoint}`,
    /(?:console|logger)\.[a-z]+\([^\n]*(?:serviceRoleKey|SERVICE_ROLE_KEY)/i,
  );
});

test('l’outbox est réclamée atomiquement, retentée et mise en file d’échec', async () => {
  const migrations = await loadMigrations();
  const sql = migrations.find(({ path }) =>
    path.endsWith('202608110033_reliable_outbox.sql'),
  )?.sql;

  assert.ok(sql);
  assert.match(sql, /for update skip locked/);
  assert.match(sql, /lease_token = extensions\.gen_random_uuid\(\)/);
  assert.match(sql, /attempt_count = event\.attempt_count \+ 1/);
  assert.match(sql, /power\(/);
  assert.match(sql, /3600::numeric/);
  assert.match(sql, /create table public\.outbox_dead_letters/);
  assert.match(sql, /on conflict \(event_id\) do update/);
  assert.match(sql, /function public\.materialize_outbox_event/);
  assert.match(sql, /errcode = 'P3301'/);
  assert.match(sql, /Unsupported outbox topic/);
  assert.match(
    sql,
    /on conflict \(organization_id, idempotency_key\) do nothing/,
  );
  assert.match(sql, /function public\.get_my_notifications/);
  assert.match(sql, /function public\.acknowledge_my_notification/);
  assert.match(
    sql,
    /revoke all on function public\.claim_outbox_events[\s\S]*?authenticated/,
  );
});

test('le cycle RH remplace les périodes atomiquement et protège le groupe principal', async () => {
  const migrations = await loadMigrations();
  const sql = migrations.find(({ path }) =>
    path.endsWith('202608110032_workforce_lifecycle.sql'),
  )?.sql;

  assert.ok(sql);
  for (const command of [
    'replace_agent_contract',
    'replace_agent_skill',
    'replace_agent_position_preference',
    'replace_agent_position_restriction',
    'replace_agent_group_membership',
    'create_agent_unavailability',
    'end_agent_unavailability',
  ]) {
    assert.match(sql, new RegExp(`function public\\.${command}`));
  }

  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /agent_group_memberships_one_primary_per_period/);
  assert.match(sql, /set effective_until = new_effective_from - 1/);
  assert.match(sql, /set valid_until = new_valid_from - 1/);
  assert.match(sql, /force row level security/);
  assert.match(sql, /grant select on table public\.agent_unavailability/);
  assert.doesNotMatch(
    sql,
    /grant (?:insert|update|delete) on table public\.agent_unavailability/i,
  );
});

test('le déploiement isole strictement le secret du worker', async () => {
  const compose = await readFile('docker-compose.coolify.yml', 'utf8');
  const apiEntrypoint = await readFile('apps/api/src/main.ts', 'utf8');
  const runbook = await readFile('docs/EXPLOITATION.md', 'utf8');
  const apiBlock = compose.match(/  api:\n([\s\S]*?)\n  worker:/)?.[1] ?? '';
  const workerBlock = compose.match(/  worker:\n([\s\S]*?)\n  web:/)?.[1] ?? '';
  const webBlock = compose.match(/  web:\n([\s\S]*?)\nnetworks:/)?.[1] ?? '';

  assert.ok(apiBlock, 'service API absent de la composition');
  assert.ok(workerBlock, 'service worker absent de la composition');
  assert.ok(webBlock, 'service web absent de la composition');
  assert.match(apiBlock, /SUPABASE_SERVICE_ROLE_KEY: ""/);
  assert.match(webBlock, /SUPABASE_SERVICE_ROLE_KEY: ""/);
  assert.match(
    workerBlock,
    /SUPABASE_SERVICE_ROLE_KEY: \$\{SUPABASE_SERVICE_ROLE_KEY:-\}/,
  );
  assert.match(apiBlock, /SUPABASE_AUTH_RATE_LIMIT_SECRET: ""/);
  assert.match(workerBlock, /SUPABASE_AUTH_RATE_LIMIT_SECRET: ""/);
  assert.match(workerBlock, /dist\/worker\.js/);
  assert.match(workerBlock, /dist\/worker-health\.js/);
  assert.doesNotMatch(workerBlock, /ports:|SERVICE_FQDN/);
  assert.match(apiBlock, /networks:\n\s+- default\n\s+- supabase-backplane/);
  assert.doesNotMatch(apiBlock, /^\s+- coolify$/m);
  assert.match(workerBlock, /networks:\n\s+- supabase-backplane/);
  assert.doesNotMatch(workerBlock, /^\s+- (?:default|coolify)$/m);
  assert.match(
    webBlock,
    /networks:\n\s+- default\n\s+- coolify[\s\S]*?\n\s+- auth-backplane/,
  );
  assert.doesNotMatch(webBlock, /^\s+- supabase-backplane$/m);
  assert.match(workerBlock, /stop_grace_period: 60s/);
  assert.match(
    compose,
    /supabase-backplane:\n\s+name: \$\{SUPABASE_API_NETWORK:\?[^}]+\}\n\s+external: true/,
  );
  assert.match(apiEntrypoint, /trustProxy: false/);
  assert.doesNotMatch(apiEntrypoint, /trustProxy: true/);
  assert.match(runbook, /SUPABASE_INTERNAL_URL=http:\/\/supabase-kong:8000/);
  assert.match(
    runbook,
    /exactement\s+trois endpoints : Kong, l’API et le worker/,
  );
  assert.match(runbook, /réclamation en échec n’actualise jamais ce heartbeat/);
});

test('le moteur 031 fige les besoins et coordonne les imprévus inter-semaines', async () => {
  const migrations = await loadMigrations();
  const sql = migrations.find(({ path }) =>
    path.endsWith('202608110031_engine_resilience.sql'),
  )?.sql;

  assert.ok(sql);
  assert.match(sql, /freight_units_per_extra_agent/);
  assert.match(sql, /coaches_per_extra_agent/);
  assert.match(sql, /coalesce\(load\.freight_unit_count, 0\)/);
  assert.match(sql, /coalesce\(load\.coach_count, 0\)/);
  assert.match(
    sql,
    /create table public\.schedule_requirement_snapshot_manifests/,
  );
  assert.match(sql, /create table public\.schedule_requirement_snapshots/);
  assert.match(sql, /Published requirement snapshots are immutable/);
  assert.match(sql, /'migration_backfill'/);
  assert.match(
    sql,
    /capture_schedule_requirement_snapshot\(new\.id, 'publication'\)/,
  );
  assert.match(sql, /function public\.get_schedule_requirements/);
  assert.match(sql, /requirement\.retired_at is null/);
  assert.match(
    sql,
    /anchor\.anchor_at[\s\S]*?between target_period\.starts_on and target_period\.ends_on/,
  );
  assert.match(sql, /with effective_versions as/);
  assert.match(
    sql,
    /schedule\.status = 'published'[\s\S]*?scheduled_month_minutes/,
  );
  assert.match(sql, /function public\.shift_is_within_planning_period/);
  assert.match(sql, /period\.ends_on \+ 1/);
  assert.match(sql, /create table public\.port_call_source_cursors/);
  assert.match(
    sql,
    /source_sequence = coalesce\([\s\S]*?source_revision ~ '\^\[0-9\]\{1,18\}\$'/,
  );
  assert.match(sql, /Lower-priority maritime source rejected/);
  assert.match(sql, /Stale maritime sequence rejected/);
  assert.match(sql, /Port call changed concurrently/);
  assert.match(sql, /timing_lock_version/);
  assert.match(sql, /maritime_timing_payload_fingerprint/);
  assert.match(sql, /collision with a different payload/);
  assert.match(sql, /ensure_planning_workspace_for_anchor/);
  assert.match(sql, /previous_period_ids \|\| current_period_ids/);
  assert.match(sql, /function public\.override_port_call_timing/);
  assert.match(sql, /interval '24 hours'/);
  assert.match(sql, /resumableByHigherPrioritySource/i);
  assert.match(sql, /function public\.build_replanning_candidate/);
  assert.match(sql, /function public\.publish_replanning_change_set/);
  assert.match(sql, /function public\.validate_replanning_change_set/);
  assert.match(sql, /replanning_change_set_effective_shifts/);
  assert.match(sql, /order by agent\.id[\s\S]*?for update/);
  assert.match(sql, /candidate_lock_version/);
  assert.match(sql, /source-period|source candidate|source\/destination/i);
  assert.match(
    sql,
    /Every change-set candidate must remain current and editable/,
  );
  assert.match(
    sql,
    /Requested schedule version does not cover the requested week/,
  );
  assert.match(sql, /daily_calendar_proration/);
  assert.match(sql, /interval_overlap_break_prorata/);
  assert.match(sql, /assignment\.staffing_requirement_id = requirement\.id/);
  assert.match(
    sql,
    /revoke update on table public\.port_calls from authenticated/,
  );
  assert.match(sql, /grant update \(demand_profile_id\)/);
  assert.doesNotMatch(
    sql,
    /grant (?:insert|update|delete) on table public\.schedule_requirement_snapshots\s+to authenticated/i,
  );

  const behavioralTest = await readFile(
    'supabase/tests/202608110031_engine_resilience.test.sql',
    'utf8',
  );
  assert.match(behavioralTest, /select plan\(69\)/);
  assert.match(behavioralTest, /Sunday-night shift/);
  assert.match(behavioralTest, /older unseen replay/);
  assert.match(behavioralTest, /complete cross-period change-set/);
  assert.match(
    behavioralTest,
    /atomically publishes the whole reviewed change-set/,
  );
  assert.match(behavioralTest, /complete change-set/);
  assert.match(behavioralTest, /Sunday\/Monday cross-candidate violation/);
  assert.match(behavioralTest, /arrival Sunday and departure Monday/);
  assert.match(behavioralTest, /effective calendar days/);
  assert.match(behavioralTest, /unlinked assignment cannot satisfy multiple/);
});

test('les exports chargent un snapshot borné sans limite globale silencieuse', async () => {
  const migrations = await loadMigrations();
  const sql = migrations.find(({ path }) =>
    path.endsWith('202608110039_export_read_models.sql'),
  )?.sql;
  const service = await readFile(
    'apps/api/src/planning/planning.service.ts',
    'utf8',
  );

  assert.ok(sql);
  assert.match(sql, /security invoker/i);
  assert.match(sql, /cardinality\(target_port_call_ids\) > 500/);
  assert.match(sql, /distinct on \(forecast\.port_call_id\)/);
  assert.match(
    sql,
    /revoke all on function public\.get_latest_call_load_forecasts/,
  );
  assert.match(service, /rpc\('get_latest_call_load_forecasts'/);
  assert.match(service, /offset \+= 500/);
  assert.doesNotMatch(
    service,
    /call_load_forecasts'[\s\S]{0,250}limit\(1000\)/,
  );
});
