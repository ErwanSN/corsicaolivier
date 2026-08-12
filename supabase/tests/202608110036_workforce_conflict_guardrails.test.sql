begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_temp;

select plan(37);

select ok(
  has_function_privilege(
    'authenticated',
    'public.create_agent_record(uuid,uuid,text,text,uuid,boolean,date)',
    'EXECUTE'
  ),
  'authenticated managers use the scoped agent creation command'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.update_agent_record(uuid,uuid,jsonb)',
    'EXECUTE'
  ),
  'authenticated managers use the scoped agent update command'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.set_hour_target_override(uuid,uuid,uuid,uuid,date,integer,text)',
    'EXECUTE'
  ),
  'authenticated managers use the scoped hour-target command'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.update_agent_record(uuid,uuid,jsonb)',
    'EXECUTE'
  ),
  'anonymous callers cannot update an agent'
);
select ok(
  not has_table_privilege('authenticated', 'public.agents', 'INSERT')
    and not has_table_privilege('authenticated', 'public.agents', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.agents', 'DELETE'),
  'direct agent DML is closed'
);
select ok(
  not has_table_privilege(
    'authenticated', 'public.hour_target_overrides', 'INSERT'
  )
    and not has_table_privilege(
      'authenticated', 'public.hour_target_overrides', 'UPDATE'
    )
    and not has_table_privilege(
      'authenticated', 'public.hour_target_overrides', 'DELETE'
    ),
  'direct hour-target DML is closed'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.recompute_planning_workforce_conflicts(uuid)',
    'EXECUTE'
  ),
  'the internal reconciliation function is not exposed'
);
select ok(
  (
    select relation.relrowsecurity and relation.relforcerowsecurity
    from pg_catalog.pg_class relation
    where relation.oid = 'public.planning_workforce_conflicts'::regclass
  ),
  'workforce conflicts enforce row-level security even for their owner'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.get_planning_workforce_conflicts(uuid,date,date,boolean,integer)',
    'EXECUTE'
  ),
  'the bounded conflict read model is exposed'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.prepare_workforce_conflict_draft(uuid)',
    'EXECUTE'
  ) and has_function_privilege(
    'authenticated',
    'public.resolve_planning_workforce_conflict(uuid,text)',
    'EXECUTE'
  ),
  'conflict preparation and resolution commands are exposed'
);
select is(
  (
    select constraint_type
    from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'planning_shifts'
      and constraint_name = 'planning_shifts_schedule_version_id_fkey'
  ),
  'FOREIGN KEY',
  'the schedule-to-shift relationship remains an explicit foreign key'
);
select is(
  (
    select string_agg(fk_constraint.confdeltype::text, '' order by fk_constraint.conname)
    from pg_catalog.pg_constraint fk_constraint
    where fk_constraint.conname in (
        'planning_shifts_schedule_version_id_fkey',
        'shifts_schedule_same_organization'
      )
      and fk_constraint.conrelid = 'public.planning_shifts'::regclass
  ),
  'rr',
  'every FK path restricts schedule deletion instead of cascading shifts'
);

insert into auth.users (
  id,
  aud,
  role,
  email,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) values (
  '36000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'workforce-conflicts@example.invalid',
  '{}'::jsonb,
  '{"full_name":"Workforce conflict manager"}'::jsonb,
  now(),
  now()
);

insert into public.organizations (id, slug, name)
values (
  '36000000-0000-4000-8000-000000000002',
  'workforce-conflict-tests',
  'Workforce conflict tests'
);

insert into public.sites (id, organization_id, code, name, timezone)
values
  (
    '36000000-0000-4000-8000-000000000003',
    '36000000-0000-4000-8000-000000000002',
    'WFC-A',
    'Workforce conflict site A',
    'Europe/Paris'
  ),
  (
    '36000000-0000-4000-8000-000000000013',
    '36000000-0000-4000-8000-000000000002',
    'WFC-B',
    'Workforce conflict site B',
    'Europe/Paris'
  );

