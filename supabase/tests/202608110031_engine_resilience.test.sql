begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(69);

insert into public.organizations (id, slug, name)
values (
  '93000000-0000-4000-8000-000000000001',
  'engine-resilience-test',
  'Engine resilience test'
);

insert into public.sites (id, organization_id, code, name, timezone)
values (
  '93000000-0000-4000-8000-000000000002',
  '93000000-0000-4000-8000-000000000001',
  'ENGTEST',
  'Engine test site',
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
  '93000000-0000-4000-8000-000000000003',
  'authenticated',
  'authenticated',
  'engine-planner@example.test',
  '{}'::jsonb,
  '{"full_name":"Engine planner"}'::jsonb,
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
    '93000000-0000-4000-8000-000000000003',
    '93000000-0000-4000-8000-000000000001',
    '93000000-0000-4000-8000-000000000002',
    'planning_admin'
  ),
  (
    '93000000-0000-4000-8000-000000000003',
    '93000000-0000-4000-8000-000000000001',
    '93000000-0000-4000-8000-000000000002',
    'approver'
  );

select set_config(
  'request.jwt.claim.sub',
  '93000000-0000-4000-8000-000000000003',
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
) values (
  '93000000-0000-4000-8000-000000000004',
  '93000000-0000-4000-8000-000000000001',
  '93000000-0000-4000-8000-000000000002',
  'ENG-POS',
  'Engine position'
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
  '93000000-0000-4000-8000-000000000005',
  '93000000-0000-4000-8000-000000000001',
  '93000000-0000-4000-8000-000000000002',
  'ENG-001',
  'Engine agent',
  true,
  date '2032-01-01'
);

insert into public.agent_contract_versions (
  organization_id,
  agent_id,
  effective_from,
  weekly_target_minutes,
  monthly_target_minutes,
  label
) values (
  '93000000-0000-4000-8000-000000000001',
  '93000000-0000-4000-8000-000000000005',
  date '2032-01-01',
  2100,
  9000,
  'Engine contract'
);

insert into public.vessels (
  id,
  organization_id,
  code,
  name
) values (
  '93000000-0000-4000-8000-000000000006',
  '93000000-0000-4000-8000-000000000001',
  'ENG-VESSEL',
  'Engine vessel'
);

insert into public.demand_profiles (
  id,
  organization_id,
  site_id,
  code,
  name,
  version
) values
  (
    '93000000-0000-4000-8000-000000000007',
    '93000000-0000-4000-8000-000000000001',
    '93000000-0000-4000-8000-000000000002',
    'ENG-LOAD',
    'Engine load profile',
    1
  ),
  (
    '93000000-0000-4000-8000-000000000008',
    '93000000-0000-4000-8000-000000000001',
    '93000000-0000-4000-8000-000000000002',
    'ENG-LEGACY',
    'Engine legacy profile',
    1
  );

insert into public.demand_profile_lines (
  id,
  organization_id,
  site_id,
  demand_profile_id,
  position_id,
  anchor,
  starts_offset_minutes,
  duration_minutes,
  base_agents,
  freight_units_per_extra_agent,
  coaches_per_extra_agent,
  minimum_agents,
  maximum_agents
) values
  (
    '93000000-0000-4000-8000-000000000009',
    '93000000-0000-4000-8000-000000000001',
    '93000000-0000-4000-8000-000000000002',
    '93000000-0000-4000-8000-000000000007',
    '93000000-0000-4000-8000-000000000004',
    'arrival',
    120,
    480,
    1,
    5,
    2,
    1,
    20
  ),
  (
    '93000000-0000-4000-8000-000000000010',
    '93000000-0000-4000-8000-000000000001',
    '93000000-0000-4000-8000-000000000002',
    '93000000-0000-4000-8000-000000000008',
    '93000000-0000-4000-8000-000000000004',
    'arrival',
    120,
    480,
    1,
    null,
    null,
    1,
    20
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
    '93000000-0000-4000-8000-000000000011',
    '93000000-0000-4000-8000-000000000001',
    '93000000-0000-4000-8000-000000000002',
    'Week one',
    date '2032-01-05',
    date '2032-01-11',
    'Europe/Paris'
  ),
  (
    '93000000-0000-4000-8000-000000000012',
    '93000000-0000-4000-8000-000000000001',
    '93000000-0000-4000-8000-000000000002',
    'Week two',
    date '2032-01-12',
    date '2032-01-18',
    'Europe/Paris'
  );

select lives_ok(
  $$
    insert into public.port_calls (
      id,
      organization_id,
      site_id,
      vessel_id,
      external_reference,
      status,
      scheduled_arrival_at,
      scheduled_departure_at,
      source,
      source_revision,
      demand_profile_id
    ) values (
      '93000000-0000-4000-8000-000000000013',
      '93000000-0000-4000-8000-000000000001',
      '93000000-0000-4000-8000-000000000002',
      '93000000-0000-4000-8000-000000000006',
      'ENG-CALL',
      'scheduled',
      timestamptz '2032-01-11 19:00:00+00',
      timestamptz '2032-01-11 21:00:00+00',
      'corsica-linea-feed',
      '10',
      '93000000-0000-4000-8000-000000000007'
    )
  $$,
  'an ordered maritime call can initialize its weekly workspace'
);

insert into public.call_load_forecasts (
  organization_id,
  site_id,
  port_call_id,
  passenger_count,
  vehicle_count,
  freight_unit_count,
  coach_count,
  source,
  source_revision,
  source_sequence,
  source_received_at
) values (
  '93000000-0000-4000-8000-000000000001',
  '93000000-0000-4000-8000-000000000002',
  '93000000-0000-4000-8000-000000000013',
  0,
  0,
  11,
  3,
  'tools-panel',
  'load-1',
  0,
  timestamptz '2032-01-10 12:00:00+00'
);

select is(
  (
    select requirement.required_agents::integer
    from public.staffing_requirements requirement
    where requirement.planning_period_id =
      '93000000-0000-4000-8000-000000000011'
      and requirement.port_call_id =
        '93000000-0000-4000-8000-000000000013'
      and requirement.retired_at is null
  ),
  6,
  'freight and coach load both contribute to generated demand'
);

select lives_ok(
  $$
    update public.port_calls
    set demand_profile_id = '93000000-0000-4000-8000-000000000008'
    where id = '93000000-0000-4000-8000-000000000013'
  $$,
  'changing only the demand profile no longer collides on source revision'
);

select is(
  (
    select requirement.required_agents::integer
    from public.staffing_requirements requirement
    where requirement.planning_period_id =
      '93000000-0000-4000-8000-000000000011'
      and requirement.port_call_id =
        '93000000-0000-4000-8000-000000000013'
      and requirement.retired_at is null
  ),
  1,
  'legacy profile rows with null freight/coach divisors remain compatible'
);

