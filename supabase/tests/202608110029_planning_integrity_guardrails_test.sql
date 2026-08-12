begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(28);

insert into public.organizations (id, slug, name)
values (
  '91000000-0000-4000-8000-000000000001',
  'p0-planning-integrity',
  'P0 planning integrity'
);

insert into public.sites (
  id,
  organization_id,
  code,
  name,
  timezone
) values (
  '91000000-0000-4000-8000-000000000002',
  '91000000-0000-4000-8000-000000000001',
  'P0TEST',
  'P0 test site',
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
) values
  (
    '91000000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    'p0-planner@example.test',
    '{}'::jsonb,
    '{"full_name":"P0 planner"}'::jsonb,
    now(),
    now()
  ),
  (
    '91000000-0000-4000-8000-000000000004',
    'authenticated',
    'authenticated',
    'p0-outsider@example.test',
    '{}'::jsonb,
    '{"full_name":"P0 outsider"}'::jsonb,
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
    '91000000-0000-4000-8000-000000000003',
    '91000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000002',
    'planning_admin'
  ),
  (
    '91000000-0000-4000-8000-000000000003',
    '91000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000002',
    'approver'
  );

select set_config(
  'request.jwt.claim.sub',
  '91000000-0000-4000-8000-000000000003',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.aal', 'aal2', true);
select set_config('request.jwt.claim.is_anonymous', 'false', true);

insert into public.skills (id, organization_id, code, name)
values (
  '91000000-0000-4000-8000-000000000005',
  '91000000-0000-4000-8000-000000000001',
  'P0-SKILL',
  'P0 mandatory skill'
);

insert into public.positions (
  id,
  organization_id,
  site_id,
  code,
  name
) values (
  '91000000-0000-4000-8000-000000000006',
  '91000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000002',
  'P0-POSITION',
  'P0 position'
);

insert into public.position_skill_requirements (
  organization_id,
  position_id,
  skill_id,
  minimum_level,
  mandatory
) values (
  '91000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000006',
  '91000000-0000-4000-8000-000000000005',
  2,
  true
);

insert into public.agents (
  id,
  organization_id,
  primary_site_id,
  employee_number,
  display_name,
  active,
  hired_on,
  left_on
) values
  (
    '91100000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000002',
    'P0-ELIGIBLE',
    'Eligible agent',
    true,
    date '2030-01-01',
    null
  ),
  (
    '91100000-0000-4000-8000-000000000002',
    '91000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000002',
    'P0-INACTIVE',
    'Inactive agent',
    false,
    date '2030-01-01',
    null
  ),
  (
    '91100000-0000-4000-8000-000000000003',
    '91000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000002',
    'P0-NOCONTRACT',
    'Agent without contract',
    true,
    date '2030-01-01',
    null
  ),
  (
    '91100000-0000-4000-8000-000000000004',
    '91000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000002',
    'P0-ABSENT',
    'Unavailable agent',
    true,
    date '2030-01-01',
    null
  ),
  (
    '91100000-0000-4000-8000-000000000005',
    '91000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000002',
    'P0-RESTRICTED',
    'Restricted agent',
    true,
    date '2030-01-01',
    null
  ),
  (
    '91100000-0000-4000-8000-000000000006',
    '91000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000002',
    'P0-UNSKILLED',
    'Unskilled agent',
    true,
    date '2030-01-01',
    null
  ),
  (
    '91100000-0000-4000-8000-000000000007',
    '91000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000002',
    'P0-FUTURE',
    'Not yet employed agent',
    true,
    date '2040-01-01',
    null
  );

insert into public.agent_contract_versions (
  organization_id,
  agent_id,
  effective_from,
  weekly_target_minutes,
  monthly_target_minutes,
  label
)
select
  '91000000-0000-4000-8000-000000000001',
  agent_id,
  date '2030-01-01',
  2100,
  9100,
  'P0 contract'
from unnest(
  array[
    '91100000-0000-4000-8000-000000000001'::uuid,
    '91100000-0000-4000-8000-000000000002'::uuid,
    '91100000-0000-4000-8000-000000000004'::uuid,
    '91100000-0000-4000-8000-000000000005'::uuid,
    '91100000-0000-4000-8000-000000000006'::uuid,
    '91100000-0000-4000-8000-000000000007'::uuid
  ]
) as contract_agents(agent_id);

insert into public.agent_skills (
  organization_id,
  agent_id,
  skill_id,
  level,
  valid_from
)
select
  '91000000-0000-4000-8000-000000000001',
  agent_id,
  '91000000-0000-4000-8000-000000000005',
  3,
  date '2030-01-01'
from unnest(
  array[
    '91100000-0000-4000-8000-000000000001'::uuid,
    '91100000-0000-4000-8000-000000000002'::uuid,
    '91100000-0000-4000-8000-000000000003'::uuid,
    '91100000-0000-4000-8000-000000000004'::uuid,
    '91100000-0000-4000-8000-000000000005'::uuid,
    '91100000-0000-4000-8000-000000000007'::uuid
  ]
) as skilled_agents(agent_id);

insert into public.agent_position_restrictions (
  organization_id,
  agent_id,
  position_id,
  reason,
  valid_from,
  valid_until,
  created_by
) values (
  '91000000-0000-4000-8000-000000000001',
  '91100000-0000-4000-8000-000000000005',
  '91000000-0000-4000-8000-000000000006',
  'P0 blocking restriction',
  date '2031-01-01',
  date '2032-12-31',
  '91000000-0000-4000-8000-000000000003'
);

insert into public.agent_unavailability (
  organization_id,
  site_id,
  agent_id,
  kind,
  starts_at,
  ends_at,
  note,
  created_by
) values (
  '91000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000002',
  '91100000-0000-4000-8000-000000000004',
  'leave',
  timestamptz '2031-01-01 00:00:00+00',
  timestamptz '2032-12-31 00:00:00+00',
  'P0 test absence',
  '91000000-0000-4000-8000-000000000003'
);

create or replace function pg_temp.make_p0_schedule(
  scenario_number integer,
  target_agent_id uuid,
  assignment_end_hour integer default 16,
  required_agent_count integer default 1
)
returns uuid
language plpgsql
as $$
declare
  period_id uuid := (
    '92100000-0000-4000-8000-' || lpad(scenario_number::text, 12, '0')
  )::uuid;
  version_id uuid := (
    '92200000-0000-4000-8000-' || lpad(scenario_number::text, 12, '0')
  )::uuid;
  requirement_id uuid := (
    '92300000-0000-4000-8000-' || lpad(scenario_number::text, 12, '0')
  )::uuid;
  shift_id uuid := (
    '92400000-0000-4000-8000-' || lpad(scenario_number::text, 12, '0')
  )::uuid;
  assignment_id uuid := (
    '92500000-0000-4000-8000-' || lpad(scenario_number::text, 12, '0')
  )::uuid;
  work_date date := date '2031-01-06' + scenario_number * 14;
  shift_start timestamptz := (work_date + time '08:00') at time zone 'Europe/Paris';
  shift_end timestamptz := (
    work_date + make_time(assignment_end_hour, 0, 0)
  ) at time zone 'Europe/Paris';
begin
  insert into public.planning_periods (
    id,
    organization_id,
    site_id,
    name,
    starts_on,
    ends_on,
    timezone
  ) values (
    period_id,
    '91000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000002',
    'P0 scenario ' || scenario_number,
    work_date,
    work_date + 6,
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
    version_id,
    '91000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000002',
    period_id,
    1,
    'draft',
    'P0 draft ' || scenario_number,
    '91000000-0000-4000-8000-000000000003'
  );

  insert into public.staffing_requirements (
    id,
    organization_id,
    site_id,
    planning_period_id,
    position_id,
    starts_at,
    ends_at,
    required_agents,
    source_revision
  ) values (
    requirement_id,
    '91000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000002',
    period_id,
    '91000000-0000-4000-8000-000000000006',
    shift_start,
    (work_date + time '16:00') at time zone 'Europe/Paris',
    required_agent_count,
    'p0-test'
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
    origin,
    created_by
  ) values (
    shift_id,
    '91000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000002',
    version_id,
    target_agent_id,
    shift_start,
    shift_end,
    0,
    'manual',
    '91000000-0000-4000-8000-000000000003'
  );

  insert into public.shift_assignments (
    id,
    organization_id,
    site_id,
    planning_shift_id,
    position_id,
    staffing_requirement_id,
    starts_at,
    ends_at
  ) values (
    assignment_id,
    '91000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000002',
    shift_id,
    '91000000-0000-4000-8000-000000000006',
    requirement_id,
    shift_start,
    shift_end
  );

  return version_id;
end;
$$;

select pg_temp.make_p0_schedule(
  1,
  '91100000-0000-4000-8000-000000000001'
);
select pg_temp.make_p0_schedule(
  2,
  '91100000-0000-4000-8000-000000000001',
  12
);
select pg_temp.make_p0_schedule(
  3,
  '91100000-0000-4000-8000-000000000002'
);
select pg_temp.make_p0_schedule(
  4,
  '91100000-0000-4000-8000-000000000003'
);
select pg_temp.make_p0_schedule(
  5,
  '91100000-0000-4000-8000-000000000004'
);
select pg_temp.make_p0_schedule(
  6,
  '91100000-0000-4000-8000-000000000005'
);
select pg_temp.make_p0_schedule(
  7,
  '91100000-0000-4000-8000-000000000006'
);
select pg_temp.make_p0_schedule(
  8,
  '91100000-0000-4000-8000-000000000001'
);
select pg_temp.make_p0_schedule(
  9,
  '91100000-0000-4000-8000-000000000001'
);
select pg_temp.make_p0_schedule(
  10,
  '91100000-0000-4000-8000-000000000001'
);
select pg_temp.make_p0_schedule(
  11,
  '91100000-0000-4000-8000-000000000007'
);

-- A new candidate supersedes the previous draft for scenario 8.
insert into public.schedule_versions (
  id,
  organization_id,
  site_id,
  planning_period_id,
  parent_version_id,
  version_number,
  status,
  label,
  created_by
) values (
  '92200000-0000-4000-8001-000000000008',
  '91000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000002',
  '92100000-0000-4000-8000-000000000008',
  null,
  2,
  'draft',
  'Replacement current draft',
  '91000000-0000-4000-8000-000000000003'
);

-- Inject a legacy violation to prove publication revalidates rules that are
-- normally enforced during writes as well.
alter table public.planning_shifts
  disable trigger planning_shifts_enforce_fundamental_rules;

insert into public.planning_shifts (
  id,
  organization_id,
  site_id,
  schedule_version_id,
  agent_id,
  starts_at,
  ends_at,
  break_minutes,
  origin,
  created_by
) values (
  '92400000-0000-4000-8001-000000000010',
  '91000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000002',
  '92200000-0000-4000-8000-000000000010',
  '91100000-0000-4000-8000-000000000001',
  ((date '2031-01-06' + 10 * 14 + 1) + time '02:00') at time zone 'Europe/Paris',
  ((date '2031-01-06' + 10 * 14 + 1) + time '10:00') at time zone 'Europe/Paris',
  0,
  'manual',
  '91000000-0000-4000-8000-000000000003'
);

alter table public.planning_shifts
  enable trigger planning_shifts_enforce_fundamental_rules;

insert into public.shift_assignments (
  id,
  organization_id,
  site_id,
  planning_shift_id,
  position_id,
  starts_at,
  ends_at
) values (
  '92500000-0000-4000-8001-000000000010',
  '91000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000002',
  '92400000-0000-4000-8001-000000000010',
  '91000000-0000-4000-8000-000000000006',
  ((date '2031-01-06' + 10 * 14 + 1) + time '02:00') at time zone 'Europe/Paris',
  ((date '2031-01-06' + 10 * 14 + 1) + time '10:00') at time zone 'Europe/Paris'
);

select ok(
  not has_table_privilege('authenticated', 'public.schedule_versions', 'UPDATE'),
  'authenticated cannot update schedule versions directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.planning_shifts', 'INSERT'),
  'authenticated cannot insert planning shifts directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.shift_assignments', 'UPDATE'),
  'authenticated cannot update assignments directly'
);
select ok(
  not (
    select procedure.prosecdef
    from pg_proc procedure
    where procedure.oid = 'public.get_schedule_content(uuid)'::regprocedure
  ),
  'the schedule snapshot RPC uses security invoker'
);
select is(
  (
    select count(*)
    from public.schedule_versions schedule
    where schedule.planning_period_id = '92100000-0000-4000-8000-000000000008'
      and schedule.status in ('draft', 'validated')
      and schedule.superseded_at is null
  ),
  1::bigint,
  'one planning period has exactly one current draft'
);
select ok(
  (
    select schedule.superseded_at is not null
    from public.schedule_versions schedule
    where schedule.id = '92200000-0000-4000-8000-000000000008'
  ),
  'the previous draft is retained and marked superseded'
);