insert into public.user_role_assignments (
  user_id,
  organization_id,
  site_id,
  role
) values
  (
    '36000000-0000-4000-8000-000000000001',
    '36000000-0000-4000-8000-000000000002',
    '36000000-0000-4000-8000-000000000003',
    'planning_admin'
  ),
  (
    '36000000-0000-4000-8000-000000000001',
    '36000000-0000-4000-8000-000000000002',
    '36000000-0000-4000-8000-000000000013',
    'planning_admin'
  );

select set_config(
  'request.jwt.claim.sub',
  '36000000-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.aal', 'aal2', true);
select set_config('request.jwt.claim.is_anonymous', 'false', true);

select lives_ok(
  $$select public.create_agent_record(
    '36000000-0000-4000-8000-000000000002',
    '36000000-0000-4000-8000-000000000003',
    'Agent créé par commande',
    null,
    null,
    true,
    date '2047-01-01'
  )$$,
  'the agent creation command derives a default employee number'
);
select matches(
  (
    select agent.employee_number
    from public.agents agent
    where agent.display_name = 'Agent créé par commande'
  ),
  '^AG-[A-F0-9]{12}$',
  'the generated employee number is database-owned and valid'
);

insert into public.agents (
  id,
  organization_id,
  primary_site_id,
  employee_number,
  display_name,
  active,
  hired_on
) values (
  '36000000-0000-4000-8000-000000000004',
  '36000000-0000-4000-8000-000000000002',
  '36000000-0000-4000-8000-000000000003',
  'WFC-AGENT',
  'Agent à planifier',
  true,
  date '2047-01-01'
);

select lives_ok(
  $$select public.set_hour_target_override(
    '36000000-0000-4000-8000-000000000002',
    '36000000-0000-4000-8000-000000000003',
    '36000000-0000-4000-8000-000000000004',
    null,
    date '2048-01-06',
    1800,
    'Semaine de formation partielle'
  )$$,
  'an individual target is written through its scoped command'
);
select is(
  (
    select target.created_by
    from public.hour_target_overrides target
    where target.agent_id = '36000000-0000-4000-8000-000000000004'
      and target.week_start = date '2048-01-06'
  ),
  '36000000-0000-4000-8000-000000000001'::uuid,
  'the hour-target author always comes from auth.uid()'
);

insert into public.skills (id, organization_id, code, name)
values (
  '36000000-0000-4000-8000-000000000005',
  '36000000-0000-4000-8000-000000000002',
  'WFC-SKILL',
  'Workforce conflict skill'
);

insert into public.positions (id, organization_id, site_id, code, name)
values (
  '36000000-0000-4000-8000-000000000006',
  '36000000-0000-4000-8000-000000000002',
  '36000000-0000-4000-8000-000000000003',
  'WFC-POS',
  'Workforce conflict position'
);

insert into public.position_skill_requirements (
  organization_id,
  position_id,
  skill_id,
  minimum_level,
  mandatory
) values (
  '36000000-0000-4000-8000-000000000002',
  '36000000-0000-4000-8000-000000000006',
  '36000000-0000-4000-8000-000000000005',
  3,
  true
);

select public.replace_agent_contract(
  '36000000-0000-4000-8000-000000000004',
  '36000000-0000-4000-8000-000000000002',
  date '2047-01-01',
  2100
);
select public.replace_agent_skill(
  '36000000-0000-4000-8000-000000000004',
  '36000000-0000-4000-8000-000000000002',
  '36000000-0000-4000-8000-000000000005',
  3,
  date '2047-01-01'
);

insert into public.planning_periods (
  id,
  organization_id,
  site_id,
  name,
  starts_on,
  ends_on,
  timezone
) values (
  '36000000-0000-4000-8000-000000000007',
  '36000000-0000-4000-8000-000000000002',
  '36000000-0000-4000-8000-000000000003',
  'Future workforce week',
  date '2048-01-06',
  date '2048-01-12',
  'Europe/Paris'
);

