begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_temp;

select plan(30);

select has_table(
  'public',
  'planning_shift_breaks',
  'breaks are first-class planning rows'
);
select has_column(
  'public',
  'planning_shift_breaks',
  'starts_at',
  'a break has an exact start'
);
select has_column(
  'public',
  'planning_shift_breaks',
  'ends_at',
  'a break has an exact end'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.create_planning_shift_service(uuid,uuid,timestamptz,timestamptz,jsonb,jsonb,text,bigint)',
    'EXECUTE'
  ),
  'authenticated planners can use the atomic service creation command'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.create_planning_shift_service(uuid,uuid,timestamptz,timestamptz,jsonb,jsonb,text,bigint)',
    'EXECUTE'
  ),
  'anonymous callers cannot use the service creation command'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.update_planning_shift_service(uuid,uuid,uuid,timestamptz,timestamptz,jsonb,jsonb,text,bigint)',
    'EXECUTE'
  ),
  'authenticated planners can use the atomic service update command'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.replace_planning_shift_service(uuid,uuid,uuid,timestamptz,timestamptz,jsonb,jsonb,text,bigint)',
    'EXECUTE'
  ),
  'the nullable internal replacement primitive is not exposed directly'
);
select ok(
  not has_table_privilege(
    'authenticated',
    'public.planning_shift_breaks',
    'INSERT'
  ),
  'authenticated callers cannot bypass break commands with direct inserts'
);

insert into public.organizations (id, slug, name)
values (
  '35000000-0000-4000-8000-000000000001',
  'shift-timeline-tests',
  'Shift timeline tests'
);

insert into public.sites (id, organization_id, code, name, timezone)
values (
  '35000000-0000-4000-8000-000000000002',
  '35000000-0000-4000-8000-000000000001',
  'SEGMENTS',
  'Segment test site',
  'Europe/Paris'
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
  '35000000-0000-4000-8000-000000000003',
  'authenticated',
  'authenticated',
  'shift-planner@example.invalid',
  '{}'::jsonb,
  '{"full_name":"Shift planner"}'::jsonb,
  now(),
  now()
);

insert into public.user_role_assignments (
  user_id,
  organization_id,
  site_id,
  role
) values
  (
    '35000000-0000-4000-8000-000000000003',
    '35000000-0000-4000-8000-000000000001',
    '35000000-0000-4000-8000-000000000002',
    'planning_admin'
  ),
  (
    '35000000-0000-4000-8000-000000000003',
    '35000000-0000-4000-8000-000000000001',
    '35000000-0000-4000-8000-000000000002',
    'approver'
  );