set local role authenticated;

select throws_ok(
  $$
    update public.schedule_versions
    set label = 'Direct mutation'
    where id = '92200000-0000-4000-8000-000000000001'
  $$,
  '42501',
  null,
  'a real direct schedule mutation is denied'
);
select throws_ok(
  $$
    select public.publish_schedule_version(
      '92200000-0000-4000-8000-000000000008',
      'Stale publication test',
      (select lock_version from public.schedule_versions where id =
        '92200000-0000-4000-8000-000000000008')
    )
  $$,
  'P2050',
  null,
  'a superseded draft cannot be published'
);
select throws_ok(
  $$
    select public.publish_schedule_version(
      '92200000-0000-4000-8000-000000000002',
      'Coverage test',
      (select lock_version from public.schedule_versions where id =
        '92200000-0000-4000-8000-000000000002')
    )
  $$,
  'P2054',
  null,
  'publication rejects a partially covered requirement'
);
select throws_ok(
  $$
    select public.publish_schedule_version(
      '92200000-0000-4000-8000-000000000003',
      'Active employment test',
      (select lock_version from public.schedule_versions where id =
        '92200000-0000-4000-8000-000000000003')
    )
  $$,
  'P2044',
  null,
  'publication rejects an inactive agent'
);
select throws_ok(
  $$
    select public.publish_schedule_version(
      '92200000-0000-4000-8000-000000000004',
      'Contract test',
      (select lock_version from public.schedule_versions where id =
        '92200000-0000-4000-8000-000000000004')
    )
  $$,
  'P2045',
  null,
  'publication rejects an agent without an effective contract'
);
select throws_ok(
  $$
    select public.publish_schedule_version(
      '92200000-0000-4000-8000-000000000005',
      'Absence test',
      (select lock_version from public.schedule_versions where id =
        '92200000-0000-4000-8000-000000000005')
    )
  $$,
  'P2046',
  null,
  'publication rejects an unavailable agent'
);
select throws_ok(
  $$
    select public.publish_schedule_version(
      '92200000-0000-4000-8000-000000000006',
      'Restriction test',
      (select lock_version from public.schedule_versions where id =
        '92200000-0000-4000-8000-000000000006')
    )
  $$,
  'P2048',
  null,
  'publication rejects a restricted position'
);
select throws_ok(
  $$
    select public.publish_schedule_version(
      '92200000-0000-4000-8000-000000000007',
      'Mandatory skill test',
      (select lock_version from public.schedule_versions where id =
        '92200000-0000-4000-8000-000000000007')
    )
  $$,
  'P2049',
  null,
  'publication rejects a missing mandatory skill'
);
select throws_ok(
  $$
    select public.publish_schedule_version(
      '92200000-0000-4000-8000-000000000010',
      'Fundamental rule test',
      (select lock_version from public.schedule_versions where id =
        '92200000-0000-4000-8000-000000000010')
    )
  $$,
  'P2002',
  null,
  'publication revalidates the existing 11-hour rest rule'
);
select throws_ok(
  $$
    select public.publish_schedule_version(
      '92200000-0000-4000-8000-000000000011',
      'Employment date test',
      (select lock_version from public.schedule_versions where id =
        '92200000-0000-4000-8000-000000000011')
    )
  $$,
  'P2044',
  null,
  'publication rejects an agent whose employment has not started'
);
select is(
  (
    select schedule.lock_version
    from public.schedule_versions schedule
    where schedule.id = '92200000-0000-4000-8000-000000000009'
  ),
  3::bigint,
  'requirements, shifts and assignments advance the schedule lock version'
);
select throws_ok(
  $$
    select public.update_planning_assignment(
      '92200000-0000-4000-8000-000000000009',
      '92500000-0000-4000-8000-000000000009',
      '91100000-0000-4000-8000-000000000001',
      '91000000-0000-4000-8000-000000000006',
      null,
      (select shift.starts_at from public.planning_shifts shift where shift.id = '92400000-0000-4000-8000-000000000009'),
      (select shift.ends_at from public.planning_shifts shift where shift.id = '92400000-0000-4000-8000-000000000009'),
      0,
      'Concurrent update test',
      2
    )
  $$,
  'P2031',
  null,
  'the checked edit RPC rejects a stale lock version'
);
select is(
  (
    select schedule.lock_version
    from public.schedule_versions schedule
    where schedule.id = '92200000-0000-4000-8000-000000000009'
  ),
  3::bigint,
  'a rejected concurrent edit leaves the schedule unchanged'
);
select lives_ok(
  $$
    select public.update_planning_assignment(
      '92200000-0000-4000-8000-000000000009',
      '92500000-0000-4000-8000-000000000009',
      '91100000-0000-4000-8000-000000000001',
      '91000000-0000-4000-8000-000000000006',
      null,
      (select shift.starts_at from public.planning_shifts shift where shift.id = '92400000-0000-4000-8000-000000000009'),
      (select shift.ends_at from public.planning_shifts shift where shift.id = '92400000-0000-4000-8000-000000000009'),
      0,
      'Checked update succeeds',
      3
    )
  $$,
  'the checked edit RPC accepts the current lock version'
);
select is(
  (
    select schedule.lock_version
    from public.schedule_versions schedule
    where schedule.id = '92200000-0000-4000-8000-000000000009'
  ),
  5::bigint,
  'an atomic shift and assignment update advances the lock twice'
);
select lives_ok(
  $$
    select public.publish_schedule_version(
      '92200000-0000-4000-8000-000000000001',
      'Valid P0 publication',
      (select lock_version from public.schedule_versions where id =
        '92200000-0000-4000-8000-000000000001')
    )
  $$,
  'a fully valid and covered schedule can be published'
);
select is(
  (
    select schedule.status::text
    from public.schedule_versions schedule
    where schedule.id = '92200000-0000-4000-8000-000000000001'
  ),
  'published',
  'the valid schedule is published'
);
select is(
  (
    select count(*)
    from public.schedule_versions schedule
    where schedule.planning_period_id = '92100000-0000-4000-8000-000000000001'
      and schedule.status in ('draft', 'validated')
      and schedule.superseded_at is null
  ),
  1::bigint,
  'publication creates exactly one editable follow-up draft'
);
select ok(
  public.get_schedule_content(
    '92200000-0000-4000-8000-000000000001'
  ) is not null,
  'the snapshot RPC returns an authorized schedule'
);
select is(
  jsonb_array_length(
    public.get_schedule_content(
      '92200000-0000-4000-8000-000000000001'
    ) -> 'shifts'
  ),
  1,
  'the snapshot contains all shifts'
);
select is(
  jsonb_array_length(
    public.get_schedule_content(
      '92200000-0000-4000-8000-000000000001'
    ) -> 'assignments'
  ),
  1,
  'the snapshot contains all assignments without an UUID list'
);

select set_config(
  'request.jwt.claim.sub',
  '91000000-0000-4000-8000-000000000004',
  true
);

select is(
  public.get_schedule_content(
    '92200000-0000-4000-8000-000000000001'
  ),
  null::jsonb,
  'the security-invoker snapshot preserves schedule RLS'
);

reset role;

select * from finish();

rollback;