insert into public.schedule_versions (
  id,
  organization_id,
  site_id,
  planning_period_id,
  version_number,
  status,
  label,
  created_by
) values (
  '36000000-0000-4000-8000-000000000008',
  '36000000-0000-4000-8000-000000000002',
  '36000000-0000-4000-8000-000000000003',
  '36000000-0000-4000-8000-000000000007',
  1,
  'draft',
  'Future workforce draft',
  '36000000-0000-4000-8000-000000000001'
);

insert into public.planning_shifts (
  id,
  organization_id,
  site_id,
  schedule_version_id,
  agent_id,
  starts_at,
  ends_at,
  break_minutes,
  created_by
) values (
  '36000000-0000-4000-8000-000000000009',
  '36000000-0000-4000-8000-000000000002',
  '36000000-0000-4000-8000-000000000003',
  '36000000-0000-4000-8000-000000000008',
  '36000000-0000-4000-8000-000000000004',
  timestamptz '2048-01-07 07:00:00+00',
  timestamptz '2048-01-07 15:00:00+00',
  0,
  '36000000-0000-4000-8000-000000000001'
);

insert into public.shift_assignments (
  id,
  organization_id,
  site_id,
  planning_shift_id,
  position_id,
  starts_at,
  ends_at
) values (
  '36000000-0000-4000-8000-000000000010',
  '36000000-0000-4000-8000-000000000002',
  '36000000-0000-4000-8000-000000000003',
  '36000000-0000-4000-8000-000000000009',
  '36000000-0000-4000-8000-000000000006',
  timestamptz '2048-01-07 07:00:00+00',
  timestamptz '2048-01-07 15:00:00+00'
);

select lives_ok(
  $$select public.publish_schedule_version(
    '36000000-0000-4000-8000-000000000008',
    'Publication initiale valide',
    (
      select schedule.lock_version
      from public.schedule_versions schedule
      where schedule.id = '36000000-0000-4000-8000-000000000008'
    )
  )$$,
  'a valid future schedule is published before HR changes'
);

set constraints all immediate;

select is(
  (
    select count(*)::integer
    from public.planning_workforce_conflicts conflict
    where conflict.agent_id = '36000000-0000-4000-8000-000000000004'
  ),
  0,
  'the initial compatible published schedule has no conflict'
);

set constraints all deferred;

select public.replace_agent_contract(
  '36000000-0000-4000-8000-000000000004',
  '36000000-0000-4000-8000-000000000002',
  date '2048-01-01',
  2100
);
select public.replace_agent_skill(
  '36000000-0000-4000-8000-000000000004',
  '36000000-0000-4000-8000-000000000002',
  '36000000-0000-4000-8000-000000000005',
  3,
  date '2048-01-01'
);

set constraints all immediate;

select is(
  (
    select count(*)::integer
    from public.planning_workforce_conflicts conflict
    where conflict.agent_id = '36000000-0000-4000-8000-000000000004'
  ),
  0,
  'atomic contract and skill replacements never expose a transient conflict'
);

select lives_ok(
  $$select public.create_agent_unavailability(
    '36000000-0000-4000-8000-000000000004',
    '36000000-0000-4000-8000-000000000002',
    '36000000-0000-4000-8000-000000000003',
    'leave',
    timestamptz '2048-01-07 05:00:00+00',
    timestamptz '2048-01-07 10:00:00+00',
    'Congé validé après publication'
  )$$,
  'an overlapping absence is accepted as a HR fact'
);

select is(
  (
    select count(*)::integer
    from public.planning_workforce_conflicts conflict
    where conflict.agent_id = '36000000-0000-4000-8000-000000000004'
      and conflict.conflict_kind = 'unavailability'
      and conflict.status = 'open'
  ),
  1,
  'the absence opens one idempotent published-planning conflict'
);
select is(
  (
    select count(*)::integer
    from public.outbox_events event
    where event.topic = 'planning.workforce.conflict'
      and event.payload ->> 'agentId' =
        '36000000-0000-4000-8000-000000000004'
  ),
  1,
  'the first conflict emits one reliable outbox event'
);