select is(
  (
    select count(*)::integer
    from public.port_call_revisions revision
    where revision.port_call_id =
      '93000000-0000-4000-8000-000000000013'
      and revision.source_revision = '10'
      and revision.revision_kind = 'demand_profile'
  ),
  1,
  'demand-profile changes have a distinct revision kind'
);

update public.port_calls
set demand_profile_id = '93000000-0000-4000-8000-000000000007'
where id = '93000000-0000-4000-8000-000000000013';

-- Keep one agent sufficient for the publication fixture after having tested
-- the full load formula.
update public.staffing_requirements
set required_agents = 1
where planning_period_id = '93000000-0000-4000-8000-000000000011'
  and port_call_id = '93000000-0000-4000-8000-000000000013'
  and retired_at is null;

select lives_ok(
  format(
    $command$
      select public.create_planning_shift(
        %L::uuid,
        '93000000-0000-4000-8000-000000000005'::uuid,
        timestamptz '2032-01-11 21:00:00+00',
        timestamptz '2032-01-12 05:00:00+00',
        0,
        '93000000-0000-4000-8000-000000000004'::uuid,
        '93000000-0000-4000-8000-000000000013'::uuid,
        'Sunday night'
      )
    $command$,
    (
      select schedule.id
      from public.schedule_versions schedule
      where schedule.planning_period_id =
        '93000000-0000-4000-8000-000000000011'
        and schedule.status = 'draft'
        and schedule.superseded_at is null
      order by schedule.version_number desc
      limit 1
    )
  ),
  'a Sunday-night shift may end on the following Monday'
);

update public.shift_assignments assignment
set staffing_requirement_id = (
  select requirement.id
  from public.staffing_requirements requirement
  where requirement.planning_period_id =
    '93000000-0000-4000-8000-000000000011'
    and requirement.port_call_id =
      '93000000-0000-4000-8000-000000000013'
    and requirement.retired_at is null
)
from public.planning_shifts shift
where shift.id = assignment.planning_shift_id
  and shift.schedule_version_id = (
    select schedule.id
    from public.schedule_versions schedule
    where schedule.planning_period_id =
      '93000000-0000-4000-8000-000000000011'
      and schedule.status = 'draft'
      and schedule.superseded_at is null
  );

select throws_ok(
  format(
    $command$
      select public.create_planning_shift(
        %L::uuid,
        '93000000-0000-4000-8000-000000000005'::uuid,
        timestamptz '2032-01-10 21:00:00+00',
        timestamptz '2032-01-12 05:00:00+00',
        0,
        '93000000-0000-4000-8000-000000000004'::uuid,
        null,
        'Invalid multi-day overflow'
      )
    $command$,
    (
      select schedule.id
      from public.schedule_versions schedule
      where schedule.planning_period_id =
        '93000000-0000-4000-8000-000000000011'
        and schedule.status = 'draft'
        and schedule.superseded_at is null
      order by schedule.version_number desc
      limit 1
    )
  ),
  'Shift is outside the planning period',
  'the Sunday exception cannot hide a Saturday-to-Monday overflow'
);

select lives_ok(
  format(
    $command$
      select public.publish_schedule_version(
        %L::uuid,
        'Publication Sunday night'
      )
    $command$,
    (
      select schedule.id
      from public.schedule_versions schedule
      where schedule.planning_period_id =
        '93000000-0000-4000-8000-000000000011'
        and schedule.status = 'draft'
        and schedule.superseded_at is null
      order by schedule.version_number desc
      limit 1
    )
  ),
  'publication validation accepts the same Sunday-night boundary'
);

select is(
  (
    select manifest.capture_kind
    from public.schedule_requirement_snapshot_manifests manifest
    join public.schedule_versions schedule
      on schedule.id = manifest.schedule_version_id
    where schedule.planning_period_id =
      '93000000-0000-4000-8000-000000000011'
      and schedule.status = 'published'
  ),
  'publication',
  'publication captures an explicitly versioned requirement manifest'
);

select is(
  (
    select manifest.requirement_count
    from public.schedule_requirement_snapshot_manifests manifest
    join public.schedule_versions schedule
      on schedule.id = manifest.schedule_version_id
    where schedule.planning_period_id =
      '93000000-0000-4000-8000-000000000011'
      and schedule.status = 'published'
  ),
  1,
  'the snapshot manifest records the exact row count'
);

select is(
  (
    select requirement.required_agents::integer
    from public.get_schedule_requirements(
      (
        select schedule.id
        from public.schedule_versions schedule
        where schedule.planning_period_id =
          '93000000-0000-4000-8000-000000000011'
          and schedule.status = 'published'
      )
    ) requirement
  ),
  1,
  'published reads use the frozen requirement value'
);

select is(
  (
    select requirement.is_snapshot
    from public.get_schedule_requirements(
      (
        select schedule.id
        from public.schedule_versions schedule
        where schedule.planning_period_id =
          '93000000-0000-4000-8000-000000000011'
          and schedule.status = 'published'
      )
    ) requirement
  ),
  true,
  'the export read path identifies published snapshot rows'
);

select throws_ok(
  $$
    update public.schedule_requirement_snapshots
    set required_agents = 2
    where schedule_version_id = (
      select schedule.id
      from public.schedule_versions schedule
      where schedule.planning_period_id =
        '93000000-0000-4000-8000-000000000011'
        and schedule.status = 'published'
    )
  $$,
  'P2070',
  'Published requirement snapshots are immutable.',
  'snapshot rows cannot be rewritten even by a privileged migration role'
);

-- A second published week makes the monthly aggregation and both sides of a
-- cross-period maritime move observable.
select public.ensure_editable_schedule_for_period(
  '93000000-0000-4000-8000-000000000012'
);

select public.create_planning_shift(
  (
    select schedule.id
    from public.schedule_versions schedule
    where schedule.planning_period_id =
      '93000000-0000-4000-8000-000000000012'
      and schedule.status = 'draft'
      and schedule.superseded_at is null
    order by schedule.version_number desc
    limit 1
  ),
  '93000000-0000-4000-8000-000000000005',
  timestamptz '2032-01-14 11:00:00+00',
  timestamptz '2032-01-14 13:00:00+00',
  0,
  '93000000-0000-4000-8000-000000000004',
  null,
  'Second week'
);

select public.publish_schedule_version(
  (
    select schedule.id
    from public.schedule_versions schedule
    where schedule.planning_period_id =
      '93000000-0000-4000-8000-000000000012'
      and schedule.status = 'draft'
      and schedule.superseded_at is null
    order by schedule.version_number desc
    limit 1
  ),
  'Publication second week'
);

