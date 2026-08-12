begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_temp;

select plan(28);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.create_planning_shift(uuid,uuid,timestamptz,timestamptz,integer,uuid,uuid,text)',
    'EXECUTE'
  ),
  'the lockless create command is not exposed'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.move_planning_assignment(uuid,uuid,date,uuid)',
    'EXECUTE'
  ),
  'the lockless move command is not exposed'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.update_planning_assignment(uuid,uuid,uuid,uuid,uuid,timestamptz,timestamptz,integer,text)',
    'EXECUTE'
  ),
  'the lockless update command is not exposed'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.delete_planning_assignment(uuid,uuid)',
    'EXECUTE'
  ),
  'the lockless delete command is not exposed'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.publish_schedule_version(uuid,text)',
    'EXECUTE'
  ),
  'the lockless publication command is not exposed'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.update_port_call_timing(uuid,timestamptz,timestamptz,public.port_call_status,text,text)',
    'EXECUTE'
  ),
  'the unordered maritime update command is not exposed'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.create_planning_shift(uuid,uuid,timestamptz,timestamptz,integer,uuid,uuid,text,bigint)',
    'EXECUTE'
  ),
  'the concurrency-checked create command remains exposed'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.update_port_call_timing(uuid,timestamptz,timestamptz,public.port_call_status,text,text,bigint,text,timestamptz)',
    'EXECUTE'
  ),
  'an end user cannot impersonate an ordered maritime feed'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.update_port_call_timing(uuid,timestamptz,timestamptz,public.port_call_status,text,text,bigint,text,timestamptz,bigint)',
    'EXECUTE'
  ),
  'only the trusted service role can call ordered maritime ingestion'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.override_port_call_timing(uuid,timestamptz,timestamptz,public.port_call_status,text,text,text,text,timestamptz)',
    'EXECUTE'
  ),
  'an operator cannot bypass the monotonic timing lock'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.override_port_call_timing(uuid,timestamptz,timestamptz,public.port_call_status,text,text,text,bigint,text,timestamptz)',
    'EXECUTE'
  ),
  'the concurrency-checked operator override remains exposed'
);

select ok(
  not has_table_privilege(
    'authenticated', 'public.agent_contract_versions', 'INSERT'
  ),
  'contracts cannot bypass their replacement command'
);
select ok(
  not has_table_privilege(
    'authenticated', 'public.agent_group_memberships', 'UPDATE'
  ),
  'memberships cannot be rewritten directly'
);
select ok(
  not has_table_privilege(
    'authenticated', 'public.agent_skills', 'INSERT'
  ),
  'skills cannot bypass their replacement command'
);
select ok(
  not has_table_privilege(
    'authenticated', 'public.agent_position_preferences', 'INSERT'
  ),
  'preferences cannot bypass their replacement command'
);
select ok(
  not has_table_privilege(
    'authenticated', 'public.agent_position_restrictions', 'INSERT'
  ),
  'restrictions cannot bypass their replacement command'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.end_agent_group_membership(uuid,uuid,uuid,date)',
    'EXECUTE'
  ),
  'membership closure remains available as a scoped command'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.reject_replanning_scenario(uuid,text)',
    'EXECUTE'
  ),
  'authorized operators can explicitly reject a pending disruption'
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
  '34000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'command-manager@example.invalid',
  '{}'::jsonb,
  '{"full_name":"Command manager"}'::jsonb,
  now(),
  now()
);

insert into public.organizations (id, slug, name)
values (
  '34000000-0000-4000-8000-000000000002',
  'command-surface-tests',
  'Command surface tests'
);

insert into public.sites (id, organization_id, code, name, timezone)
values (
  '34000000-0000-4000-8000-000000000003',
  '34000000-0000-4000-8000-000000000002',
  'CMD',
  'Command site',
  'Europe/Paris'
);

insert into public.user_role_assignments (
  user_id,
  organization_id,
  site_id,
  role
) values (
  '34000000-0000-4000-8000-000000000001',
  '34000000-0000-4000-8000-000000000002',
  '34000000-0000-4000-8000-000000000003',
  'planning_admin'
);