select public.end_agent_unavailability(
  (
    select unavailable.id
    from public.agent_unavailability unavailable
    where unavailable.agent_id = '36000000-0000-4000-8000-000000000004'
  ),
  '36000000-0000-4000-8000-000000000004',
  timestamptz '2048-01-07 06:00:00+00'
);

select is(
  (
    select conflict.status
    from public.planning_workforce_conflicts conflict
    where conflict.agent_id = '36000000-0000-4000-8000-000000000004'
      and conflict.conflict_kind = 'unavailability'
  ),
  'resolved',
  'the conflict closes automatically when the absence no longer overlaps'
);
select lives_ok(
  $$select public.resolve_planning_workforce_conflict(
    (
      select conflict.id
      from public.planning_workforce_conflicts conflict
      where conflict.agent_id = '36000000-0000-4000-8000-000000000004'
        and conflict.conflict_kind = 'unavailability'
    ),
    'Vérification après correction du congé'
  )$$,
  'the resolution API confirms an incompatibility that has really disappeared'
);
select is(
  (
    select conflict.resolved_by
    from public.planning_workforce_conflicts conflict
    where conflict.agent_id = '36000000-0000-4000-8000-000000000004'
      and conflict.conflict_kind = 'unavailability'
  ),
  '36000000-0000-4000-8000-000000000001'::uuid,
  'manual confirmation records its authenticated operator'
);

select public.replace_agent_position_restriction(
  '36000000-0000-4000-8000-000000000004',
  '36000000-0000-4000-8000-000000000002',
  '36000000-0000-4000-8000-000000000006',
  'Restriction médicale temporaire',
  date '2048-01-01'
);
select is(
  (
    select count(*)::integer
    from public.planning_workforce_conflicts conflict
    where conflict.agent_id = '36000000-0000-4000-8000-000000000004'
      and conflict.conflict_kind = 'restriction'
      and conflict.status = 'open'
  ),
  1,
  'a position restriction invalidates the future published shift'
);

update public.agent_position_restrictions restriction
set valid_until = date '2048-01-05'
where restriction.agent_id = '36000000-0000-4000-8000-000000000004';

select public.replace_agent_skill(
  '36000000-0000-4000-8000-000000000004',
  '36000000-0000-4000-8000-000000000002',
  '36000000-0000-4000-8000-000000000005',
  1,
  date '2048-01-01'
);
select is(
  (
    select count(*)::integer
    from public.planning_workforce_conflicts conflict
    where conflict.agent_id = '36000000-0000-4000-8000-000000000004'
      and conflict.conflict_kind = 'skill'
      and conflict.status = 'open'
  ),
  1,
  'a lost mandatory skill invalidates the future published shift'
);

select public.replace_agent_skill(
  '36000000-0000-4000-8000-000000000004',
  '36000000-0000-4000-8000-000000000002',
  '36000000-0000-4000-8000-000000000005',
  3,
  date '2048-01-01'
);

select public.update_agent_record(
  '36000000-0000-4000-8000-000000000004',
  '36000000-0000-4000-8000-000000000002',
  '{"active":false,"leftOn":"2048-01-06","offboardingReason":"Test des conflits futurs"}'::jsonb
);
select set_eq(
  $$
    select conflict.conflict_kind
    from public.planning_workforce_conflicts conflict
    where conflict.agent_id = '36000000-0000-4000-8000-000000000004'
      and conflict.status = 'open'
  $$,
  $$values ('inactive'::text), ('employment'::text)$$,
  'inactive and out-of-employment reasons are reported independently'
);