select is(
  (
    public.get_agent_hour_balance(
      '93000000-0000-4000-8000-000000000005',
      date '2032-01-05',
      (
        select schedule.id
        from public.schedule_versions schedule
        where schedule.planning_period_id =
          '93000000-0000-4000-8000-000000000011'
          and schedule.status = 'published'
      )
    ) ->> 'scheduledMonthMinutes'
  )::integer,
  600,
  'monthly scheduled time aggregates published schedules across weeks'
);

select lives_ok(
  $$
    select public.update_port_call_timing(
      '93000000-0000-4000-8000-000000000013',
      timestamptz '2032-01-11 19:15:00+00',
      timestamptz '2032-01-11 21:15:00+00',
      'delayed',
      'corsica-linea-feed',
      '11',
      11,
      '10',
      clock_timestamp()
    )
  $$,
  'ordered maritime update accepts the next sequence with matching CAS'
);

select is(
  (
    select port_call.source_sequence
    from public.port_calls port_call
    where port_call.id = '93000000-0000-4000-8000-000000000013'
  ),
  11::bigint,
  'the accepted maritime sequence is stored on the call'
);

select is(
  (
    select cursor.last_sequence
    from public.port_call_source_cursors cursor
    where cursor.port_call_id =
      '93000000-0000-4000-8000-000000000013'
      and cursor.source = 'corsica-linea-feed'
  ),
  11::bigint,
  'the per-source cursor advances atomically'
);

select throws_ok(
  $$
    select public.update_port_call_timing(
      '93000000-0000-4000-8000-000000000013',
      timestamptz '2032-01-11 19:00:00+00',
      timestamptz '2032-01-11 21:00:00+00',
      'scheduled',
      'corsica-linea-feed',
      '9',
      9,
      '11',
      clock_timestamp()
    )
  $$,
  'P2062',
  'Stale maritime sequence rejected (9 <= 11).',
  'an older unseen replay is rejected by the retained source cursor'
);

select throws_ok(
  $$
    select public.update_port_call_timing(
      '93000000-0000-4000-8000-000000000013',
      timestamptz '2032-01-11 19:30:00+00',
      timestamptz '2032-01-11 21:30:00+00',
      'delayed',
      'corsica-linea-feed',
      '12',
      12,
      'stale-cas',
      clock_timestamp()
    )
  $$,
  'P2063',
  'Port call changed concurrently (expected source revision stale-cas, current source revision 11).',
  'compare-and-swap rejects a concurrent maritime update'
);

select throws_ok(
  $$
    select public.update_port_call_timing(
      '93000000-0000-4000-8000-000000000013',
      timestamptz '2032-01-11 19:30:00+00',
      timestamptz '2032-01-11 21:30:00+00',
      'delayed',
      'tools-panel',
      null
    )
  $$,
  'P2061',
  'Lower-priority maritime source rejected (100 < 200).',
  'a lower-priority source cannot overwrite the active feed'
);

select is(
  (
    public.update_port_call_timing(
      '93000000-0000-4000-8000-000000000013',
      timestamptz '2032-01-11 19:15:00+00',
      timestamptz '2032-01-11 21:15:00+00',
      'delayed',
      'corsica-linea-feed',
      '11',
      11,
      'obsolete-token-is-ignored-for-exact-replay',
      clock_timestamp()
    ) ->> 'duplicateRevision'
  )::boolean,
  true,
  'an exact replay remains idempotent'
);

select lives_ok(
  $$
    select public.override_port_call_timing(
      '93000000-0000-4000-8000-000000000013',
      timestamptz '2032-01-11 19:00:00+00',
      timestamptz '2032-01-11 21:00:00+00',
      'scheduled',
      'tools-panel',
      'operator-override-1',
      '11',
      'Correction opérationnelle confirmée par le chef d’escale',
      clock_timestamp() + interval '1 hour'
    )
  $$,
  'a planning administrator can apply a bounded CAS override'
);

select is(
  (
    select port_call.source
    from public.port_calls port_call
    where port_call.id = '93000000-0000-4000-8000-000000000013'
  ),
  'tools-panel',
  'the bounded operational override temporarily becomes authoritative'
);

select ok(
  exists (
    select 1
    from public.port_call_source_overrides source_override
    where source_override.port_call_id =
      '93000000-0000-4000-8000-000000000013'
      and source_override.reason =
        'Correction opérationnelle confirmée par le chef d’escale'
      and source_override.valid_until > clock_timestamp()
      and source_override.resumed_at is null
  ),
  'the override reason and bounded validity are durably audited'
);

select lives_ok(
  $$
    select public.update_port_call_timing(
      '93000000-0000-4000-8000-000000000013',
      timestamptz '2032-01-12 19:00:00+00',
      timestamptz '2032-01-12 21:00:00+00',
      'delayed',
      'corsica-linea-feed',
      '12',
      12,
      'operator-override-1',
      clock_timestamp()
    )
  $$,
  'an ordered timing update can move an escale into another week'
);

select is(
  (
    select port_call.source_override_until
    from public.port_calls port_call
    where port_call.id = '93000000-0000-4000-8000-000000000013'
  ),
  null::timestamptz,
  'a higher-priority ordered feed automatically ends the override'
);

select is(
  (
    select source_override.resumed_by_source
    from public.port_call_source_overrides source_override
    where source_override.port_call_id =
      '93000000-0000-4000-8000-000000000013'
    order by source_override.created_at desc
    limit 1
  ),
  'corsica-linea-feed',
  'the automatic source resumption is recorded on the override audit row'
);

select is(
  (
    select count(*)::integer
    from public.staffing_requirements requirement
    where requirement.planning_period_id =
      '93000000-0000-4000-8000-000000000011'
      and requirement.port_call_id =
        '93000000-0000-4000-8000-000000000013'
      and requirement.retired_at is null
  ),
  0,
  'the former week has no active requirement after the move'
);

select is(
  (
    select count(*)::integer
    from public.staffing_requirements requirement
    where requirement.planning_period_id =
      '93000000-0000-4000-8000-000000000011'
      and requirement.port_call_id =
        '93000000-0000-4000-8000-000000000013'
      and requirement.retired_at is not null
  ),
  1,
  'a referenced former requirement is retained only as retired history'
);

select is(
  (
    select count(*)::integer
    from public.staffing_requirements requirement
    where requirement.planning_period_id =
      '93000000-0000-4000-8000-000000000012'
      and requirement.port_call_id =
        '93000000-0000-4000-8000-000000000013'
      and requirement.retired_at is null
  ),
  1,
  'the destination week receives the active generated requirement'
);

select is(
  (
    select count(*)::integer
    from public.replanning_scenarios scenario
    where scenario.disruption_event_id = (
      select disruption.id
      from public.disruption_events disruption
      where disruption.port_call_id =
        '93000000-0000-4000-8000-000000000013'
        and disruption.source_revision = '12'
    )
  ),
  2,
  'cross-week movement creates one scenario for each published period'
);