select set_config(
  'request.jwt.claim.sub',
  '35000000-0000-4000-8000-000000000003',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.aal', 'aal2', true);
select set_config('request.jwt.claim.is_anonymous', 'false', true);

insert into public.positions (
  id,
  organization_id,
  site_id,
  code,
  name
) values
  (
    '35000000-0000-4000-8000-000000000004',
    '35000000-0000-4000-8000-000000000001',
    '35000000-0000-4000-8000-000000000002',
    'POS-A',
    'Position A'
  ),
  (
    '35000000-0000-4000-8000-000000000005',
    '35000000-0000-4000-8000-000000000001',
    '35000000-0000-4000-8000-000000000002',
    'POS-B',
    'Position B'
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
  '35000000-0000-4000-8000-000000000006',
  '35000000-0000-4000-8000-000000000001',
  '35000000-0000-4000-8000-000000000002',
  'SEG-001',
  'Segment agent',
  true,
  date '2042-01-01'
);

insert into public.agent_contract_versions (
  organization_id,
  agent_id,
  effective_from,
  weekly_target_minutes,
  monthly_target_minutes,
  label
) values (
  '35000000-0000-4000-8000-000000000001',
  '35000000-0000-4000-8000-000000000006',
  date '2042-01-01',
  2100,
  9100,
  'Segment test contract'
);

insert into public.planning_periods (
  id,
  organization_id,
  site_id,
  name,
  starts_on,
  ends_on,
  timezone
) values
  (
    '35000000-0000-4000-8000-000000000010',
    '35000000-0000-4000-8000-000000000001',
    '35000000-0000-4000-8000-000000000002',
    'Segment week',
    date '2042-01-06',
    date '2042-01-12',
    'Europe/Paris'
  ),
  (
    '35000000-0000-4000-8000-000000000011',
    '35000000-0000-4000-8000-000000000001',
    '35000000-0000-4000-8000-000000000002',
    'Deletion week',
    date '2042-01-13',
    date '2042-01-19',
    'Europe/Paris'
  ),
  (
    '35000000-0000-4000-8000-000000000012',
    '35000000-0000-4000-8000-000000000001',
    '35000000-0000-4000-8000-000000000002',
    'Gap week',
    date '2042-01-20',
    date '2042-01-26',
    'Europe/Paris'
  ),
  (
    '35000000-0000-4000-8000-000000000013',
    '35000000-0000-4000-8000-000000000001',
    '35000000-0000-4000-8000-000000000002',
    'Legacy week',
    date '2042-01-27',
    date '2042-02-02',
    'Europe/Paris'
  );

insert into public.staffing_requirements (
  id,
  organization_id,
  site_id,
  planning_period_id,
  position_id,
  starts_at,
  ends_at,
  required_agents
) values (
  '35000000-0000-4000-8000-000000000014',
  '35000000-0000-4000-8000-000000000001',
  '35000000-0000-4000-8000-000000000002',
  '35000000-0000-4000-8000-000000000010',
  '35000000-0000-4000-8000-000000000004',
  timestamptz '2042-01-06 07:00:00+00',
  timestamptz '2042-01-06 11:00:00+00',
  1
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
) values
  (
    '35000000-0000-4000-8000-000000000020',
    '35000000-0000-4000-8000-000000000001',
    '35000000-0000-4000-8000-000000000002',
    '35000000-0000-4000-8000-000000000010',
    1,
    'draft',
    'Segment draft',
    '35000000-0000-4000-8000-000000000003'
  ),
  (
    '35000000-0000-4000-8000-000000000021',
    '35000000-0000-4000-8000-000000000001',
    '35000000-0000-4000-8000-000000000002',
    '35000000-0000-4000-8000-000000000011',
    1,
    'draft',
    'Deletion draft',
    '35000000-0000-4000-8000-000000000003'
  ),
  (
    '35000000-0000-4000-8000-000000000022',
    '35000000-0000-4000-8000-000000000001',
    '35000000-0000-4000-8000-000000000002',
    '35000000-0000-4000-8000-000000000012',
    1,
    'draft',
    'Gap draft',
    '35000000-0000-4000-8000-000000000003'
  ),
  (
    '35000000-0000-4000-8000-000000000023',
    '35000000-0000-4000-8000-000000000001',
    '35000000-0000-4000-8000-000000000002',
    '35000000-0000-4000-8000-000000000013',
    1,
    'draft',
    'Legacy draft',
    '35000000-0000-4000-8000-000000000003'
  );

create temporary table shift_test_state (
  key text primary key,
  value text not null
);

grant select, insert, update, delete on shift_test_state to authenticated;

insert into shift_test_state (key, value)
select 'initial_lock', schedule.lock_version::text
from public.schedule_versions schedule
where schedule.id = '35000000-0000-4000-8000-000000000020';

set local role authenticated;

insert into shift_test_state (key, value)
select 'main_shift_id', result ->> 'shiftId'
from public.create_planning_shift_service(
  '35000000-0000-4000-8000-000000000020',
  '35000000-0000-4000-8000-000000000006',
  timestamptz '2042-01-06 07:00:00+00',
  timestamptz '2042-01-06 15:00:00+00',
  jsonb_build_array(
    jsonb_build_object(
      'positionId', '35000000-0000-4000-8000-000000000004',
      'startsAt', '2042-01-06T07:00:00Z',
      'endsAt', '2042-01-06T11:00:00Z'
    ),
    jsonb_build_object(
      'positionId', '35000000-0000-4000-8000-000000000005',
      'startsAt', '2042-01-06T11:00:00Z',
      'endsAt', '2042-01-06T15:00:00Z'
    )
  ),
  jsonb_build_array(
    jsonb_build_object(
      'startsAt', '2042-01-06T09:00:00Z',
      'endsAt', '2042-01-06T09:30:00Z',
      'label', 'Pause repas'
    )
  ),
  'Service multi-poste',
  (
    select schedule.lock_version
    from public.schedule_versions schedule
    where schedule.id = '35000000-0000-4000-8000-000000000020'
  )
) result;

select is(
  (
    select count(*)::integer
    from public.shift_assignments assignment
    where assignment.planning_shift_id = (
      select value::uuid from shift_test_state where key = 'main_shift_id'
    )
  ),
  2,
  'one service stores two position segments'
);
select is(
  (
    select count(*)::integer
    from public.planning_shift_breaks pause
    where pause.planning_shift_id = (
      select value::uuid from shift_test_state where key = 'main_shift_id'
    )
  ),
  1,
  'the service stores its exact break interval'
);
select is(
  (
    select shift.break_minutes
    from public.planning_shifts shift
    where shift.id = (
      select value::uuid from shift_test_state where key = 'main_shift_id'
    )
  ),
  30,
  'the legacy break duration is synchronized from exact intervals'
);
select is(
  public.planning_shift_planned_minutes(
    (select value::uuid from shift_test_state where key = 'main_shift_id')
  ),
  450,
  'planned time excludes the real 30-minute break'
);

reset role;

select results_eq(
  $$
    select gap_starts_at, gap_ends_at, assigned_agents
    from public.schedule_version_coverage_gaps(
      '35000000-0000-4000-8000-000000000020'
    )
    order by gap_starts_at
  $$,
  $$values (
    timestamptz '2042-01-06 09:00:00+00',
    timestamptz '2042-01-06 09:30:00+00',
    0::bigint
  )$$,
  'coverage excludes the agent only for the exact break interval'
);

set local role authenticated;

select throws_ok(
  format(
    $command$
      select public.update_planning_shift_service(
        '35000000-0000-4000-8000-000000000020',
        %L::uuid,
        '35000000-0000-4000-8000-000000000006',
        timestamptz '2042-01-06 07:00:00+00',
        timestamptz '2042-01-06 15:00:00+00',
        jsonb_build_array(
          jsonb_build_object(
            'positionId', '35000000-0000-4000-8000-000000000004',
            'startsAt', '2042-01-06T07:00:00Z',
            'endsAt', '2042-01-06T12:00:00Z'
          ),
          jsonb_build_object(
            'positionId', '35000000-0000-4000-8000-000000000005',
            'startsAt', '2042-01-06T11:00:00Z',
            'endsAt', '2042-01-06T15:00:00Z'
          )
        ),
        '[]'::jsonb,
        'Overlap attempt',
        %s
      )
    $command$,
    (select value from shift_test_state where key = 'main_shift_id'),
    (
      select schedule.lock_version
      from public.schedule_versions schedule
      where schedule.id = '35000000-0000-4000-8000-000000000020'
    )
  ),
  'P2062',
  null,
  'overlapping position segments are rejected atomically'
);
select is(
  (
    select count(*)::integer
    from public.shift_assignments assignment
    where assignment.planning_shift_id = (
      select value::uuid from shift_test_state where key = 'main_shift_id'
    )
  ),
  2,
  'a rejected replacement preserves the original service'
);

select lives_ok(
  format(
    $command$
      select public.update_planning_shift_service(
        '35000000-0000-4000-8000-000000000020',
        %L::uuid,
        '35000000-0000-4000-8000-000000000006',
        timestamptz '2042-01-06 07:00:00+00',
        timestamptz '2042-01-06 15:00:00+00',
        jsonb_build_array(
          jsonb_build_object(
            'positionId', '35000000-0000-4000-8000-000000000004',
            'startsAt', '2042-01-06T07:00:00Z',
            'endsAt', '2042-01-06T11:00:00Z'
          ),
          jsonb_build_object(
            'positionId', '35000000-0000-4000-8000-000000000005',
            'startsAt', '2042-01-06T11:00:00Z',
            'endsAt', '2042-01-06T15:00:00Z'
          )
        ),
        jsonb_build_array(
          jsonb_build_object(
            'startsAt', '2042-01-06T12:00:00Z',
            'endsAt', '2042-01-06T12:15:00Z',
            'label', 'Pause courte 1'
          ),
          jsonb_build_object(
            'startsAt', '2042-01-06T14:00:00Z',
            'endsAt', '2042-01-06T14:15:00Z',
            'label', 'Pause courte 2'
          )
        ),
        'Pauses déplacées',
        %s
      )
    $command$,
    (select value from shift_test_state where key = 'main_shift_id'),
    (
      select schedule.lock_version
      from public.schedule_versions schedule
      where schedule.id = '35000000-0000-4000-8000-000000000020'
    )
  ),
  'a complete multi-position service can be replaced atomically'
);

reset role;

select is(
  (
    select count(*)::integer
    from public.schedule_version_coverage_gaps(
      '35000000-0000-4000-8000-000000000020'
    )
  ),
  0,
  'removing the break restores continuous requirement coverage'
);

set local role authenticated;
select is(
  (
    select count(*)::integer
    from public.planning_shift_breaks pause
    where pause.planning_shift_id = (
      select value::uuid from shift_test_state where key = 'main_shift_id'
    )
  ),
  2,
  'replacement removes the obsolete break and stores both new intervals'
);

select throws_ok(
  format(
    $command$
      select public.update_planning_shift_service(
        '35000000-0000-4000-8000-000000000020',
        %L::uuid,
        '35000000-0000-4000-8000-000000000006',
        timestamptz '2042-01-06 07:00:00+00',
        timestamptz '2042-01-06 15:00:00+00',
        jsonb_build_array(
          jsonb_build_object(
            'positionId', '35000000-0000-4000-8000-000000000004',
            'startsAt', '2042-01-06T07:00:00Z',
            'endsAt', '2042-01-06T15:00:00Z'
          )
        ),
        '[]'::jsonb,
        'Stale write',
        %s
      )
    $command$,
    (select value from shift_test_state where key = 'main_shift_id'),
    (select value from shift_test_state where key = 'initial_lock')
  ),
  'P2031',
  null,
  'a stale concurrency token cannot overwrite a newer service'
);

select lives_ok(
  format(
    $command$
      select public.publish_schedule_version(
        '35000000-0000-4000-8000-000000000020',
        'Publication test segments',
        %s
      )
    $command$,
    (
      select schedule.lock_version
      from public.schedule_versions schedule
      where schedule.id = '35000000-0000-4000-8000-000000000020'
    )
  ),
  'publication accepts a continuous non-overlapping multi-position timeline'
);
select is(
  (
    select count(*)::integer
    from public.planning_shift_breaks pause
    join public.planning_shifts cloned_shift
      on cloned_shift.id = pause.planning_shift_id
    join public.schedule_versions cloned_schedule
      on cloned_schedule.id = cloned_shift.schedule_version_id
    where cloned_shift.source_shift_id = (
      select value::uuid from shift_test_state where key = 'main_shift_id'
    )
      and cloned_schedule.status = 'draft'
      and cloned_schedule.superseded_at is null
  ),
  2,
  'the automatic follow-up draft clones every exact break interval'
);
select is(
  (
    select min(pause.starts_at)
    from public.planning_shift_breaks pause
    join public.planning_shifts cloned_shift
      on cloned_shift.id = pause.planning_shift_id
    join public.schedule_versions cloned_schedule
      on cloned_schedule.id = cloned_shift.schedule_version_id
    where cloned_shift.source_shift_id = (
      select value::uuid from shift_test_state where key = 'main_shift_id'
    )
      and cloned_schedule.status = 'draft'
      and cloned_schedule.superseded_at is null
  ),
  timestamptz '2042-01-06 12:00:00+00',
  'cloning preserves the exact placement of the first break'
);

insert into shift_test_state (key, value)
select 'deletion_shift_id', result ->> 'shiftId'
from public.create_planning_shift_service(
  '35000000-0000-4000-8000-000000000021',
  '35000000-0000-4000-8000-000000000006',
  timestamptz '2042-01-13 07:00:00+00',
  timestamptz '2042-01-13 15:00:00+00',
  jsonb_build_array(
    jsonb_build_object(
      'positionId', '35000000-0000-4000-8000-000000000004',
      'startsAt', '2042-01-13T07:00:00Z',
      'endsAt', '2042-01-13T11:00:00Z'
    ),
    jsonb_build_object(
      'positionId', '35000000-0000-4000-8000-000000000005',
      'startsAt', '2042-01-13T11:00:00Z',
      'endsAt', '2042-01-13T15:00:00Z'
    )
  ),
  '[]'::jsonb,
  'Service à supprimer',
  (
    select schedule.lock_version
    from public.schedule_versions schedule
    where schedule.id = '35000000-0000-4000-8000-000000000021'
  )
) result;

select lives_ok(
  format(
    $command$
      select public.delete_planning_shift_service(
        '35000000-0000-4000-8000-000000000021',
        %L::uuid,
        %s
      )
    $command$,
    (select value from shift_test_state where key = 'deletion_shift_id'),
    (
      select schedule.lock_version
      from public.schedule_versions schedule
      where schedule.id = '35000000-0000-4000-8000-000000000021'
    )
  ),
  'the whole multi-position service can be deleted atomically'
);
select is(
  (
    select count(*)::integer
    from public.planning_shifts shift
    where shift.id = (
      select value::uuid from shift_test_state where key = 'deletion_shift_id'
    )
  ),
  0,
  'service deletion removes its parent shift'
);
select is(
  (
    select count(*)::integer
    from public.shift_assignments assignment
    where assignment.planning_shift_id = (
      select value::uuid from shift_test_state where key = 'deletion_shift_id'
    )
  ),
  0,
  'service deletion removes all position segments'
);

reset role;

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
  '35000000-0000-4000-8000-000000000030',
  '35000000-0000-4000-8000-000000000001',
  '35000000-0000-4000-8000-000000000002',
  '35000000-0000-4000-8000-000000000022',
  '35000000-0000-4000-8000-000000000006',
  timestamptz '2042-01-20 07:00:00+00',
  timestamptz '2042-01-20 15:00:00+00',
  0,
  '35000000-0000-4000-8000-000000000003'
);