select public.reactivate_agent_record(
  '36000000-0000-4000-8000-000000000004',
  '36000000-0000-4000-8000-000000000002',
  'Retour dans la simulation des conflits futurs'
);
select public.replace_agent_contract(
  '36000000-0000-4000-8000-000000000004',
  '36000000-0000-4000-8000-000000000002',
  date '2048-01-01',
  2100,
  null,
  null,
  1,
  date '2048-01-06'
);
select is(
  (
    select count(*)::integer
    from public.planning_workforce_conflicts conflict
    where conflict.agent_id = '36000000-0000-4000-8000-000000000004'
      and conflict.conflict_kind = 'contract'
      and conflict.status = 'open'
  ),
  1,
  'an uncovered service is reported after a contract boundary changes'
);

select public.replace_agent_contract(
  '36000000-0000-4000-8000-000000000004',
  '36000000-0000-4000-8000-000000000002',
  date '2048-01-01',
  2100
);
select public.update_agent_record(
  '36000000-0000-4000-8000-000000000004',
  '36000000-0000-4000-8000-000000000002',
  '{"primarySiteId":"36000000-0000-4000-8000-000000000013"}'::jsonb
);
select is(
  (
    select count(*)::integer
    from public.planning_workforce_conflicts conflict
    where conflict.agent_id = '36000000-0000-4000-8000-000000000004'
      and conflict.conflict_kind = 'scope'
      and conflict.status = 'open'
  ),
  1,
  'moving an agent out of the published site opens a scope conflict'
);

select public.update_agent_record(
  '36000000-0000-4000-8000-000000000004',
  '36000000-0000-4000-8000-000000000002',
  '{"primarySiteId":"36000000-0000-4000-8000-000000000003"}'::jsonb
);

select is(
  (
    select count(*)::integer
    from public.planning_workforce_conflicts conflict
    where conflict.agent_id = '36000000-0000-4000-8000-000000000004'
      and conflict.status = 'open'
  ),
  0,
  'all conflicts close when the published assignment is compatible again'
);

select throws_ok(
  $$delete from public.schedule_versions schedule
    where schedule.id = '36000000-0000-4000-8000-000000000008'$$,
  '23503',
  null,
  'a published schedule parent cannot cascade-delete its shift'
);
select throws_ok(
  $$delete from public.planning_shifts shift
    where shift.id = '36000000-0000-4000-8000-000000000009'$$,
  'P0001',
  'Published or archived schedules are immutable',
  'a published shift cannot be deleted directly'
);

select throws_ok(
  $$delete from public.schedule_versions schedule
    where schedule.id = (
      select draft.id
      from public.schedule_versions draft
      where draft.planning_period_id =
        '36000000-0000-4000-8000-000000000007'
        and draft.status = 'draft'
        and draft.superseded_at is null
    )$$,
  '23503',
  null,
  'a draft schedule parent cannot cascade-delete its cloned shifts either'
);
select lives_ok(
  $$delete from public.planning_shifts shift
    where shift.schedule_version_id = (
      select draft.id
      from public.schedule_versions draft
      where draft.planning_period_id =
        '36000000-0000-4000-8000-000000000007'
        and draft.status = 'draft'
        and draft.superseded_at is null
    )$$,
  'draft shifts remain explicitly deletable'
);
select lives_ok(
  $$delete from public.schedule_versions schedule
    where schedule.id = (
      select draft.id
      from public.schedule_versions draft
      where draft.planning_period_id =
        '36000000-0000-4000-8000-000000000007'
        and draft.status = 'draft'
        and draft.superseded_at is null
    )$$,
  'a draft parent becomes deletable only after its shifts are explicitly removed'
);

select is(
  (
    select count(*)::integer
    from public.get_planning_workforce_conflicts(
      '36000000-0000-4000-8000-000000000003',
      date '2048-01-06',
      date '2048-01-12',
      true,
      100
    )
  ),
  (
    select count(*)::integer
    from public.planning_workforce_conflicts conflict
    where conflict.site_id = '36000000-0000-4000-8000-000000000003'
  ),
  'the bounded read model returns the week conflicts, including history on request'
);

select * from finish();
rollback;