select is(
  (
    select count(distinct scenario.base_schedule_version_id)::integer
    from public.replanning_scenarios scenario
    where scenario.disruption_event_id = (
      select disruption.id
      from public.disruption_events disruption
      where disruption.port_call_id =
        '93000000-0000-4000-8000-000000000013'
        and disruption.source_revision = '12'
    )
  ),
  2,
  'old and new published schedule versions are both represented'
);

select ok(
  exists (
    select 1
    from public.replanning_impacts impact
    join public.replanning_scenarios scenario
      on scenario.id = impact.scenario_id
    where scenario.disruption_event_id = (
      select disruption.id
      from public.disruption_events disruption
      where disruption.port_call_id =
        '93000000-0000-4000-8000-000000000013'
        and disruption.source_revision = '12'
    )
      and impact.impact_type = 'assignment.time_shift'
  ),
  'the former publication exposes its concrete assignment impact'
);

select ok(
  exists (
    select 1
    from public.replanning_impacts impact
    join public.replanning_scenarios scenario
      on scenario.id = impact.scenario_id
    where scenario.disruption_event_id = (
      select disruption.id
      from public.disruption_events disruption
      where disruption.port_call_id =
        '93000000-0000-4000-8000-000000000013'
        and disruption.source_revision = '12'
    )
      and impact.impact_type = 'coverage.requirement_changed'
  ),
  'the destination publication exposes its new coverage impact'
);

select is(
  (
    select count(*)::integer
    from public.get_schedule_requirements(
      (
        select schedule.id
        from public.schedule_versions schedule
        where schedule.planning_period_id =
          '93000000-0000-4000-8000-000000000011'
          and schedule.status = 'published'
      )
    ) requirement
    where requirement.starts_at = timestamptz '2032-01-11 21:00:00+00'
  ),
  1,
  'the old published export still returns its original frozen requirement'
);

select is(
  (
    select count(*)::integer
    from public.schedule_version_coverage_gaps(
      (
        select schedule.id
        from public.schedule_versions schedule
        where schedule.planning_period_id =
          '93000000-0000-4000-8000-000000000011'
          and schedule.status = 'published'
      )
    )
  ),
  0,
  'coverage validation for published history uses its frozen requirement'
);

-- The destination now needs one of the moved agents. Approving either sibling
-- must prepare both period candidates as one change-set.
update public.staffing_requirements requirement
set required_agents = 1
where requirement.planning_period_id =
  '93000000-0000-4000-8000-000000000012'
  and requirement.port_call_id =
    '93000000-0000-4000-8000-000000000013'
  and requirement.retired_at is null;

select lives_ok(
  format(
    $command$
      select public.approve_replanning_scenario(
        %L::uuid,
        'Transfert coordonné entre les deux semaines'
      )
    $command$,
    (
      select scenario.id
      from public.replanning_scenarios scenario
      join public.schedule_versions base
        on base.id = scenario.base_schedule_version_id
      where scenario.disruption_event_id = (
        select disruption.id
        from public.disruption_events disruption
        where disruption.port_call_id =
          '93000000-0000-4000-8000-000000000013'
          and disruption.source_revision = '12'
      )
        and base.planning_period_id =
          '93000000-0000-4000-8000-000000000011'
    )
  ),
  'approving one sibling prepares the complete cross-period change-set'
);

select is(
  (
    select count(*)::integer
    from public.replanning_scenarios scenario
    where scenario.disruption_event_id = (
      select disruption.id
      from public.disruption_events disruption
      where disruption.port_call_id =
        '93000000-0000-4000-8000-000000000013'
        and disruption.source_revision = '12'
    )
      and scenario.status = 'approved'
      and scenario.candidate_schedule_version_id is not null
  ),
  2,
  'both period scenarios are approved together'
);

select is(
  (
    select count(*)::integer
    from public.replanning_scenarios scenario
    where scenario.disruption_event_id = (
      select disruption.id
      from public.disruption_events disruption
      where disruption.port_call_id =
        '93000000-0000-4000-8000-000000000013'
        and disruption.source_revision = '12'
    )
      and scenario.candidate_lock_version is not null
  ),
  2,
  'approval stores a CAS token for every candidate'
);

select is(
  (
    select count(*)::integer
    from public.shift_assignments assignment
    join public.planning_shifts shift
      on shift.id = assignment.planning_shift_id
    join public.replanning_scenarios scenario
      on scenario.candidate_schedule_version_id = shift.schedule_version_id
    join public.schedule_versions base
      on base.id = scenario.base_schedule_version_id
    where scenario.disruption_event_id = (
      select disruption.id
      from public.disruption_events disruption
      where disruption.port_call_id =
        '93000000-0000-4000-8000-000000000013'
        and disruption.source_revision = '12'
    )
      and base.planning_period_id =
        '93000000-0000-4000-8000-000000000011'
      and assignment.port_call_id =
        '93000000-0000-4000-8000-000000000013'
  ),
  0,
  'the source-period candidate removes the moved assignment'
);

select is(
  (
    select count(*)::integer
    from public.shift_assignments assignment
    join public.planning_shifts shift
      on shift.id = assignment.planning_shift_id
    join public.replanning_scenarios scenario
      on scenario.candidate_schedule_version_id = shift.schedule_version_id
    join public.schedule_versions base
      on base.id = scenario.base_schedule_version_id
    where scenario.disruption_event_id = (
      select disruption.id
      from public.disruption_events disruption
      where disruption.port_call_id =
        '93000000-0000-4000-8000-000000000013'
        and disruption.source_revision = '12'
    )
      and base.planning_period_id =
        '93000000-0000-4000-8000-000000000012'
      and assignment.port_call_id =
        '93000000-0000-4000-8000-000000000013'
      and (assignment.starts_at at time zone 'Europe/Paris')::date =
        date '2032-01-12'
  ),
  1,
  'the destination-period candidate receives the moved assignment'
);

-- Each candidate is valid against the still-published version of the sibling
-- week, yet the two candidates together violate the 11-hour Sunday/Monday
-- rest boundary. Publication must detect the union before archiving anything.
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
  note,
  created_by
)
select
  '93000000-0000-4000-8000-000000000020',
  scenario.organization_id,
  scenario.site_id,
  scenario.candidate_schedule_version_id,
  '93000000-0000-4000-8000-000000000005',
  timestamptz '2032-01-11 22:00:00+00',
  timestamptz '2032-01-12 09:00:00+00',
  0,
  'replanned',
  'Sunday boundary candidate',
  '93000000-0000-4000-8000-000000000003'
from public.replanning_scenarios scenario
join public.schedule_versions base
  on base.id = scenario.base_schedule_version_id