insert into public.shift_assignments (
  organization_id,
  site_id,
  planning_shift_id,
  position_id,
  starts_at,
  ends_at
) values
  (
    '35000000-0000-4000-8000-000000000001',
    '35000000-0000-4000-8000-000000000002',
    '35000000-0000-4000-8000-000000000030',
    '35000000-0000-4000-8000-000000000004',
    timestamptz '2042-01-20 07:00:00+00',
    timestamptz '2042-01-20 10:00:00+00'
  ),
  (
    '35000000-0000-4000-8000-000000000001',
    '35000000-0000-4000-8000-000000000002',
    '35000000-0000-4000-8000-000000000030',
    '35000000-0000-4000-8000-000000000005',
    timestamptz '2042-01-20 11:00:00+00',
    timestamptz '2042-01-20 15:00:00+00'
  );

set local role authenticated;

select throws_ok(
  format(
    $command$
      select public.publish_schedule_version(
        '35000000-0000-4000-8000-000000000022',
        'Publication with timeline gap',
        %s
      )
    $command$,
    (
      select schedule.lock_version
      from public.schedule_versions schedule
      where schedule.id = '35000000-0000-4000-8000-000000000022'
    )
  ),
  'P2063',
  null,
  'publication revalidates and rejects a service timeline gap'
);