insert into public.agents (
  id,
  organization_id,
  primary_site_id,
  employee_number,
  display_name
) values (
  '34000000-0000-4000-8000-000000000004',
  '34000000-0000-4000-8000-000000000002',
  '34000000-0000-4000-8000-000000000003',
  'CMD-AGENT',
  'Command agent'
);

insert into public.agent_groups (
  id,
  organization_id,
  site_id,
  code,
  name
) values (
  '34000000-0000-4000-8000-000000000005',
  '34000000-0000-4000-8000-000000000002',
  '34000000-0000-4000-8000-000000000003',
  'CMD-GRP',
  'Command group'
);

insert into public.agent_group_memberships (
  id,
  organization_id,
  group_id,
  agent_id,
  effective_from,
  is_primary
) values (
  '34000000-0000-4000-8000-000000000006',
  '34000000-0000-4000-8000-000000000002',
  '34000000-0000-4000-8000-000000000005',
  '34000000-0000-4000-8000-000000000004',
  date '2045-01-01',
  true
);

select set_config(
  'request.jwt.claim.sub',
  '34000000-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.aal', 'aal2', true);
select set_config('request.jwt.claim.is_anonymous', 'false', true);

select lives_ok(
  $$select public.end_agent_group_membership(
    '34000000-0000-4000-8000-000000000005',
    '34000000-0000-4000-8000-000000000006',
    '34000000-0000-4000-8000-000000000002',
    date '2045-01-31'
  )$$,
  'an authorized manager closes a membership through the command'
);
select is(
  (
    select membership.effective_until
    from public.agent_group_memberships membership
    where membership.id = '34000000-0000-4000-8000-000000000006'
  ),
  date '2045-01-31',
  'the membership history records the bounded end date'
);

insert into public.positions (
  id,
  organization_id,
  site_id,
  code,
  name
) values (
  '34000000-0000-4000-8000-000000000007',
  '34000000-0000-4000-8000-000000000002',
  '34000000-0000-4000-8000-000000000003',
  'CMD-POS',
  'Command position'
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
  '34000000-0000-4000-8000-000000000008',
  '34000000-0000-4000-8000-000000000002',
  '34000000-0000-4000-8000-000000000003',
  'Command planning week',
  date '2045-01-02',
  date '2045-01-08',
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
  '34000000-0000-4000-8000-000000000009',
  '34000000-0000-4000-8000-000000000002',
  '34000000-0000-4000-8000-000000000003',
  '34000000-0000-4000-8000-000000000008',
  1,
  'draft',
  'Command draft',
  '34000000-0000-4000-8000-000000000001'
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
  '34000000-0000-4000-8000-000000000010',
  '34000000-0000-4000-8000-000000000002',
  '34000000-0000-4000-8000-000000000003',
  '34000000-0000-4000-8000-000000000009',
  '34000000-0000-4000-8000-000000000004',
  timestamptz '2045-01-03 07:00:00+00',
  timestamptz '2045-01-03 15:00:00+00',
  0,
  '34000000-0000-4000-8000-000000000001'
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
  '34000000-0000-4000-8000-000000000011',
  '34000000-0000-4000-8000-000000000002',
  '34000000-0000-4000-8000-000000000003',
  '34000000-0000-4000-8000-000000000010',
  '34000000-0000-4000-8000-000000000007',
  timestamptz '2045-01-03 07:00:00+00',
  timestamptz '2045-01-03 15:00:00+00'
);

select lives_ok(
  $$select public.delete_planning_assignment(
    '34000000-0000-4000-8000-000000000009',
    '34000000-0000-4000-8000-000000000011',
    (
      select schedule.lock_version
      from public.schedule_versions schedule
      where schedule.id = '34000000-0000-4000-8000-000000000009'
    )
  )$$,
  'the checked delete command removes its cascaded assignment safely'
);
select is(
  (
    select count(*)::integer
    from public.planning_shifts shift
    where shift.id = '34000000-0000-4000-8000-000000000010'
  ),
  0,
  'the deleted shift is gone'
);
select is(
  (
    select count(*)::integer
    from public.shift_assignments assignment
    where assignment.id = '34000000-0000-4000-8000-000000000011'
  ),
  0,
  'the child assignment was deleted before the parent became invisible'
);