where scenario.disruption_event_id = (
    select disruption.id
    from public.disruption_events disruption
    where disruption.port_call_id =
      '93000000-0000-4000-8000-000000000013'
      and disruption.source_revision = '12'
  )
  and base.planning_period_id =
    '93000000-0000-4000-8000-000000000011';

insert into public.shift_assignments (
  organization_id,
  site_id,
  planning_shift_id,
  position_id,
  starts_at,
  ends_at
) values (
  '93000000-0000-4000-8000-000000000001',
  '93000000-0000-4000-8000-000000000002',
  '93000000-0000-4000-8000-000000000020',
  '93000000-0000-4000-8000-000000000004',
  timestamptz '2032-01-11 22:00:00+00',
  timestamptz '2032-01-12 09:00:00+00'
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
  note,
  created_by
)
select
  '93000000-0000-4000-8000-000000000021',
  scenario.organization_id,
  scenario.site_id,
  scenario.candidate_schedule_version_id,
  '93000000-0000-4000-8000-000000000005',
  timestamptz '2032-01-12 16:00:00+00',
  timestamptz '2032-01-12 18:00:00+00',
  0,
  'replanned',
  'Monday boundary candidate',
  '93000000-0000-4000-8000-000000000003'
from public.replanning_scenarios scenario
join public.schedule_versions base
  on base.id = scenario.base_schedule_version_id
where scenario.disruption_event_id = (
    select disruption.id
    from public.disruption_events disruption
    where disruption.port_call_id =
      '93000000-0000-4000-8000-000000000013'
      and disruption.source_revision = '12'
  )
  and base.planning_period_id =
    '93000000-0000-4000-8000-000000000012';

insert into public.shift_assignments (
  organization_id,
  site_id,
  planning_shift_id,
  position_id,
  starts_at,
  ends_at
) values (
  '93000000-0000-4000-8000-000000000001',
  '93000000-0000-4000-8000-000000000002',
  '93000000-0000-4000-8000-000000000021',
  '93000000-0000-4000-8000-000000000004',
  timestamptz '2032-01-12 16:00:00+00',
  timestamptz '2032-01-12 18:00:00+00'
);

update public.replanning_scenarios scenario
set candidate_lock_version = candidate.lock_version
from public.schedule_versions candidate
where candidate.id = scenario.candidate_schedule_version_id
  and scenario.disruption_event_id = (
    select disruption.id
    from public.disruption_events disruption
    where disruption.port_call_id =
      '93000000-0000-4000-8000-000000000013'
      and disruption.source_revision = '12'
  );

select lives_ok(
  format(
    'select public.validate_schedule_version_integrity(%L::uuid)',
    (
      select scenario.candidate_schedule_version_id
      from public.replanning_scenarios scenario
      join public.schedule_versions base
        on base.id = scenario.base_schedule_version_id
      where scenario.disruption_event_id = (
        select disruption.id
        from public.disruption_events disruption
        where disruption.port_call_id =
          '93000000-0000-4000-8000-000000000013'
          and disruption.source_revision = '12'
      )
        and base.planning_period_id =
          '93000000-0000-4000-8000-000000000011'
    )
  ),
  'the Sunday candidate is individually valid against current publications'
);

select lives_ok(
  format(
    'select public.validate_schedule_version_integrity(%L::uuid)',
    (
      select scenario.candidate_schedule_version_id
      from public.replanning_scenarios scenario
      join public.schedule_versions base
        on base.id = scenario.base_schedule_version_id
      where scenario.disruption_event_id = (
        select disruption.id
        from public.disruption_events disruption
        where disruption.port_call_id =
          '93000000-0000-4000-8000-000000000013'
          and disruption.source_revision = '12'
      )
        and base.planning_period_id =
          '93000000-0000-4000-8000-000000000012'
    )
  ),
  'the Monday candidate is individually valid against current publications'
);

select throws_ok(
  format(
    $command$
      select public.publish_schedule_version(
        %L::uuid,
        'Publication frontière invalide'
      )
    $command$,
    (
      select scenario.candidate_schedule_version_id
      from public.replanning_scenarios scenario
      join public.schedule_versions base
        on base.id = scenario.base_schedule_version_id
      where scenario.disruption_event_id = (
        select disruption.id
        from public.disruption_events disruption
        where disruption.port_call_id =
          '93000000-0000-4000-8000-000000000013'
          and disruption.source_revision = '12'
      )
        and base.planning_period_id =
          '93000000-0000-4000-8000-000000000011'
    )
  ),
  'P2002',
  'Repos quotidien insuffisant : 11 heures consécutives sont requises.',
  'set-based publication rejects a Sunday/Monday cross-candidate violation'
);

select is(
  (
    select count(*)::integer
    from public.schedule_versions schedule
    where schedule.planning_period_id in (
      '93000000-0000-4000-8000-000000000011',
      '93000000-0000-4000-8000-000000000012'
    )
      and schedule.status = 'published'
  ),
  2,
  'set validation fails before either prior publication is archived'
);

delete from public.shift_assignments assignment
where assignment.planning_shift_id in (
  '93000000-0000-4000-8000-000000000020',
  '93000000-0000-4000-8000-000000000021'
);

delete from public.planning_shifts shift
where shift.id in (
  '93000000-0000-4000-8000-000000000020',
  '93000000-0000-4000-8000-000000000021'
);

update public.replanning_scenarios scenario
set candidate_lock_version = candidate.lock_version
from public.schedule_versions candidate
where candidate.id = scenario.candidate_schedule_version_id
  and scenario.disruption_event_id = (
    select disruption.id
    from public.disruption_events disruption
    where disruption.port_call_id =
      '93000000-0000-4000-8000-000000000013'
      and disruption.source_revision = '12'
  );

-- Any edit after approval invalidates the all-period CAS. The failed publish
-- must leave both original commitments published.
update public.planning_shifts shift
set note = 'Concurrent edit after approval'
from public.replanning_scenarios scenario
join public.schedule_versions base
  on base.id = scenario.base_schedule_version_id
where shift.schedule_version_id = scenario.candidate_schedule_version_id
  and scenario.disruption_event_id = (
    select disruption.id
    from public.disruption_events disruption
    where disruption.port_call_id =
      '93000000-0000-4000-8000-000000000013'
      and disruption.source_revision = '12'
  )
  and base.planning_period_id =
    '93000000-0000-4000-8000-000000000012'
  and shift.starts_at = (
    select max(candidate_shift.starts_at)
    from public.planning_shifts candidate_shift
    where candidate_shift.schedule_version_id =
      scenario.candidate_schedule_version_id
  );