select lives_ok(
  format(
    $command$
      select public.create_planning_shift(
        '35000000-0000-4000-8000-000000000023',
        '35000000-0000-4000-8000-000000000006',
        timestamptz '2042-01-27 07:00:00+00',
        timestamptz '2042-01-27 15:00:00+00',
        30,
        '35000000-0000-4000-8000-000000000004',
        null,
        'Legacy compatibility',
        %s
      )
    $command$,
    (
      select schedule.lock_version
      from public.schedule_versions schedule
      where schedule.id = '35000000-0000-4000-8000-000000000023'
    )
  ),
  'the existing CAS create command still accepts a duration-based break'
);
select is(
  (
    select count(*)::integer
    from public.planning_shift_breaks pause
    join public.planning_shifts shift on shift.id = pause.planning_shift_id
    where shift.schedule_version_id = '35000000-0000-4000-8000-000000000023'
  ),
  1,
  'a legacy break duration is automatically materialized as one interval'
);
select is(
  (
    select extract(epoch from (pause.ends_at - pause.starts_at))::integer / 60
    from public.planning_shift_breaks pause
    join public.planning_shifts shift on shift.id = pause.planning_shift_id
    where shift.schedule_version_id = '35000000-0000-4000-8000-000000000023'
  ),
  30,
  'the materialized legacy break preserves its exact duration'
);

select throws_ok(
  $$
    insert into public.planning_shift_breaks (
      organization_id,
      site_id,
      planning_shift_id,
      starts_at,
      ends_at
    ) values (
      '35000000-0000-4000-8000-000000000001',
      '35000000-0000-4000-8000-000000000002',
      '35000000-0000-4000-8000-000000000030',
      timestamptz '2042-01-20 12:00:00+00',
      timestamptz '2042-01-20 12:30:00+00'
    )
  $$,
  '42501',
  null,
  'authenticated callers cannot directly create a break interval'
);

select * from finish();
rollback;