insert into public.vessels (id, organization_id, code, name)
values (
  '34000000-0000-4000-8000-000000000012',
  '34000000-0000-4000-8000-000000000002',
  'CMDVESSEL',
  'Command vessel'
);

insert into public.port_calls (
  id,
  organization_id,
  site_id,
  vessel_id,
  scheduled_arrival_at,
  source
) values (
  '34000000-0000-4000-8000-000000000013',
  '34000000-0000-4000-8000-000000000002',
  '34000000-0000-4000-8000-000000000003',
  '34000000-0000-4000-8000-000000000012',
  timestamptz '2045-01-03 08:00:00+00',
  'test'
);

insert into public.disruption_events (
  id,
  organization_id,
  site_id,
  port_call_id,
  kind,
  previous_arrival_at,
  new_arrival_at,
  source,
  created_by
) values (
  '34000000-0000-4000-8000-000000000014',
  '34000000-0000-4000-8000-000000000002',
  '34000000-0000-4000-8000-000000000003',
  '34000000-0000-4000-8000-000000000013',
  'delay',
  timestamptz '2045-01-03 08:00:00+00',
  timestamptz '2045-01-03 09:00:00+00',
  'test',
  '34000000-0000-4000-8000-000000000001'
);

insert into public.replanning_scenarios (
  id,
  organization_id,
  site_id,
  disruption_event_id,
  base_schedule_version_id,
  status,
  title,
  created_by
) values (
  '34000000-0000-4000-8000-000000000015',
  '34000000-0000-4000-8000-000000000002',
  '34000000-0000-4000-8000-000000000003',
  '34000000-0000-4000-8000-000000000014',
  '34000000-0000-4000-8000-000000000009',
  'simulated',
  'Command scenario',
  '34000000-0000-4000-8000-000000000001'
);

select lives_ok(
  $$select public.reject_replanning_scenario(
    '34000000-0000-4000-8000-000000000015',
    'Correction non retenue par exploitation'
  )$$,
  'a pending disruption can be rejected with a reason'
);
select is(
  (
    select scenario.status::text
    from public.replanning_scenarios scenario
    where scenario.id = '34000000-0000-4000-8000-000000000015'
  ),
  'rejected',
  'the scenario records the rejection decision'
);

select ok(
  position(
    'insert into public.agent_notifications'
    in lower(pg_get_functiondef('public.finalize_published_replanning()'::regprocedure))
  ) = 0,
  'replanning finalization delegates notification delivery to the outbox only'
);

insert into public.sites (id, organization_id, code, name, timezone)
values (
  '34000000-0000-4000-8000-000000000016',
  '34000000-0000-4000-8000-000000000002',
  'CMD2',
  'Other command site',
  'Europe/Paris'
);

insert into public.agent_groups (
  id,
  organization_id,
  site_id,
  code,
  name
) values (
  '34000000-0000-4000-8000-000000000017',
  '34000000-0000-4000-8000-000000000002',
  '34000000-0000-4000-8000-000000000016',
  'CMD-OTHER',
  'Other site group'
);

select throws_ok(
  $$insert into public.agent_group_memberships (
    organization_id,
    group_id,
    agent_id,
    effective_from,
    is_primary
  ) values (
    '34000000-0000-4000-8000-000000000002',
    '34000000-0000-4000-8000-000000000017',
    '34000000-0000-4000-8000-000000000004',
    date '2045-02-01',
    true
  )$$,
  'P2002',
  'Agent and group must belong to the same organization and site',
  'an agent cannot inherit targets from another site'
);
select is(
  (
    select count(*)::integer
    from public.agent_group_memberships membership
    where membership.group_id = '34000000-0000-4000-8000-000000000017'
  ),
  0,
  'the rejected cross-site membership leaves no partial row'
);

select * from finish();
rollback;