select throws_ok(
  format(
    $command$
      select public.publish_schedule_version(
        %L::uuid,
        'Publication coordonnée'
      )
    $command$,
    (
      select scenario.candidate_schedule_version_id
      from public.replanning_scenarios scenario
      join public.schedule_versions base
        on base.id = scenario.base_schedule_version_id
      where scenario.disruption_event_id = (
        select disruption.id
        from public.disruption_events disruption
        where disruption.port_call_id =
          '93000000-0000-4000-8000-000000000013'
          and disruption.source_revision = '12'
      )
        and base.planning_period_id =
          '93000000-0000-4000-8000-000000000011'
    )
  ),
  'P2031',
  (
    select format(
      'Replanning candidate %s changed after approval (expected version %s, current version %s).',
      candidate.id,
      scenario.candidate_lock_version,
      candidate.lock_version
    )
    from public.replanning_scenarios scenario
    join public.schedule_versions candidate
      on candidate.id = scenario.candidate_schedule_version_id
    join public.schedule_versions base
      on base.id = scenario.base_schedule_version_id
    where scenario.disruption_event_id = (
      select disruption.id
      from public.disruption_events disruption
      where disruption.port_call_id =
        '93000000-0000-4000-8000-000000000013'
        and disruption.source_revision = '12'
    )
      and base.planning_period_id =
        '93000000-0000-4000-8000-000000000012'
  ),
  'publication rejects any candidate changed after coordinated approval'
);

select is(
  (
    select count(*)::integer
    from public.schedule_versions schedule
    where schedule.planning_period_id in (
      '93000000-0000-4000-8000-000000000011',
      '93000000-0000-4000-8000-000000000012'
    )
      and schedule.status = 'published'
  ),
  2,
  'a failed coordinated publication leaves both prior commitments untouched'
);

-- Simulate an explicit renewed approval after reviewing the concurrent note.
update public.replanning_scenarios scenario
set candidate_lock_version = candidate.lock_version
from public.schedule_versions candidate
where candidate.id = scenario.candidate_schedule_version_id
  and scenario.disruption_event_id = (
    select disruption.id
    from public.disruption_events disruption
    where disruption.port_call_id =
      '93000000-0000-4000-8000-000000000013'
      and disruption.source_revision = '12'
  );

select lives_ok(
  format(
    $command$
      select public.publish_schedule_version(
        %L::uuid,
        'Publication coordonnée après revue'
      )
    $command$,
    (
      select scenario.candidate_schedule_version_id
      from public.replanning_scenarios scenario
      join public.schedule_versions base
        on base.id = scenario.base_schedule_version_id
      where scenario.disruption_event_id = (
        select disruption.id
        from public.disruption_events disruption
        where disruption.port_call_id =
          '93000000-0000-4000-8000-000000000013'
          and disruption.source_revision = '12'
      )
        and base.planning_period_id =
          '93000000-0000-4000-8000-000000000011'
    )
  ),
  'publishing one candidate atomically publishes the whole reviewed change-set'
);

select is(
  (
    select count(*)::integer
    from public.replanning_scenarios scenario
    where scenario.disruption_event_id = (
      select disruption.id
      from public.disruption_events disruption
      where disruption.port_call_id =
        '93000000-0000-4000-8000-000000000013'
        and disruption.source_revision = '12'
    )
      and scenario.status = 'applied'
  ),
  2,
  'both sibling scenarios become applied in the same transaction'
);

select ok(
  (
    select count(*) = 0
    from public.shift_assignments assignment
    join public.planning_shifts shift
      on shift.id = assignment.planning_shift_id
    join public.schedule_versions schedule
      on schedule.id = shift.schedule_version_id
    where schedule.planning_period_id =
      '93000000-0000-4000-8000-000000000011'
      and schedule.status = 'published'
      and assignment.port_call_id =
        '93000000-0000-4000-8000-000000000013'
  )
  and (
    select count(*) = 1
    from public.shift_assignments assignment
    join public.planning_shifts shift
      on shift.id = assignment.planning_shift_id
    join public.schedule_versions schedule
      on schedule.id = shift.schedule_version_id
    where schedule.planning_period_id =
      '93000000-0000-4000-8000-000000000012'
      and schedule.status = 'published'
      and assignment.port_call_id =
        '93000000-0000-4000-8000-000000000013'
  ),
  'the new published truth contains the assignment only in its destination week'
);

select ok(
  (
    select count(*) = 2
      and bool_and(
        jsonb_array_length(
          event.payload -> 'coordinatedScheduleVersionIds'
        ) = 2
      )
    from public.outbox_events event
    join public.replanning_scenarios scenario
      on scenario.candidate_schedule_version_id = event.aggregate_id
    where scenario.disruption_event_id = (
      select disruption.id
      from public.disruption_events disruption
      where disruption.port_call_id =
        '93000000-0000-4000-8000-000000000013'
        and disruption.source_revision = '12'
    )
      and event.topic = 'planning.schedule.published'
  ),
  'every coordinated publication event contains the complete change-set'
);

select is(
  (
    select count(*)::integer
    from public.schedule_requirement_snapshot_manifests manifest
    where manifest.capture_kind = 'publication'
      and manifest.organization_id =
        '93000000-0000-4000-8000-000000000001'
  ),
  4,
  'each initial and coordinated publication keeps its immutable manifest'
);

select is(
  (
    select count(*)::integer
    from public.port_call_revisions revision
    where revision.port_call_id =
      '93000000-0000-4000-8000-000000000013'
      and revision.revision_kind = 'source'
      and revision.source_revision in ('11', '12')
  ),
  2,
  'accepted ordered source revisions are recorded exactly once'
);

-- A single escale can anchor demand on both sides of an ISO-week boundary.
insert into public.demand_profiles (
  id,
  organization_id,
  site_id,
  code,
  name,
  version
) values (
  '93000000-0000-4000-8000-000000000030',
  '93000000-0000-4000-8000-000000000001',
  '93000000-0000-4000-8000-000000000002',
  'ENG-DUAL',
  'Dual-anchor profile',
  1
);

insert into public.demand_profile_lines (
  id,
  organization_id,
  site_id,
  demand_profile_id,
  position_id,
  anchor,
  starts_offset_minutes,
  duration_minutes,
  base_agents,
  minimum_agents,
  maximum_agents
) values
  (
    '93000000-0000-4000-8000-000000000031',
    '93000000-0000-4000-8000-000000000001',
    '93000000-0000-4000-8000-000000000002',
    '93000000-0000-4000-8000-000000000030',
    '93000000-0000-4000-8000-000000000004',
    'arrival',
    0,
    60,
    1,
    1,
    5
  ),
  (
    '93000000-0000-4000-8000-000000000032',
    '93000000-0000-4000-8000-000000000001',
    '93000000-0000-4000-8000-000000000002',
    '93000000-0000-4000-8000-000000000030',
    '93000000-0000-4000-8000-000000000004',
    'departure',
    0,
    60,
    1,
    1,
    5
  );

