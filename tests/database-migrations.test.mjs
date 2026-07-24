import assert from 'node:assert/strict';
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

test('les scénarios de démonstration restent identifiables et complets', async () => {
  const migrations = await loadMigrations();
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

test('aucun runtime métier ne référence un secret Supabase privilégié', async () => {
  let runtimeSource = '';

  for await (const path of glob('apps/{api,web}/src/**/*.{ts,tsx,js,jsx}')) {
    runtimeSource += await readFile(path, 'utf8');
  }

  assert.doesNotMatch(
    runtimeSource,
    /SUPABASE_SECRET_KEY|service_role|sb_secret_/i,
  );
});