select lives_ok(
  $$
    insert into public.port_calls (
      id,
      organization_id,
      site_id,
      vessel_id,
      external_reference,
      status,
      scheduled_arrival_at,
      scheduled_departure_at,
      source,
      source_revision,
      demand_profile_id
    ) values (
      '93000000-0000-4000-8000-000000000033',
      '93000000-0000-4000-8000-000000000001',
      '93000000-0000-4000-8000-000000000002',
      '93000000-0000-4000-8000-000000000006',
      'ENG-DUAL-CALL',
      'scheduled',
      timestamptz '2032-01-11 21:30:00+00',
      timestamptz '2032-01-12 00:30:00+00',
      ' Corsica-Linea-Feed ',
      ' 20 ',
      '93000000-0000-4000-8000-000000000030'
    )
  $$,
  'insert provisioning accepts an arrival Sunday and departure Monday'
);

select ok(
  (
    select port_call.source = 'corsica-linea-feed'
      and port_call.source_revision = '20'
      and port_call.source_sequence = 20
      and port_call.timing_lock_version = 0
      and port_call.timing_payload_fingerprint ~ '^[0-9a-f]{32}$'
    from public.port_calls port_call
    where port_call.id = '93000000-0000-4000-8000-000000000033'
  ),
  'insert normalizes and fingerprints all maritime source metadata'
);

select ok(
  exists (
    select 1
    from public.staffing_requirements requirement
    where requirement.port_call_id =
      '93000000-0000-4000-8000-000000000033'
      and requirement.planning_period_id =
        '93000000-0000-4000-8000-000000000011'
      and requirement.demand_profile_line_id =
        '93000000-0000-4000-8000-000000000031'
      and requirement.retired_at is null
  )
  and exists (
    select 1
    from public.staffing_requirements requirement
    where requirement.port_call_id =
      '93000000-0000-4000-8000-000000000033'
      and requirement.planning_period_id =
        '93000000-0000-4000-8000-000000000012'
      and requirement.demand_profile_line_id =
        '93000000-0000-4000-8000-000000000032'
      and requirement.retired_at is null
  ),
  'arrival and departure demand lines are generated in their own weeks'
);

select lives_ok(
  $$
    select public.update_port_call_timing(
      '93000000-0000-4000-8000-000000000033',
      timestamptz '2032-01-11 21:45:00+00',
      timestamptz '2032-01-12 00:45:00+00',
      'delayed',
      ' CORSICA-LINEA-FEED ',
      ' 21 ',
      21,
      '20',
      clock_timestamp(),
      0
    )
  $$,
  'timing-lock CAS accepts the next dual-anchor source event'
);

select is(
  (
    select port_call.timing_lock_version
    from public.port_calls port_call
    where port_call.id = '93000000-0000-4000-8000-000000000033'
  ),
  1::bigint,
  'an accepted timing event advances the monotonic lock exactly once'
);

select is(
  (
    select count(*)::integer
    from public.replanning_scenarios scenario
    where scenario.disruption_event_id = (
      select disruption.id
      from public.disruption_events disruption
      where disruption.port_call_id =
        '93000000-0000-4000-8000-000000000033'
        and disruption.source_revision = '21'
    )
  ),
  2,
  'dual-anchor updates create scenarios for both touched publications'
);

select is(
  (
    select base.planning_period_id
    from public.outbox_events event
    join public.replanning_scenarios scenario
      on scenario.id = (event.payload -> 'scenarioIds' ->> 0)::uuid
    join public.schedule_versions base
      on base.id = scenario.base_schedule_version_id
    where event.topic = 'planning.port_call.disrupted'
      and event.aggregate_id = '93000000-0000-4000-8000-000000000033'
    order by event.created_at desc, event.id desc
    limit 1
  ),
  '93000000-0000-4000-8000-000000000011'::uuid,
  'scenarioIds are emitted in deterministic chronological period order'
);

select throws_ok(
  $$
    select public.update_port_call_timing(
      '93000000-0000-4000-8000-000000000033',
      timestamptz '2032-01-11 22:00:00+00',
      timestamptz '2032-01-12 00:45:00+00',
      'delayed',
      'corsica-linea-feed',
      '21',
      21,
      '21',
      clock_timestamp(),
      1
    )
  $$,
  'P2065',
  'Maritime revision/sequence collision with a different payload.',
  'a reused source identity with different timing is rejected as collision'
);

select is(
  (
    public.update_port_call_timing(
      '93000000-0000-4000-8000-000000000033',
      timestamptz '2032-01-11 21:45:00+00',
      timestamptz '2032-01-12 00:45:00+00',
      'delayed',
      'corsica-linea-feed',
      '21',
      21,
      'stale-revision-token',
      clock_timestamp(),
      0
    ) ->> 'duplicateRevision'
  )::boolean,
  true,
  'only a byte-equivalent normalized timing payload is an exact replay'
);

-- Counter fixtures: a January contract change and primary group change are
-- prorated day by day; a Jan/Feb boundary shift allocates its break pro rata.
insert into public.agents (
  id,
  organization_id,
  primary_site_id,
  employee_number,
  display_name,
  active,
  hired_on
) values (
  '93000000-0000-4000-8000-000000000050',
  '93000000-0000-4000-8000-000000000001',
  '93000000-0000-4000-8000-000000000002',
  'ENG-050',
  'Boundary counter agent',
  true,
  date '2032-01-01'
);

insert into public.agent_contract_versions (
  organization_id,
  agent_id,
  effective_from,
  effective_until,
  weekly_target_minutes,
  monthly_target_minutes,
  label
) values
  (
    '93000000-0000-4000-8000-000000000001',
    '93000000-0000-4000-8000-000000000050',
    date '2032-01-01',
    date '2032-01-15',
    2100,
    9000,
    'First half'
  ),
  (
    '93000000-0000-4000-8000-000000000001',
    '93000000-0000-4000-8000-000000000050',
    date '2032-01-16',
    null,
    4200,
    18000,
    'Second half'
  );

insert into public.agent_groups (
  id,
  organization_id,
  site_id,
  code,
  name,
  weekly_target_minutes,
  monthly_target_minutes
) values (
  '93000000-0000-4000-8000-000000000051',
  '93000000-0000-4000-8000-000000000001',
  '93000000-0000-4000-8000-000000000002',
  'ENG-GRP',
  'Effective target group',
  3500,
  31000
);

insert into public.agent_group_memberships (
  organization_id,
  group_id,
  agent_id,
  effective_from,
  is_primary
) values (
  '93000000-0000-4000-8000-000000000001',
  '93000000-0000-4000-8000-000000000051',
  '93000000-0000-4000-8000-000000000050',
  date '2032-01-16',
  true
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
  '93000000-0000-4000-8000-000000000052',
  '93000000-0000-4000-8000-000000000001',
  '93000000-0000-4000-8000-000000000002',
  'January boundary week',
  date '2032-01-26',
  date '2032-02-01',
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
  '93000000-0000-4000-8000-000000000053',
  '93000000-0000-4000-8000-000000000001',
  '93000000-0000-4000-8000-000000000002',
  '93000000-0000-4000-8000-000000000052',
  1,
  'draft',
  'Boundary counter schedule',
  '93000000-0000-4000-8000-000000000003'
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
  note,
  created_by
) values (
  '93000000-0000-4000-8000-000000000054',
  '93000000-0000-4000-8000-000000000001',
  '93000000-0000-4000-8000-000000000002',
  '93000000-0000-4000-8000-000000000053',
  '93000000-0000-4000-8000-000000000050',
  timestamptz '2032-01-31 22:00:00+00',
  timestamptz '2032-02-01 00:00:00+00',
  30,
  'manual',
  'Month boundary shift',
  '93000000-0000-4000-8000-000000000003'
);

insert into public.shift_assignments (
  organization_id,
  site_id,
  planning_shift_id,
  position_id,
  starts_at,
  ends_at
) values (
  '93000000-0000-4000-8000-000000000001',
  '93000000-0000-4000-8000-000000000002',
  '93000000-0000-4000-8000-000000000054',
  '93000000-0000-4000-8000-000000000004',
  timestamptz '2032-01-31 22:00:00+00',
  timestamptz '2032-02-01 00:00:00+00'
);

select is(
  (
    public.get_agent_hour_balance(
      '93000000-0000-4000-8000-000000000050',
      date '2032-01-26',
      '93000000-0000-4000-8000-000000000053'
    ) ->> 'scheduledMonthMinutes'
  )::integer,
  45,
  'a boundary service and its break are segmented at local month start/end'
);

select is(
  (
    public.get_agent_hour_balance(
      '93000000-0000-4000-8000-000000000050',
      date '2032-01-26',
      '93000000-0000-4000-8000-000000000053'
    ) ->> 'monthlyTargetMinutes'
  )::integer,
  20355,
  'monthly contract/group targets are prorated by effective calendar days'
);

select is(
  (
    public.get_agent_hour_balance(
      '93000000-0000-4000-8000-000000000050',
      date '2032-01-26',
      '93000000-0000-4000-8000-000000000053'
    ) ->> 'weeklyTargetMinutes'
  )::integer,
  3500,
  'the effective primary group supplies the requested week target'
);

select throws_ok(
  $$
    select public.get_agent_hour_balance(
      '93000000-0000-4000-8000-000000000050',
      date '2032-01-05',
      '93000000-0000-4000-8000-000000000053'
    )
  $$,
  'P2071',
  'Requested schedule version does not cover the requested week.',
  'an explicit schedule version must cover the complete requested week'
);

-- Exact requirement allocation: one null-linked assignment counts for none of
-- two simultaneous requirements instead of being multiplied across both.
insert into public.planning_periods (
  id,
  organization_id,
  site_id,
  name,
  starts_on,
  ends_on,
  timezone
) values (
  '93000000-0000-4000-8000-000000000040',
  '93000000-0000-4000-8000-000000000001',
  '93000000-0000-4000-8000-000000000002',
  'Coverage allocation week',
  date '2032-02-02',
  date '2032-02-08',
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
  '93000000-0000-4000-8000-000000000041',
  '93000000-0000-4000-8000-000000000001',
  '93000000-0000-4000-8000-000000000002',
  '93000000-0000-4000-8000-000000000040',
  1,
  'draft',
  'Coverage allocation schedule',
  '93000000-0000-4000-8000-000000000003'
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
) values
  (
    '93000000-0000-4000-8000-000000000042',
    '93000000-0000-4000-8000-000000000001',
    '93000000-0000-4000-8000-000000000002',
    '93000000-0000-4000-8000-000000000040',
    '93000000-0000-4000-8000-000000000004',
    timestamptz '2032-02-03 09:00:00+00',
    timestamptz '2032-02-03 11:00:00+00',
    1,
    'manual-a'
  ),
  (
    '93000000-0000-4000-8000-000000000043',
    '93000000-0000-4000-8000-000000000001',
    '93000000-0000-4000-8000-000000000002',
    '93000000-0000-4000-8000-000000000040',
    '93000000-0000-4000-8000-000000000004',
    timestamptz '2032-02-03 09:00:00+00',
    timestamptz '2032-02-03 11:00:00+00',
    1,
    'manual-b'
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
  note,
  created_by
) values (
  '93000000-0000-4000-8000-000000000044',
  '93000000-0000-4000-8000-000000000001',
  '93000000-0000-4000-8000-000000000002',
  '93000000-0000-4000-8000-000000000041',
  '93000000-0000-4000-8000-000000000050',
  timestamptz '2032-02-03 09:00:00+00',
  timestamptz '2032-02-03 11:00:00+00',
  0,
  'manual',
  'Unlinked coverage assignment',
  '93000000-0000-4000-8000-000000000003'
);

insert into public.shift_assignments (
  organization_id,
  site_id,
  planning_shift_id,
  position_id,
  staffing_requirement_id,
  starts_at,
  ends_at
) values (
  '93000000-0000-4000-8000-000000000001',
  '93000000-0000-4000-8000-000000000002',
  '93000000-0000-4000-8000-000000000044',
  '93000000-0000-4000-8000-000000000004',
  null,
  timestamptz '2032-02-03 09:00:00+00',
  timestamptz '2032-02-03 11:00:00+00'
);

select ok(
  (
    select count(*) = 2 and coalesce(sum(gap.assigned_agents), 0) = 0
    from public.schedule_version_coverage_gaps(
      '93000000-0000-4000-8000-000000000041'
    ) gap
  ),
  'an unlinked assignment cannot satisfy multiple simultaneous requirements'
);

select ok(
  not has_table_privilege(
    'authenticated',
    'public.schedule_requirement_snapshots',
    'INSERT'
  )
  and not has_table_privilege(
    'authenticated',
    'public.schedule_requirement_snapshots',
    'UPDATE'
  )
  and not has_table_privilege(
    'authenticated',
    'public.schedule_requirement_snapshots',
    'DELETE'
  ),
  'authenticated users have read-only snapshot privileges'
);

select ok(
  has_column_privilege(
    'authenticated',
    'public.port_calls',
    'demand_profile_id',
    'UPDATE'
  )
  and not has_column_privilege(
    'authenticated',
    'public.port_calls',
    'source_revision',
    'UPDATE'
  ),
  'direct port-call updates are narrowed to demand profile assignment'
);

select * from finish();
rollback;
