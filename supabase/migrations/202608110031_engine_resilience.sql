-- Make the planning engine resilient to mutable demand inputs, cross-week
-- maritime updates and out-of-order upstream messages. Existing RPC
-- signatures stay available; explicitly ordered maritime ingestion is exposed
-- as an additional overload.

-- Demand profiles created before this migration keep exactly the same result:
-- NULL divisors contribute zero extra agents.
alter table public.demand_profile_lines
  add column freight_units_per_extra_agent integer
    check (
      freight_units_per_extra_agent is null
      or freight_units_per_extra_agent > 0
    ),
  add column coaches_per_extra_agent integer
    check (
      coaches_per_extra_agent is null
      or coaches_per_extra_agent > 0
    );

-- Generated rows referenced by an immutable published assignment cannot be
-- physically deleted. Retiring them removes them from every live calculation
-- while preserving the historical foreign key.
alter table public.staffing_requirements
  add column retired_at timestamptz;

alter table public.replanning_scenarios
  add column candidate_lock_version bigint
    check (candidate_lock_version is null or candidate_lock_version >= 0);

update public.replanning_scenarios scenario
set candidate_lock_version = candidate.lock_version
from public.schedule_versions candidate
where candidate.id = scenario.candidate_schedule_version_id
  and scenario.status = 'approved';

create index staffing_requirements_active_period_time
  on public.staffing_requirements (
    planning_period_id,
    starts_at,
    ends_at,
    position_id
  )
  where retired_at is null;

-- One manifest distinguishes a valid zero-requirement snapshot from a legacy
-- schedule that has not been migrated yet. Snapshot rows deliberately retain
-- source identifiers as values rather than foreign keys: deleting or editing a
-- mutable profile, forecast or port call must not rewrite published history.
create table public.schedule_requirement_snapshot_manifests (
  schedule_version_id uuid primary key
    references public.schedule_versions(id) on delete restrict,
  organization_id uuid not null,
  site_id uuid not null,
  planning_period_id uuid not null,
  schema_version integer not null default 1 check (schema_version > 0),
  capture_kind text not null
    check (capture_kind in ('publication', 'migration_backfill')),
  requirement_count integer not null check (requirement_count >= 0),
  content_fingerprint text not null
    check (content_fingerprint ~ '^[0-9a-f]{32}$'),
  captured_by uuid,
  captured_at timestamptz not null default now()
);

create table public.schedule_requirement_snapshots (
  id uuid primary key default extensions.gen_random_uuid(),
  schedule_version_id uuid not null
    references public.schedule_requirement_snapshot_manifests(
      schedule_version_id
    ) on delete restrict,
  organization_id uuid not null,
  site_id uuid not null,
  planning_period_id uuid not null,
  source_staffing_requirement_id uuid not null,
  port_call_id uuid,
  demand_profile_line_id uuid,
  demand_profile_id uuid,
  demand_profile_version integer,
  position_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  required_agents smallint not null check (required_agents between 1 and 100),
  source_revision text,
  source_facts jsonb not null default '{}'::jsonb
    check (jsonb_typeof(source_facts) = 'object'),
  captured_at timestamptz not null default now(),
  unique (schedule_version_id, source_staffing_requirement_id),
  check (ends_at > starts_at)
);

create index schedule_requirement_snapshots_period_time
  on public.schedule_requirement_snapshots (
    schedule_version_id,
    starts_at,
    ends_at,
    position_id
  );

create or replace function public.prevent_requirement_snapshot_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using
    errcode = 'P2070',
    message = 'Published requirement snapshots are immutable.';
end;
$$;

create trigger schedule_requirement_snapshot_manifests_immutable
before update or delete on public.schedule_requirement_snapshot_manifests
for each row execute function public.prevent_requirement_snapshot_mutation();

create trigger schedule_requirement_snapshots_immutable
before update or delete on public.schedule_requirement_snapshots
for each row execute function public.prevent_requirement_snapshot_mutation();

revoke all on function public.prevent_requirement_snapshot_mutation()
from public, anon, authenticated;

alter table public.schedule_requirement_snapshot_manifests
  enable row level security;
alter table public.schedule_requirement_snapshot_manifests
  force row level security;
alter table public.schedule_requirement_snapshots enable row level security;
alter table public.schedule_requirement_snapshots force row level security;

create policy schedule_requirement_snapshot_manifests_select_authorized
on public.schedule_requirement_snapshot_manifests
for select to authenticated
using (
  public.has_role(
    organization_id,
    site_id,
    array[
      'platform_admin',
      'planning_admin',
      'planner',
      'approver',
      'supervisor',
      'hr',
      'auditor'
    ]::public.app_role[]
  )
);

create policy schedule_requirement_snapshots_select_authorized
on public.schedule_requirement_snapshots
for select to authenticated
using (
  public.has_role(
    organization_id,
    site_id,
    array[
      'platform_admin',
      'planning_admin',
      'planner',
      'approver',
      'supervisor',
      'hr',
      'auditor'
    ]::public.app_role[]
  )
);

create policy schedule_requirement_snapshot_manifests_active_account_gate
on public.schedule_requirement_snapshot_manifests
as restrictive for all to authenticated
using ((select public.is_current_app_user_active()))
with check ((select public.is_current_app_user_active()));

create policy schedule_requirement_snapshots_active_account_gate
on public.schedule_requirement_snapshots
as restrictive for all to authenticated
using ((select public.is_current_app_user_active()))
with check ((select public.is_current_app_user_active()));

revoke all on table public.schedule_requirement_snapshot_manifests
from public, anon, authenticated;
revoke all on table public.schedule_requirement_snapshots
from public, anon, authenticated;
grant select on table public.schedule_requirement_snapshot_manifests
to authenticated, service_role;
grant select on table public.schedule_requirement_snapshots
to authenticated, service_role;

create or replace function public.capture_schedule_requirement_snapshot(
  target_schedule_version_id uuid,
  target_capture_kind text default 'publication'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_schedule public.schedule_versions;
  snapshot_count integer;
  snapshot_fingerprint text;
begin
  select schedule.*
  into target_schedule
  from public.schedule_versions schedule
  where schedule.id = target_schedule_version_id
  for update;

  if not found then
    raise exception 'Schedule version not found';
  end if;

  if target_capture_kind not in ('publication', 'migration_backfill') then
    raise exception 'Invalid requirement snapshot capture kind';
  end if;

  if exists (
    select 1
    from public.schedule_requirement_snapshot_manifests manifest
    where manifest.schedule_version_id = target_schedule.id
  ) then
    return;
  end if;

  create temporary table if not exists requirement_snapshot_capture_rows (
    source_staffing_requirement_id uuid,
    port_call_id uuid,
    demand_profile_line_id uuid,
    demand_profile_id uuid,
    demand_profile_version integer,
    position_id uuid,
    starts_at timestamptz,
    ends_at timestamptz,
    required_agents smallint,
    source_revision text,
    source_facts jsonb
  ) on commit drop;

  truncate requirement_snapshot_capture_rows;

  insert into requirement_snapshot_capture_rows (
    source_staffing_requirement_id,
    port_call_id,
    demand_profile_line_id,
    demand_profile_id,
    demand_profile_version,
    position_id,
    starts_at,
    ends_at,
    required_agents,
    source_revision,
    source_facts
  )
  select
    requirement.id,
    requirement.port_call_id,
    requirement.demand_profile_line_id,
    profile.id,
    profile.version,
    requirement.position_id,
    requirement.starts_at,
    requirement.ends_at,
    requirement.required_agents,
    requirement.source_revision,
    jsonb_strip_nulls(jsonb_build_object(
      'portCallStatus', port_call.status,
      'portCallSource', port_call.source,
      'portCallSourceRevision', port_call.source_revision,
      'scheduledArrivalAt', port_call.scheduled_arrival_at,
      'scheduledDepartureAt', port_call.scheduled_departure_at,
      'estimatedArrivalAt', port_call.estimated_arrival_at,
      'estimatedDepartureAt', port_call.estimated_departure_at,
      'profileVersion', profile.version,
      'anchor', profile_line.anchor,
      'startsOffsetMinutes', profile_line.starts_offset_minutes,
      'durationMinutes', profile_line.duration_minutes,
      'baseAgents', profile_line.base_agents,
      'passengersPerExtraAgent', profile_line.passengers_per_extra_agent,
      'vehiclesPerExtraAgent', profile_line.vehicles_per_extra_agent,
      'freightUnitsPerExtraAgent', profile_line.freight_units_per_extra_agent,
      'coachesPerExtraAgent', profile_line.coaches_per_extra_agent,
      'minimumAgents', profile_line.minimum_agents,
      'maximumAgents', profile_line.maximum_agents,
      'forecast', case when forecast.id is null then null else jsonb_build_object(
        'passengerCount', forecast.passenger_count,
        'vehicleCount', forecast.vehicle_count,
        'freightUnitCount', forecast.freight_unit_count,
        'coachCount', forecast.coach_count,
        'source', forecast.source,
        'sourceRevision', forecast.source_revision,
        'receivedAt', forecast.received_at
      ) end
    ))
  from public.staffing_requirements requirement
  left join public.port_calls port_call
    on port_call.id = requirement.port_call_id
  left join public.demand_profile_lines profile_line
    on profile_line.id = requirement.demand_profile_line_id
  left join public.demand_profiles profile
    on profile.id = profile_line.demand_profile_id
  left join lateral (
    select load.*
    from public.call_load_forecasts load
    where load.port_call_id = requirement.port_call_id
    order by load.received_at desc, load.id desc
    limit 1
  ) forecast on true
  where requirement.planning_period_id = target_schedule.planning_period_id
    and requirement.retired_at is null
    and (port_call.id is null or port_call.status <> 'cancelled')
  order by requirement.starts_at, requirement.id;

  select
    count(*)::integer,
    md5(coalesce(string_agg(
      concat_ws(
        '|',
        source_staffing_requirement_id::text,
        coalesce(port_call_id::text, ''),
        position_id::text,
        starts_at::text,
        ends_at::text,
        required_agents::text,
        coalesce(source_revision, ''),
        source_facts::text
      ),
      E'\n' order by starts_at, source_staffing_requirement_id
    ), ''))
  into snapshot_count, snapshot_fingerprint
  from requirement_snapshot_capture_rows;

  insert into public.schedule_requirement_snapshot_manifests (
    schedule_version_id,
    organization_id,
    site_id,
    planning_period_id,
    schema_version,
    capture_kind,
    requirement_count,
    content_fingerprint,
    captured_by
  ) values (
    target_schedule.id,
    target_schedule.organization_id,
    target_schedule.site_id,
    target_schedule.planning_period_id,
    1,
    target_capture_kind,
    snapshot_count,
    snapshot_fingerprint,
    (select auth.uid())
  );

  insert into public.schedule_requirement_snapshots (
    schedule_version_id,
    organization_id,
    site_id,
    planning_period_id,
    source_staffing_requirement_id,
    port_call_id,
    demand_profile_line_id,
    demand_profile_id,
    demand_profile_version,
    position_id,
    starts_at,
    ends_at,
    required_agents,
    source_revision,
    source_facts
  )
  select
    target_schedule.id,
    target_schedule.organization_id,
    target_schedule.site_id,
    target_schedule.planning_period_id,
    captured.source_staffing_requirement_id,
    captured.port_call_id,
    captured.demand_profile_line_id,
    captured.demand_profile_id,
    captured.demand_profile_version,
    captured.position_id,
    captured.starts_at,
    captured.ends_at,
    captured.required_agents,
    captured.source_revision,
    captured.source_facts
  from requirement_snapshot_capture_rows captured;
end;
$$;

revoke all on function public.capture_schedule_requirement_snapshot(uuid, text)
from public, anon, authenticated;

-- Historical publications cannot be reconstructed perfectly. Capture the
-- currently available requirements once and label that provenance explicitly;
-- all future publications are exact transaction-time snapshots.
do $$
declare
  legacy_schedule_id uuid;
begin
  for legacy_schedule_id in
    select schedule.id
    from public.schedule_versions schedule
    where schedule.status in ('published', 'archived')
    order by schedule.created_at, schedule.id
  loop
    perform public.capture_schedule_requirement_snapshot(
      legacy_schedule_id,
      'migration_backfill'
    );
  end loop;
end;
$$;

create or replace function public.schedule_effective_requirements(
  target_schedule_version_id uuid
)
returns table (
  id uuid,
  organization_id uuid,
  site_id uuid,
  planning_period_id uuid,
  port_call_id uuid,
  demand_profile_line_id uuid,
  position_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  required_agents smallint,
  source_revision text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    snapshot.source_staffing_requirement_id,
    snapshot.organization_id,
    snapshot.site_id,
    snapshot.planning_period_id,
    snapshot.port_call_id,
    snapshot.demand_profile_line_id,
    snapshot.position_id,
    snapshot.starts_at,
    snapshot.ends_at,
    snapshot.required_agents,
    snapshot.source_revision
  from public.schedule_requirement_snapshots snapshot
  where snapshot.schedule_version_id = target_schedule_version_id

  union all

  select
    requirement.id,
    requirement.organization_id,
    requirement.site_id,
    requirement.planning_period_id,
    requirement.port_call_id,
    requirement.demand_profile_line_id,
    requirement.position_id,
    requirement.starts_at,
    requirement.ends_at,
    requirement.required_agents,
    requirement.source_revision
  from public.staffing_requirements requirement
  join public.schedule_versions schedule
    on schedule.planning_period_id = requirement.planning_period_id
    and schedule.id = target_schedule_version_id
  where requirement.retired_at is null
    and not exists (
      select 1
      from public.schedule_requirement_snapshot_manifests manifest
      where manifest.schedule_version_id = target_schedule_version_id
    );
$$;

revoke all on function public.schedule_effective_requirements(uuid)
from public, anon, authenticated;

-- RLS-filtered read path for export and API consumers. Published/archived
-- schedules return frozen rows; editable drafts return current active rows.
create or replace function public.get_schedule_requirements(
  target_schedule_version_id uuid
)
returns table (
  id uuid,
  organization_id uuid,
  site_id uuid,
  planning_period_id uuid,
  port_call_id uuid,
  demand_profile_line_id uuid,
  position_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  required_agents smallint,
  source_revision text,
  is_snapshot boolean,
  snapshot_captured_at timestamptz,
  snapshot_schema_version integer,
  source_facts jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    snapshot.source_staffing_requirement_id,
    snapshot.organization_id,
    snapshot.site_id,
    snapshot.planning_period_id,
    snapshot.port_call_id,
    snapshot.demand_profile_line_id,
    snapshot.position_id,
    snapshot.starts_at,
    snapshot.ends_at,
    snapshot.required_agents,
    snapshot.source_revision,
    true,
    manifest.captured_at,
    manifest.schema_version,
    snapshot.source_facts
  from public.schedule_requirement_snapshots snapshot
  join public.schedule_requirement_snapshot_manifests manifest
    on manifest.schedule_version_id = snapshot.schedule_version_id
  where snapshot.schedule_version_id = target_schedule_version_id

  union all

  select
    requirement.id,
    requirement.organization_id,
    requirement.site_id,
    requirement.planning_period_id,
    requirement.port_call_id,
    requirement.demand_profile_line_id,
    requirement.position_id,
    requirement.starts_at,
    requirement.ends_at,
    requirement.required_agents,
    requirement.source_revision,
    false,
    null::timestamptz,
    null::integer,
    '{}'::jsonb
  from public.staffing_requirements requirement
  join public.schedule_versions schedule
    on schedule.planning_period_id = requirement.planning_period_id
    and schedule.id = target_schedule_version_id
  where requirement.retired_at is null
    and not exists (
      select 1
      from public.schedule_requirement_snapshot_manifests manifest
      where manifest.schedule_version_id = target_schedule_version_id
    );
$$;

revoke all on function public.get_schedule_requirements(uuid)
from public, anon, authenticated;
grant execute on function public.get_schedule_requirements(uuid)
to authenticated;

comment on table public.schedule_requirement_snapshot_manifests is
  'Immutable, versioned publication-time demand snapshot metadata; migration_backfill marks legacy reconstruction.';
comment on table public.schedule_requirement_snapshots is
  'Immutable staffing requirements and input facts used to validate and export one published schedule.';
comment on function public.get_schedule_requirements(uuid) is
  'Returns frozen requirements for published history and active live requirements for editable drafts.';

create or replace function public.generate_staffing_requirements(
  target_planning_period_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_period public.planning_periods;
  generated_count integer := 0;
  retired_count integer := 0;
  deleted_count integer := 0;
begin
  select period.* into target_period
  from public.planning_periods period
  where period.id = target_planning_period_id
  for update;

  if target_period.id is null then
    raise exception 'Planning period not found';
  end if;

  if not public.has_role(
    target_period.organization_id,
    target_period.site_id,
    array[
      'platform_admin',
      'planning_admin',
      'planner',
      'approver'
    ]::public.app_role[]
  ) then
    raise exception 'Insufficient permissions';
  end if;

  insert into public.staffing_requirements (
    organization_id,
    site_id,
    planning_period_id,
    port_call_id,
    demand_profile_line_id,
    position_id,
    starts_at,
    ends_at,
    required_agents,
    source_revision,
    retired_at
  )
  select
    target_period.organization_id,
    target_period.site_id,
    target_period.id,
    port_call.id,
    profile_line.id,
    profile_line.position_id,
    anchor.anchor_at + make_interval(mins => profile_line.starts_offset_minutes),
    anchor.anchor_at
      + make_interval(
          mins => profile_line.starts_offset_minutes
            + profile_line.duration_minutes
        ),
    greatest(
      1,
      least(
        coalesce(profile_line.maximum_agents, 100),
        greatest(
          profile_line.minimum_agents,
          profile_line.base_agents
            + case
                when profile_line.passengers_per_extra_agent is null then 0
                else ceil(
                  coalesce(load.passenger_count, 0)::numeric
                  / profile_line.passengers_per_extra_agent
                )::integer
              end
            + case
                when profile_line.vehicles_per_extra_agent is null then 0
                else ceil(
                  coalesce(load.vehicle_count, 0)::numeric
                  / profile_line.vehicles_per_extra_agent
                )::integer
              end
            + case
                when profile_line.freight_units_per_extra_agent is null then 0
                else ceil(
                  coalesce(load.freight_unit_count, 0)::numeric
                  / profile_line.freight_units_per_extra_agent
                )::integer
              end
            + case
                when profile_line.coaches_per_extra_agent is null then 0
                else ceil(
                  coalesce(load.coach_count, 0)::numeric
                  / profile_line.coaches_per_extra_agent
                )::integer
              end
        )
      )
    ),
    concat_ws(
      ':',
      port_call.source_revision,
      load.source_revision,
      'profile-' || profile.version::text
    ),
    null
  from public.port_calls port_call
  join public.demand_profiles profile
    on profile.id = port_call.demand_profile_id
  join public.demand_profile_lines profile_line
    on profile_line.demand_profile_id = profile.id
  cross join lateral (
    select case profile_line.anchor
      when 'arrival' then coalesce(
        port_call.estimated_arrival_at,
        port_call.scheduled_arrival_at
      )
      when 'departure' then coalesce(
        port_call.estimated_departure_at,
        port_call.scheduled_departure_at
      )
    end as anchor_at
  ) anchor
  left join lateral (
    select forecast.*
    from public.call_load_forecasts forecast
    where forecast.port_call_id = port_call.id
    order by forecast.received_at desc, forecast.id desc
    limit 1
  ) load on true
  where port_call.organization_id = target_period.organization_id
    and port_call.site_id = target_period.site_id
    and port_call.status <> 'cancelled'
    and profile.active = true
    and anchor.anchor_at is not null
    and (anchor.anchor_at at time zone target_period.timezone)::date
      between target_period.starts_on and target_period.ends_on
  on conflict (
    planning_period_id,
    port_call_id,
    demand_profile_line_id
  ) where demand_profile_line_id is not null
  do update set
    position_id = excluded.position_id,
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at,
    required_agents = excluded.required_agents,
    source_revision = excluded.source_revision,
    retired_at = null,
    updated_at = now();

  get diagnostics generated_count = row_count;

  -- The period predicate is essential when an escale moves to another week.
  -- Merely checking that the port call/profile still exists leaves an obsolete
  -- requirement behind in the former week.
  update public.staffing_requirements obsolete
  set retired_at = coalesce(obsolete.retired_at, now()),
      updated_at = now()
  where obsolete.planning_period_id = target_period.id
    and obsolete.port_call_id is not null
    and obsolete.demand_profile_line_id is not null
    and obsolete.retired_at is null
    and not exists (
      select 1
      from public.port_calls port_call
      join public.demand_profiles profile
        on profile.id = port_call.demand_profile_id
      join public.demand_profile_lines profile_line
        on profile_line.demand_profile_id = profile.id
        and profile_line.id = obsolete.demand_profile_line_id
      cross join lateral (
        select case profile_line.anchor
          when 'arrival' then coalesce(
            port_call.estimated_arrival_at,
            port_call.scheduled_arrival_at
          )
          when 'departure' then coalesce(
            port_call.estimated_departure_at,
            port_call.scheduled_departure_at
          )
        end as anchor_at
      ) anchor
      where port_call.id = obsolete.port_call_id
        and port_call.organization_id = target_period.organization_id
        and port_call.site_id = target_period.site_id
        and port_call.status <> 'cancelled'
        and profile.active = true
        and anchor.anchor_at is not null
        and (anchor.anchor_at at time zone target_period.timezone)::date
          between target_period.starts_on and target_period.ends_on
    );

  get diagnostics retired_count = row_count;

  delete from public.staffing_requirements obsolete
  where obsolete.planning_period_id = target_period.id
    and obsolete.retired_at is not null
    and not exists (
      select 1
      from public.shift_assignments assignment
      where assignment.staffing_requirement_id = obsolete.id
    );

  get diagnostics deleted_count = row_count;

  insert into public.outbox_events (
    organization_id,
    site_id,
    topic,
    aggregate_type,
    aggregate_id,
    payload,
    idempotency_key
  ) values (
    target_period.organization_id,
    target_period.site_id,
    'planning.requirements.generated',
    'planning_period',
    target_period.id,
    jsonb_build_object(
      'planningPeriodId', target_period.id,
      'generatedCount', generated_count,
      'retiredCount', retired_count,
      'deletedCount', deleted_count,
      'generatedAt', now()
    ),
    'requirements-' || target_period.id::text || '-'
      || extensions.gen_random_uuid()::text
  );

  return jsonb_build_object(
    'planningPeriodId', target_period.id,
    'generatedCount', generated_count,
    'retiredCount', retired_count,
    'deletedCount', deleted_count
  );
end;
$$;

revoke all on function public.generate_staffing_requirements(uuid)
from public, anon, authenticated;

-- Maritime sources have an explicit precedence. A cursor is retained for each
-- source/escale pair so switching source cannot erase the fact that an older
-- message from that source has already been consumed.
create table public.port_call_source_policies (
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  source text not null check (char_length(source) between 2 and 50),
  priority smallint not null default 0 check (priority between 0 and 32767),
  ordered_updates_required boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, source)
);

create table public.port_call_source_cursors (
  organization_id uuid not null,
  site_id uuid not null,
  port_call_id uuid not null,
  source text not null,
  source_priority smallint not null check (source_priority between 0 and 32767),
  last_sequence bigint check (last_sequence is null or last_sequence >= 0),
  last_revision text,
  last_payload_fingerprint text not null
    check (last_payload_fingerprint ~ '^[0-9a-f]{32}$'),
  last_received_at timestamptz not null,
  accepted_count bigint not null default 1 check (accepted_count > 0),
  updated_at timestamptz not null default now(),
  primary key (port_call_id, source),
  foreign key (port_call_id, organization_id)
    references public.port_calls(id, organization_id) on delete cascade
);

alter table public.port_calls
  add column source_priority smallint not null default 0
    check (source_priority between 0 and 32767),
  add column source_sequence bigint
    check (source_sequence is null or source_sequence >= 0),
  add column source_received_at timestamptz,
  add column source_override_until timestamptz,
  add column timing_lock_version bigint not null default 0
    check (timing_lock_version >= 0),
  add column timing_payload_fingerprint text
    check (
      timing_payload_fingerprint is null
      or timing_payload_fingerprint ~ '^[0-9a-f]{32}$'
    );

create table public.port_call_source_overrides (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null,
  site_id uuid not null,
  port_call_id uuid not null,
  previous_state jsonb not null check (jsonb_typeof(previous_state) = 'object'),
  override_state jsonb not null check (jsonb_typeof(override_state) = 'object'),
  reason text not null check (char_length(reason) between 3 and 500),
  valid_until timestamptz not null,
  created_by uuid not null references public.app_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  resumed_at timestamptz,
  resumed_by_source text,
  foreign key (port_call_id, organization_id)
    references public.port_calls(id, organization_id) on delete restrict,
  check (valid_until > created_at),
  check (
    (resumed_at is null and resumed_by_source is null)
    or (resumed_at is not null and resumed_by_source is not null)
  )
);

create index port_call_source_overrides_active
  on public.port_call_source_overrides (port_call_id, valid_until desc)
  where resumed_at is null;

alter table public.port_call_revisions
  add column demand_profile_id uuid,
  add column source_priority smallint not null default 0
    check (source_priority between 0 and 32767),
  add column source_sequence bigint
    check (source_sequence is null or source_sequence >= 0),
  add column timing_lock_version bigint not null default 0
    check (timing_lock_version >= 0),
  add column payload_fingerprint text
    check (
      payload_fingerprint is null
      or payload_fingerprint ~ '^[0-9a-f]{32}$'
    ),
  add column revision_kind text not null default 'source'
    check (revision_kind in ('source', 'demand_profile'));

create or replace function public.maritime_timing_payload_fingerprint(
  timing_status public.port_call_status,
  timing_estimated_arrival_at timestamptz,
  timing_estimated_departure_at timestamptz,
  timing_source text,
  timing_source_revision text,
  timing_source_sequence bigint
)
returns text
language sql
immutable
set search_path = ''
as $$
  select md5(jsonb_build_object(
    'status', timing_status,
    'estimatedArrivalAt', timing_estimated_arrival_at,
    'estimatedDepartureAt', timing_estimated_departure_at,
    'source', pg_catalog.lower(pg_catalog.btrim(timing_source)),
    'sourceRevision', nullif(pg_catalog.btrim(timing_source_revision), ''),
    'sourceSequence', timing_source_sequence
  )::text);
$$;

revoke all on function public.maritime_timing_payload_fingerprint(
  public.port_call_status,
  timestamptz,
  timestamptz,
  text,
  text,
  bigint
) from public, anon, authenticated;

with numbered_source_revisions as (
  select
    revision.id,
    row_number() over (
      partition by revision.port_call_id
      order by revision.recorded_at, revision.id
    ) - 1 as timing_lock_version
  from public.port_call_revisions revision
)
update public.port_call_revisions revision
set source_sequence = case
      when revision.source_revision ~ '^[0-9]{1,18}$'
        then revision.source_revision::bigint
      else null::bigint
    end,
    timing_lock_version = numbered.timing_lock_version,
    payload_fingerprint = public.maritime_timing_payload_fingerprint(
      revision.status,
      revision.estimated_arrival_at,
      revision.estimated_departure_at,
      revision.source,
      revision.source_revision,
      case
        when revision.source_revision ~ '^[0-9]{1,18}$'
          then revision.source_revision::bigint
        else null::bigint
      end
    )
from numbered_source_revisions numbered
where numbered.id = revision.id;

insert into public.port_call_source_policies (
  organization_id,
  source,
  priority,
  ordered_updates_required
)
select organization.id, seed.source, seed.priority, seed.ordered_updates_required
from public.organizations organization
cross join (
  values
    ('manual'::text, 50::smallint, false),
    ('tools-panel'::text, 100::smallint, false),
    ('demo-generator'::text, 10::smallint, false),
    ('demo-month-generator'::text, 10::smallint, false),
    ('corsica-linea-feed'::text, 200::smallint, true)
) as seed(source, priority, ordered_updates_required)
on conflict (organization_id, source) do nothing;

create or replace function public.seed_default_maritime_source_policies()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.port_call_source_policies (
    organization_id,
    source,
    priority,
    ordered_updates_required
  ) values
    (new.id, 'manual', 50, false),
    (new.id, 'tools-panel', 100, false),
    (new.id, 'demo-generator', 10, false),
    (new.id, 'demo-month-generator', 10, false),
    (new.id, 'corsica-linea-feed', 200, true)
  on conflict (organization_id, source) do nothing;

  return new;
end;
$$;

revoke all on function public.seed_default_maritime_source_policies()
from public, anon, authenticated;

drop trigger if exists organizations_seed_maritime_source_policies
on public.organizations;

create trigger organizations_seed_maritime_source_policies
after insert on public.organizations
for each row execute function public.seed_default_maritime_source_policies();

-- This is metadata backfill, not a new upstream revision. The legacy generic
-- revision trigger would otherwise replay the existing source_revision into
-- its unique index on every deployed escale.
alter table public.port_calls disable trigger port_calls_record_revision;

update public.port_calls port_call
set source = pg_catalog.lower(pg_catalog.btrim(port_call.source)),
    source_revision = nullif(pg_catalog.btrim(port_call.source_revision), ''),
    source_priority = coalesce(
      (
        select policy.priority
        from public.port_call_source_policies policy
        where policy.organization_id = port_call.organization_id
          and policy.source = pg_catalog.lower(pg_catalog.btrim(port_call.source))
          and policy.active
      ),
      0
    ),
    source_sequence = coalesce(
      port_call.source_sequence,
      case
        when port_call.source_revision ~ '^[0-9]{1,18}$'
          then port_call.source_revision::bigint
        else null::bigint
      end
    ),
    source_received_at = coalesce(port_call.received_at, port_call.created_at),
    timing_lock_version = coalesce(
      (
        select max(revision.timing_lock_version)
        from public.port_call_revisions revision
        where revision.port_call_id = port_call.id
      ),
      0
    ),
    timing_payload_fingerprint =
      public.maritime_timing_payload_fingerprint(
        port_call.status,
        port_call.estimated_arrival_at,
        port_call.estimated_departure_at,
        pg_catalog.lower(pg_catalog.btrim(port_call.source)),
        nullif(pg_catalog.btrim(port_call.source_revision), ''),
        coalesce(
          port_call.source_sequence,
          case
            when port_call.source_revision ~ '^[0-9]{1,18}$'
              then port_call.source_revision::bigint
            else null::bigint
          end
        )
      );

alter table public.port_calls enable trigger port_calls_record_revision;

alter table public.port_calls
  alter column source_received_at set default now(),
  alter column source_received_at set not null;

create or replace function public.initialize_port_call_source_metadata()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.source := pg_catalog.lower(pg_catalog.btrim(new.source));
  new.source_revision := nullif(pg_catalog.btrim(new.source_revision), '');

  select policy.priority
  into new.source_priority
  from public.port_call_source_policies policy
  where policy.organization_id = new.organization_id
    and policy.source = new.source
    and policy.active;

  new.source_priority := coalesce(new.source_priority, 0);
  new.source_received_at := coalesce(
    new.source_received_at,
    new.received_at,
    clock_timestamp()
  );
  new.source_sequence := coalesce(
    new.source_sequence,
    case
      when new.source_revision ~ '^[0-9]{1,18}$'
        then new.source_revision::bigint
      else null::bigint
    end
  );
  new.timing_lock_version := coalesce(new.timing_lock_version, 0);
  new.timing_payload_fingerprint :=
    public.maritime_timing_payload_fingerprint(
      new.status,
      new.estimated_arrival_at,
      new.estimated_departure_at,
      new.source,
      new.source_revision,
      new.source_sequence
    );

  return new;
end;
$$;

create or replace function public.initialize_port_call_source_cursor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.port_call_source_cursors (
    organization_id,
    site_id,
    port_call_id,
    source,
    source_priority,
    last_sequence,
    last_revision,
    last_payload_fingerprint,
    last_received_at
  ) values (
    new.organization_id,
    new.site_id,
    new.id,
    new.source,
    new.source_priority,
    new.source_sequence,
    new.source_revision,
    new.timing_payload_fingerprint,
    new.source_received_at
  )
  on conflict (port_call_id, source) do nothing;

  return new;
end;
$$;

revoke all on function public.initialize_port_call_source_metadata()
from public, anon, authenticated;
revoke all on function public.initialize_port_call_source_cursor()
from public, anon, authenticated;

drop trigger if exists port_calls_00_initialize_source_metadata
on public.port_calls;
drop trigger if exists port_calls_01_initialize_source_cursor
on public.port_calls;

create trigger port_calls_00_initialize_source_metadata
before insert on public.port_calls
for each row execute function public.initialize_port_call_source_metadata();

create trigger port_calls_01_initialize_source_cursor
after insert on public.port_calls
for each row execute function public.initialize_port_call_source_cursor();

insert into public.port_call_source_cursors (
  organization_id,
  site_id,
  port_call_id,
  source,
  source_priority,
  last_sequence,
  last_revision,
  last_payload_fingerprint,
  last_received_at
)
select
  port_call.organization_id,
  port_call.site_id,
  port_call.id,
  port_call.source,
  port_call.source_priority,
  port_call.source_sequence,
  port_call.source_revision,
  port_call.timing_payload_fingerprint,
  port_call.source_received_at
from public.port_calls port_call
on conflict (port_call_id, source) do nothing;

drop index if exists public.port_call_revisions_source_idempotency;

create unique index port_call_revisions_source_idempotency
  on public.port_call_revisions (port_call_id, source, source_revision)
  where source_revision is not null and revision_kind = 'source';

create index port_call_source_cursors_latest
  on public.port_call_source_cursors (
    port_call_id,
    source,
    last_sequence desc,
    last_received_at desc
  );

create trigger port_call_source_policies_set_updated_at
before update on public.port_call_source_policies
for each row execute function public.set_updated_at();

alter table public.port_call_source_policies enable row level security;
alter table public.port_call_source_policies force row level security;
alter table public.port_call_source_cursors enable row level security;
alter table public.port_call_source_cursors force row level security;
alter table public.port_call_source_overrides enable row level security;
alter table public.port_call_source_overrides force row level security;

create policy port_call_source_policies_select_authorized
on public.port_call_source_policies
for select to authenticated
using (
  public.has_organization_role(
    organization_id,
    array[
      'platform_admin',
      'planning_admin',
      'planner',
      'approver',
      'auditor'
    ]::public.app_role[]
  )
);

create policy port_call_source_cursors_select_authorized
on public.port_call_source_cursors
for select to authenticated
using (
  public.has_role(
    organization_id,
    site_id,
    array[
      'platform_admin',
      'planning_admin',
      'planner',
      'approver',
      'auditor'
    ]::public.app_role[]
  )
);

create policy port_call_source_overrides_select_authorized
on public.port_call_source_overrides
for select to authenticated
using (
  public.has_role(
    organization_id,
    site_id,
    array[
      'platform_admin',
      'planning_admin',
      'planner',
      'approver',
      'auditor'
    ]::public.app_role[]
  )
);

create policy port_call_source_policies_active_account_gate
on public.port_call_source_policies
as restrictive for all to authenticated
using ((select public.is_current_app_user_active()))
with check ((select public.is_current_app_user_active()));

create policy port_call_source_cursors_active_account_gate
on public.port_call_source_cursors
as restrictive for all to authenticated
using ((select public.is_current_app_user_active()))
with check ((select public.is_current_app_user_active()));

create policy port_call_source_overrides_active_account_gate
on public.port_call_source_overrides
as restrictive for all to authenticated
using ((select public.is_current_app_user_active()))
with check ((select public.is_current_app_user_active()));

revoke all on table public.port_call_source_policies
from public, anon, authenticated;
revoke all on table public.port_call_source_cursors
from public, anon, authenticated;
revoke all on table public.port_call_source_overrides
from public, anon, authenticated;
grant select on table public.port_call_source_policies
to authenticated, service_role;
grant select on table public.port_call_source_cursors
to authenticated, service_role;
grant select on table public.port_call_source_overrides
to authenticated, service_role;
grant insert, update, delete on table public.port_call_source_policies
to service_role;
grant insert, update, delete on table public.port_call_source_cursors
to service_role;
grant insert, update, delete on table public.port_call_source_overrides
to service_role;

-- Direct timing writes would bypass source ordering. Authenticated callers keep
-- the narrow demand-profile operation; all timing/status changes use the RPC.
revoke update on table public.port_calls from authenticated;
grant update (demand_profile_id) on table public.port_calls to authenticated;

create or replace function public.record_port_call_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_revision_kind text := 'source';
begin
  if tg_op = 'UPDATE' then
    if new.status is not distinct from old.status
      and new.scheduled_arrival_at is not distinct from old.scheduled_arrival_at
      and new.scheduled_departure_at is not distinct from old.scheduled_departure_at
      and new.estimated_arrival_at is not distinct from old.estimated_arrival_at
      and new.estimated_departure_at is not distinct from old.estimated_departure_at
      and new.actual_arrival_at is not distinct from old.actual_arrival_at
      and new.actual_departure_at is not distinct from old.actual_departure_at
      and new.source is not distinct from old.source
      and new.source_revision is not distinct from old.source_revision
      and new.source_sequence is not distinct from old.source_sequence
      and new.source_priority is not distinct from old.source_priority
      and new.source_received_at is not distinct from old.source_received_at
      and new.timing_lock_version is not distinct from old.timing_lock_version
      and new.timing_payload_fingerprint
        is not distinct from old.timing_payload_fingerprint then
      if new.demand_profile_id is not distinct from old.demand_profile_id then
        return new;
      end if;
      target_revision_kind := 'demand_profile';
    end if;
  end if;

  insert into public.port_call_revisions (
    organization_id,
    site_id,
    port_call_id,
    status,
    scheduled_arrival_at,
    scheduled_departure_at,
    estimated_arrival_at,
    estimated_departure_at,
    actual_arrival_at,
    actual_departure_at,
    source,
    source_revision,
    demand_profile_id,
    source_priority,
    source_sequence,
    timing_lock_version,
    payload_fingerprint,
    revision_kind,
    recorded_by
  ) values (
    new.organization_id,
    new.site_id,
    new.id,
    new.status,
    new.scheduled_arrival_at,
    new.scheduled_departure_at,
    new.estimated_arrival_at,
    new.estimated_departure_at,
    new.actual_arrival_at,
    new.actual_departure_at,
    new.source,
    new.source_revision,
    new.demand_profile_id,
    new.source_priority,
    new.source_sequence,
    new.timing_lock_version,
    new.timing_payload_fingerprint,
    target_revision_kind,
    (select auth.uid())
  );

  return new;
end;
$$;

revoke all on function public.record_port_call_revision()
from public, anon, authenticated;

comment on table public.port_call_source_policies is
  'Per-organization precedence and ordering contract for maritime timing sources.';
comment on table public.port_call_source_cursors is
  'Last accepted sequence/revision for each escale and source, retained across source switches.';

-- Arrival and departure may fall in different ISO weeks. Provision each
-- effective anchor independently, in chronological order, while keeping the
-- legacy scalar fields in the aggregate return value for existing callers.
create or replace function public.ensure_planning_workspace_for_anchor(
  target_port_call_id uuid,
  target_anchor timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_call public.port_calls;
  target_site public.sites;
  target_period public.planning_periods;
  target_version public.schedule_versions;
  created_version public.schedule_versions;
  call_date date;
  week_start date;
  week_end date;
  next_version_number integer;
  requirements_result jsonb;
begin
  select port_call.* into target_call
  from public.port_calls port_call
  where port_call.id = target_port_call_id;

  if target_call.id is null then
    raise exception 'Port call not found';
  end if;

  select site.* into target_site
  from public.sites site
  where site.id = target_call.site_id
    and site.active = true;

  if target_site.id is null then
    raise exception 'Active site not found';
  end if;

  if not public.has_role(
    target_call.organization_id,
    target_call.site_id,
    array[
      'platform_admin',
      'planning_admin',
      'planner',
      'approver'
    ]::public.app_role[]
  ) then
    raise exception 'Insufficient permissions';
  end if;

  if target_anchor is null then
    return jsonb_build_object(
      'created', false,
      'portCallId', target_call.id,
      'reason', 'missing_timing'
    );
  end if;

  call_date := (target_anchor at time zone target_site.timezone)::date;
  week_start := call_date - (extract(isodow from call_date)::integer - 1);
  week_end := week_start + 6;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      target_call.site_id::text || ':' || week_start::text,
      0
    )
  );

  select period.* into target_period
  from public.planning_periods period
  where period.site_id = target_call.site_id
    and period.starts_on = week_start
    and period.ends_on = week_end
  order by period.created_at, period.id
  limit 1
  for update;

  if target_period.id is null and target_call.status = 'cancelled' then
    return jsonb_build_object(
      'created', false,
      'portCallId', target_call.id,
      'reason', 'cancelled'
    );
  end if;

  if target_period.id is null then
    insert into public.planning_periods (
      organization_id,
      site_id,
      name,
      starts_on,
      ends_on,
      timezone
    ) values (
      target_call.organization_id,
      target_call.site_id,
      'Semaine du ' || to_char(week_start, 'DD/MM/YYYY'),
      week_start,
      week_end,
      target_site.timezone
    )
    returning * into target_period;
  end if;

  requirements_result := public.generate_staffing_requirements(
    target_period.id
  );

  select schedule.* into target_version
  from public.schedule_versions schedule
  where schedule.planning_period_id = target_period.id
    and schedule.superseded_at is null
  order by
    case schedule.status
      when 'draft' then 0
      when 'validated' then 1
      when 'published' then 2
      else 3
    end,
    schedule.version_number desc,
    schedule.id
  limit 1;

  if target_version.id is null and target_call.status <> 'cancelled' then
    select coalesce(max(schedule.version_number), 0) + 1
    into next_version_number
    from public.schedule_versions schedule
    where schedule.planning_period_id = target_period.id;

    insert into public.schedule_versions (
      organization_id,
      site_id,
      planning_period_id,
      version_number,
      status,
      label,
      change_reason,
      created_by
    ) values (
      target_call.organization_id,
      target_call.site_id,
      target_period.id,
      next_version_number,
      'draft',
      'Planning automatique',
      'Initialisation automatique à partir des escales',
      (select auth.uid())
    )
    returning * into created_version;
  end if;

  return jsonb_build_object(
    'created', created_version.id is not null,
    'portCallId', target_call.id,
    'planningPeriodId', target_period.id,
    'scheduleVersionId', coalesce(created_version.id, target_version.id),
    'generatedRequirements', coalesce(
      (requirements_result ->> 'generatedCount')::integer,
      0
    )
  );
end;
$$;

revoke all on function public.ensure_planning_workspace_for_anchor(
  uuid,
  timestamptz
) from public, anon, authenticated;

create or replace function public.ensure_planning_workspace_for_port_call(
  target_port_call_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_call public.port_calls;
  target_timezone text;
  target_anchor timestamptz;
  workspace jsonb;
  first_workspace jsonb;
  period_ids jsonb := '[]'::jsonb;
  schedule_ids jsonb := '[]'::jsonb;
  generated_count integer := 0;
  created_any boolean := false;
begin
  select port_call.* into target_call
  from public.port_calls port_call
  where port_call.id = target_port_call_id;

  if target_call.id is null then
    raise exception 'Port call not found';
  end if;

  select site.timezone into target_timezone
  from public.sites site
  where site.id = target_call.site_id;

  for target_anchor in
    select min(anchor.anchor_at)
    from (
      values
        (coalesce(
          target_call.estimated_arrival_at,
          target_call.scheduled_arrival_at
        )),
        (coalesce(
          target_call.estimated_departure_at,
          target_call.scheduled_departure_at
        ))
    ) anchor(anchor_at)
    where anchor.anchor_at is not null
    group by (
      (anchor.anchor_at at time zone target_timezone)::date
        - (
          extract(isodow from (
            anchor.anchor_at at time zone target_timezone
          ))::integer - 1
        )
    )
    order by min(anchor.anchor_at)
  loop
    workspace := public.ensure_planning_workspace_for_anchor(
      target_call.id,
      target_anchor
    );

    if first_workspace is null then
      first_workspace := workspace;
    end if;

    created_any := created_any or coalesce(
      (workspace ->> 'created')::boolean,
      false
    );
    generated_count := generated_count + coalesce(
      (workspace ->> 'generatedRequirements')::integer,
      0
    );

    if workspace ->> 'planningPeriodId' is not null
      and not period_ids @> jsonb_build_array(
        workspace ->> 'planningPeriodId'
      ) then
      period_ids := period_ids || jsonb_build_array(
        workspace ->> 'planningPeriodId'
      );
    end if;

    if workspace ->> 'scheduleVersionId' is not null
      and not schedule_ids @> jsonb_build_array(
        workspace ->> 'scheduleVersionId'
      ) then
      schedule_ids := schedule_ids || jsonb_build_array(
        workspace ->> 'scheduleVersionId'
      );
    end if;
  end loop;

  if first_workspace is null then
    return jsonb_build_object(
      'created', false,
      'portCallId', target_call.id,
      'reason', 'missing_timing',
      'planningPeriodIds', period_ids,
      'scheduleVersionIds', schedule_ids,
      'generatedRequirements', 0
    );
  end if;

  return first_workspace || jsonb_build_object(
    'created', created_any,
    'planningPeriodIds', period_ids,
    'scheduleVersionIds', schedule_ids,
    'generatedRequirements', generated_count
  );
end;
$$;

-- Keep the pre-existing interactive privilege unchanged in 031. The dedicated
-- service/interactive grant split is finalized by the later hardening migration.

create or replace function public.maritime_revision_sequence(
  source_revision text
)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select case
    when source_revision ~ '^[0-9]{1,18}$' then source_revision::bigint
    else null::bigint
  end;
$$;

revoke all on function public.maritime_revision_sequence(text)
from public, anon, authenticated;

create or replace function public.apply_ordered_port_call_timing_update(
  target_port_call_id uuid,
  new_estimated_arrival_at timestamptz,
  new_estimated_departure_at timestamptz,
  new_status public.port_call_status,
  update_source text,
  update_source_revision text,
  update_source_sequence bigint,
  expected_current_source_revision text,
  update_received_at timestamptz,
  expected_timing_lock_version bigint,
  enforce_compare_and_swap boolean,
  allow_priority_override boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_call public.port_calls;
  source_cursor public.port_call_source_cursors;
  source_policy public.port_call_source_policies;
  previous_arrival timestamptz;
  previous_departure timestamptz;
  effective_new_arrival timestamptz;
  effective_new_departure timestamptz;
  previous_anchor timestamptz;
  current_anchor timestamptz;
  previous_period_ids uuid[] := '{}'::uuid[];
  current_period_ids uuid[] := '{}'::uuid[];
  touched_period_ids uuid[] := '{}'::uuid[];
  arrival_delta_minutes integer := 0;
  departure_delta_minutes integer := 0;
  primary_delta_minutes integer := 0;
  event_kind public.disruption_kind;
  disruption public.disruption_events;
  base_schedule public.schedule_versions;
  scenario public.replanning_scenarios;
  previous_period public.planning_periods;
  current_period public.planning_periods;
  affected_period public.planning_periods;
  target_site public.sites;
  requirements_result jsonb;
  workspace_result jsonb;
  scenario_ids jsonb := '[]'::jsonb;
  first_scenario_id uuid;
  impact_count integer := 0;
  scenario_impact_count integer := 0;
  generated_requirement_count integer := 0;
  incoming_priority smallint := 0;
  incoming_sequence bigint;
  incoming_received_at timestamptz;
  incoming_payload_fingerprint text;
  known_revision public.port_call_revisions;
  ordered_updates_required boolean := true;
  operational_change boolean;
begin
  select port_call.* into target_call
  from public.port_calls port_call
  where port_call.id = target_port_call_id
  for update;

  if target_call.id is null then
    raise exception 'Port call not found';
  end if;

  if not public.has_role(
    target_call.organization_id,
    target_call.site_id,
    array[
      'platform_admin',
      'planning_admin',
      'planner',
      'approver'
    ]::public.app_role[]
  ) then
    raise exception 'Insufficient permissions';
  end if;

  update_source := pg_catalog.lower(pg_catalog.btrim(update_source));
  update_source_revision := nullif(
    pg_catalog.btrim(update_source_revision),
    ''
  );

  if update_source is null
    or char_length(update_source) not between 2 and 50 then
    raise exception 'A valid update source is required';
  end if;

  if update_source_revision is not null
    and char_length(update_source_revision) > 100 then
    raise exception 'Source revision is limited to 100 characters';
  end if;

  if update_source_sequence is not null and update_source_sequence < 0 then
    raise exception using
      errcode = 'P2060',
      message = 'Source sequence must be non-negative.';
  end if;

  incoming_received_at := coalesce(update_received_at, clock_timestamp());
  if incoming_received_at > clock_timestamp() + interval '5 minutes' then
    raise exception using
      errcode = 'P2060',
      message = 'Source event time is too far in the future.';
  end if;

  select policy.* into source_policy
  from public.port_call_source_policies policy
  where policy.organization_id = target_call.organization_id
    and policy.source = update_source
    and policy.active = true;

  if found then
    incoming_priority := source_policy.priority;
    ordered_updates_required := source_policy.ordered_updates_required;
  end if;

  incoming_sequence := coalesce(
    update_source_sequence,
    public.maritime_revision_sequence(update_source_revision)
  );
  incoming_payload_fingerprint :=
    public.maritime_timing_payload_fingerprint(
      new_status,
      new_estimated_arrival_at,
      new_estimated_departure_at,
      update_source,
      update_source_revision,
      incoming_sequence
    );

  select cursor.* into source_cursor
  from public.port_call_source_cursors cursor
  where cursor.port_call_id = target_call.id
    and cursor.source = update_source
  for update;

  -- Revision/sequence identity and payload identity are separate. Retrying the
  -- exact same event is harmless; reusing an identity for different timing is
  -- an explicit collision rather than a false idempotent success.
  if update_source_revision is not null then
    select revision.* into known_revision
    from public.port_call_revisions revision
    where revision.port_call_id = target_call.id
      and pg_catalog.lower(pg_catalog.btrim(revision.source)) = update_source
      and revision.source_revision = update_source_revision
      and revision.revision_kind = 'source'
    order by revision.id
    limit 1;
  elsif source_cursor.port_call_id is not null
    and source_cursor.last_sequence is not distinct from incoming_sequence then
    known_revision.payload_fingerprint :=
      source_cursor.last_payload_fingerprint;
    known_revision.source_sequence := source_cursor.last_sequence;
  end if;

  if known_revision.payload_fingerprint is not null then
    if known_revision.payload_fingerprint = incoming_payload_fingerprint
      and known_revision.source_sequence is not distinct from incoming_sequence
    then
      return jsonb_build_object(
        'changed', false,
        'duplicateRevision', true,
        'staleReplayRejected', false,
        'portCallId', target_call.id,
        'impactCount', 0,
        'generatedRequirementCount', 0,
        'sourceRevision', target_call.source_revision,
        'sourceSequence', target_call.source_sequence,
        'timingLockVersion', target_call.timing_lock_version,
        'payloadFingerprint', incoming_payload_fingerprint
      );
    end if;

    raise exception using
      errcode = 'P2065',
      message = 'Maritime revision/sequence collision with a different payload.';
  end if;

  if expected_timing_lock_version is not null
    and target_call.timing_lock_version <> expected_timing_lock_version then
    raise exception using
      errcode = 'P2063',
      message = format(
        'Port call changed concurrently (expected timing lock %s, current timing lock %s).',
        expected_timing_lock_version,
        target_call.timing_lock_version
      );
  end if;

  if enforce_compare_and_swap
    and target_call.source_revision
      is distinct from expected_current_source_revision then
    raise exception using
      errcode = 'P2063',
      message = format(
        'Port call changed concurrently (expected source revision %s, current source revision %s).',
        coalesce(expected_current_source_revision, '<null>'),
        coalesce(target_call.source_revision, '<null>')
      );
  end if;

  if incoming_priority < target_call.source_priority
    and not allow_priority_override then
    raise exception using
      errcode = 'P2061',
      message = format(
        'Lower-priority maritime source rejected (%s < %s).',
        incoming_priority,
        target_call.source_priority
      );
  end if;

  if update_source <> target_call.source
    and incoming_priority = target_call.source_priority
    and (
      not enforce_compare_and_swap
      or incoming_received_at <= target_call.source_received_at
    ) then
    raise exception using
      errcode = 'P2061',
      message = 'Equal-priority source takeover requires CAS and a newer event time.';
  end if;

  if source_cursor.port_call_id is not null then
    if incoming_received_at < source_cursor.last_received_at then
      raise exception using
        errcode = 'P2062',
        message = 'Out-of-order maritime event time rejected.';
    end if;

    if ordered_updates_required then
      if incoming_sequence is null then
        raise exception using
          errcode = 'P2062',
          message = 'This maritime source requires a monotonic sequence.';
      end if;

      if source_cursor.last_sequence is not null
        and incoming_sequence <= source_cursor.last_sequence then
        raise exception using
          errcode = 'P2062',
          message = format(
            'Stale maritime sequence rejected (%s <= %s).',
            incoming_sequence,
            source_cursor.last_sequence
          );
      end if;
    end if;
  elsif ordered_updates_required and incoming_sequence is null then
    raise exception using
      errcode = 'P2062',
      message = 'This maritime source requires a monotonic sequence.';
  end if;

  previous_arrival := coalesce(
    target_call.estimated_arrival_at,
    target_call.scheduled_arrival_at
  );
  previous_departure := coalesce(
    target_call.estimated_departure_at,
    target_call.scheduled_departure_at
  );
  effective_new_arrival := coalesce(
    new_estimated_arrival_at,
    target_call.scheduled_arrival_at
  );
  effective_new_departure := coalesce(
    new_estimated_departure_at,
    target_call.scheduled_departure_at
  );

  if new_status <> 'cancelled'
    and effective_new_arrival is not null
    and effective_new_departure is not null
    and effective_new_departure < effective_new_arrival then
    raise exception 'Departure cannot precede arrival';
  end if;

  if previous_arrival is not null and effective_new_arrival is not null then
    arrival_delta_minutes := round(
      extract(epoch from (effective_new_arrival - previous_arrival)) / 60
    );
  end if;

  if previous_departure is not null and effective_new_departure is not null then
    departure_delta_minutes := round(
      extract(epoch from (effective_new_departure - previous_departure)) / 60
    );
  end if;

  primary_delta_minutes := case
    when abs(arrival_delta_minutes) >= abs(departure_delta_minutes)
      then arrival_delta_minutes
    else departure_delta_minutes
  end;

  operational_change := target_call.status is distinct from new_status
    or target_call.estimated_arrival_at
      is distinct from new_estimated_arrival_at
    or target_call.estimated_departure_at
      is distinct from new_estimated_departure_at;

  select site.* into target_site
  from public.sites site
  where site.id = target_call.site_id;

  previous_anchor := coalesce(previous_arrival, previous_departure);
  current_anchor := coalesce(effective_new_arrival, effective_new_departure);

  select coalesce(
    array_agg(period_id order by starts_on, period_id),
    '{}'::uuid[]
  )
  into previous_period_ids
  from (
    select distinct period.id as period_id, period.starts_on
    from public.planning_periods period
    cross join lateral (
      values (previous_arrival), (previous_departure)
    ) anchor(anchor_at)
    where period.site_id = target_call.site_id
      and anchor.anchor_at is not null
      and (anchor.anchor_at at time zone period.timezone)::date
        between period.starts_on and period.ends_on
  ) touched_previous;

  select period.* into previous_period
  from public.planning_periods period
  where period.id = any(previous_period_ids)
  order by period.starts_on, period.id
  limit 1;

  perform set_config('app.ordered_port_call_update', 'true', true);

  update public.port_calls port_call
  set estimated_arrival_at = new_estimated_arrival_at,
      estimated_departure_at = new_estimated_departure_at,
      status = new_status,
      source = update_source,
      source_revision = update_source_revision,
      source_priority = incoming_priority,
      source_sequence = incoming_sequence,
      source_received_at = incoming_received_at,
      timing_lock_version = port_call.timing_lock_version + 1,
      timing_payload_fingerprint = incoming_payload_fingerprint,
      source_override_until = case
        when allow_priority_override then port_call.source_override_until
        else null
      end,
      received_at = incoming_received_at,
      updated_at = now()
  where port_call.id = target_call.id;

  if not allow_priority_override
    and target_call.source_override_until is not null then
    update public.port_call_source_overrides source_override
    set resumed_at = clock_timestamp(),
        resumed_by_source = update_source
    where source_override.port_call_id = target_call.id
      and source_override.resumed_at is null;
  end if;

  perform set_config('app.ordered_port_call_update', '', true);

  insert into public.port_call_source_cursors (
    organization_id,
    site_id,
    port_call_id,
    source,
    source_priority,
    last_sequence,
    last_revision,
    last_payload_fingerprint,
    last_received_at,
    accepted_count
  ) values (
    target_call.organization_id,
    target_call.site_id,
    target_call.id,
    update_source,
    incoming_priority,
    incoming_sequence,
    update_source_revision,
    incoming_payload_fingerprint,
    incoming_received_at,
    1
  )
  on conflict (port_call_id, source) do update
  set source_priority = excluded.source_priority,
      last_sequence = excluded.last_sequence,
      last_revision = excluded.last_revision,
      last_payload_fingerprint = excluded.last_payload_fingerprint,
      last_received_at = excluded.last_received_at,
      accepted_count = public.port_call_source_cursors.accepted_count + 1,
      updated_at = now();

  if not operational_change then
    return jsonb_build_object(
      'changed', false,
      'metadataAdvanced', true,
      'portCallId', target_call.id,
      'impactCount', 0,
      'generatedRequirementCount', 0,
      'sourceRevision', update_source_revision,
      'sourceSequence', incoming_sequence,
      'timingLockVersion', target_call.timing_lock_version + 1,
      'payloadFingerprint', incoming_payload_fingerprint
    );
  end if;

  if new_status = 'cancelled' then
    event_kind := 'cancellation';
  elsif arrival_delta_minutes >= 0
    and departure_delta_minutes >= 0
    and (arrival_delta_minutes > 0 or departure_delta_minutes > 0) then
    event_kind := 'delay';
  elsif arrival_delta_minutes <= 0
    and departure_delta_minutes <= 0
    and (arrival_delta_minutes < 0 or departure_delta_minutes < 0) then
    event_kind := 'advance';
  else
    event_kind := 'time_correction';
  end if;

  insert into public.disruption_events (
    organization_id,
    site_id,
    port_call_id,
    kind,
    previous_arrival_at,
    new_arrival_at,
    previous_departure_at,
    new_departure_at,
    source,
    source_revision,
    created_by
  ) values (
    target_call.organization_id,
    target_call.site_id,
    target_call.id,
    event_kind,
    previous_arrival,
    effective_new_arrival,
    previous_departure,
    effective_new_departure,
    update_source,
    update_source_revision,
    (select auth.uid())
  )
  returning * into disruption;

  -- Provision both new arrival/departure weeks, then clean every old-only
  -- anchor week. All loops are chronological to avoid cross-week deadlocks.
  workspace_result := public.ensure_planning_workspace_for_port_call(
    target_call.id
  );

  select coalesce(
    array_agg(period_id order by starts_on, period_id),
    '{}'::uuid[]
  )
  into current_period_ids
  from (
    select distinct period.id as period_id, period.starts_on
    from public.planning_periods period
    cross join lateral (
      values (effective_new_arrival), (effective_new_departure)
    ) anchor(anchor_at)
    where period.site_id = target_call.site_id
      and anchor.anchor_at is not null
      and (anchor.anchor_at at time zone period.timezone)::date
        between period.starts_on and period.ends_on
  ) touched_current;

  select period.* into current_period
  from public.planning_periods period
  where period.id = any(current_period_ids)
  order by period.starts_on, period.id
  limit 1;

  select coalesce(
    array_agg(period_id order by starts_on, period_id),
    '{}'::uuid[]
  )
  into touched_period_ids
  from (
    select distinct period.id as period_id, period.starts_on
    from public.planning_periods period
    where period.id = any(previous_period_ids || current_period_ids)
  ) touched;

  for affected_period in
    select period.*
    from public.planning_periods period
    where period.id = any(previous_period_ids)
      and not (period.id = any(current_period_ids))
    order by period.starts_on, period.id
  loop
    requirements_result := public.generate_staffing_requirements(
      affected_period.id
    );
  end loop;

  select count(*)::integer
  into generated_requirement_count
  from public.staffing_requirements requirement
  where requirement.planning_period_id = any(current_period_ids)
    and requirement.port_call_id = target_call.id
    and requirement.retired_at is null;

  -- A call can touch up to four old/new arrival/departure commitments.
  -- Supersede unresolved analyses for each affected version, then create one
  -- scenario per published version in deterministic period order.
  for base_schedule in
    select schedule.*
    from public.schedule_versions schedule
    join public.planning_periods period
      on period.id = schedule.planning_period_id
    where schedule.site_id = target_call.site_id
      and schedule.status = 'published'
      and schedule.planning_period_id = any(touched_period_ids)
    order by period.starts_on, schedule.version_number, schedule.id
  loop
    update public.replanning_scenarios prior_scenario
    set status = 'rejected',
        summary = left(
          concat_ws(
            E'\n',
            prior_scenario.summary,
            'Analyse remplacée par une révision maritime plus récente.'
          ),
          1000
        ),
        updated_at = now()
    from public.disruption_events prior_disruption
    where prior_scenario.disruption_event_id = prior_disruption.id
      and prior_disruption.port_call_id = target_call.id
      and prior_scenario.base_schedule_version_id = base_schedule.id
      and prior_scenario.status in ('draft', 'simulated');

    insert into public.replanning_scenarios (
      organization_id,
      site_id,
      disruption_event_id,
      base_schedule_version_id,
      status,
      title,
      summary,
      created_by
    ) values (
      target_call.organization_id,
      target_call.site_id,
      disruption.id,
      base_schedule.id,
      'simulated',
      case event_kind
        when 'delay' then 'Retard de l’escale'
        when 'advance' then 'Avance de l’escale'
        when 'cancellation' then 'Annulation de l’escale'
        else 'Correction des horaires de l’escale'
      end,
      case
        when event_kind = 'cancellation' then
          'Les affectations liées doivent être annulées ou réattribuées.'
        else format(
          'Décalage arrivée : %s min. Décalage départ : %s min.',
          arrival_delta_minutes,
          departure_delta_minutes
        )
      end,
      (select auth.uid())
    )
    returning * into scenario;

    if first_scenario_id is null then
      first_scenario_id := scenario.id;
    end if;
    scenario_ids := scenario_ids || jsonb_build_array(scenario.id);

    insert into public.replanning_impacts (
      organization_id,
      site_id,
      scenario_id,
      severity,
      impact_type,
      agent_id,
      planning_shift_id,
      details
    )
    select
      target_call.organization_id,
      target_call.site_id,
      scenario.id,
      case
        when event_kind = 'cancellation' then 'critical'::public.impact_severity
        when abs(anchor_delta.delta_minutes) >= 60
          then 'warning'::public.impact_severity
        else 'information'::public.impact_severity
      end,
      case
        when event_kind = 'cancellation' then 'assignment.cancellation'
        else 'assignment.time_shift'
      end,
      shift.agent_id,
      shift.id,
      jsonb_build_object(
        'shiftAssignmentId', assignment.id,
        'portCallId', target_call.id,
        'positionId', assignment.position_id,
        'anchor', anchor_delta.anchor_name,
        'previousStartsAt', assignment.starts_at,
        'previousEndsAt', assignment.ends_at,
        'proposedStartsAt', case
          when event_kind = 'cancellation' then null
          else assignment.starts_at
            + make_interval(mins => anchor_delta.delta_minutes)
        end,
        'proposedEndsAt', case
          when event_kind = 'cancellation' then null
          else assignment.ends_at
            + make_interval(mins => anchor_delta.delta_minutes)
        end,
        'arrivalDeltaMinutes', arrival_delta_minutes,
        'departureDeltaMinutes', departure_delta_minutes,
        'deltaMinutes', anchor_delta.delta_minutes,
        'previousPlanningPeriodId', previous_period.id,
        'currentPlanningPeriodId', current_period.id,
        'previousPlanningPeriodIds', to_jsonb(previous_period_ids),
        'currentPlanningPeriodIds', to_jsonb(current_period_ids),
        'touchedPlanningPeriodIds', to_jsonb(touched_period_ids)
      )
    from public.shift_assignments assignment
    join public.planning_shifts shift
      on shift.id = assignment.planning_shift_id
    left join public.staffing_requirements requirement
      on requirement.id = assignment.staffing_requirement_id
    left join public.demand_profile_lines profile_line
      on profile_line.id = requirement.demand_profile_line_id
    cross join lateral (
      select
        case
          when profile_line.anchor is not null then profile_line.anchor::text
          when previous_arrival is null then 'departure'
          when previous_departure is null then 'arrival'
          when abs(extract(epoch from (assignment.starts_at - previous_arrival)))
            <= abs(extract(epoch from (assignment.starts_at - previous_departure)))
            then 'arrival'
          else 'departure'
        end as anchor_name,
        case
          when profile_line.anchor = 'arrival' then arrival_delta_minutes
          when profile_line.anchor = 'departure' then departure_delta_minutes
          when previous_arrival is null then departure_delta_minutes
          when previous_departure is null then arrival_delta_minutes
          when abs(extract(epoch from (assignment.starts_at - previous_arrival)))
            <= abs(extract(epoch from (assignment.starts_at - previous_departure)))
            then arrival_delta_minutes
          else departure_delta_minutes
        end as delta_minutes
    ) anchor_delta
    where assignment.port_call_id = target_call.id
      and shift.schedule_version_id = base_schedule.id
      and (event_kind = 'cancellation' or anchor_delta.delta_minutes <> 0);

    get diagnostics scenario_impact_count = row_count;

    if scenario_impact_count = 0 then
      insert into public.replanning_impacts (
        organization_id,
        site_id,
        scenario_id,
        severity,
        impact_type,
        details
      ) values (
        target_call.organization_id,
        target_call.site_id,
        scenario.id,
        'warning',
        'coverage.requirement_changed',
        jsonb_build_object(
          'portCallId', target_call.id,
          'previousPlanningPeriodId', previous_period.id,
          'currentPlanningPeriodId', current_period.id,
          'previousPlanningPeriodIds', to_jsonb(previous_period_ids),
          'currentPlanningPeriodIds', to_jsonb(current_period_ids),
          'touchedPlanningPeriodIds', to_jsonb(touched_period_ids),
          'reason', case
            when event_kind = 'cancellation' then 'cancelled'
            when previous_period_ids is distinct from current_period_ids
              then 'cross_period_move'
            else 'timing_change'
          end
        )
      );
      scenario_impact_count := 1;
    end if;

    impact_count := impact_count + scenario_impact_count;
  end loop;

  insert into public.outbox_events (
    organization_id,
    site_id,
    topic,
    aggregate_type,
    aggregate_id,
    payload,
    idempotency_key
  ) values (
    target_call.organization_id,
    target_call.site_id,
    'planning.port_call.disrupted',
    'port_call',
    target_call.id,
    jsonb_build_object(
      'portCallId', target_call.id,
      'disruptionEventId', disruption.id,
      'scenarioId', first_scenario_id,
      'scenarioIds', scenario_ids,
      'previousPlanningPeriodId', previous_period.id,
      'currentPlanningPeriodId', current_period.id,
      'previousPlanningPeriodIds', to_jsonb(previous_period_ids),
      'currentPlanningPeriodIds', to_jsonb(current_period_ids),
      'touchedPlanningPeriodIds', to_jsonb(touched_period_ids),
      'kind', event_kind,
      'deltaMinutes', primary_delta_minutes,
      'arrivalDeltaMinutes', arrival_delta_minutes,
      'departureDeltaMinutes', departure_delta_minutes,
      'impactCount', impact_count,
      'generatedRequirementCount', generated_requirement_count,
      'sourceSequence', incoming_sequence
    ),
    'port-call-disruption-' || disruption.id::text
  );

  return jsonb_build_object(
    'changed', true,
    'portCallId', target_call.id,
    'disruptionEventId', disruption.id,
    'scenarioId', first_scenario_id,
    'scenarioIds', scenario_ids,
    'previousPlanningPeriodId', previous_period.id,
    'currentPlanningPeriodId', current_period.id,
    'previousPlanningPeriodIds', to_jsonb(previous_period_ids),
    'currentPlanningPeriodIds', to_jsonb(current_period_ids),
    'touchedPlanningPeriodIds', to_jsonb(touched_period_ids),
    'kind', event_kind,
    'deltaMinutes', primary_delta_minutes,
    'arrivalDeltaMinutes', arrival_delta_minutes,
    'departureDeltaMinutes', departure_delta_minutes,
    'impactCount', impact_count,
    'generatedRequirementCount', generated_requirement_count,
    'sourceRevision', update_source_revision,
    'sourceSequence', incoming_sequence,
    'timingLockVersion', target_call.timing_lock_version + 1,
    'payloadFingerprint', incoming_payload_fingerprint
  );
end;
$$;

revoke all on function public.apply_ordered_port_call_timing_update(
  uuid,
  timestamptz,
  timestamptz,
  public.port_call_status,
  text,
  text,
  bigint,
  text,
  timestamptz,
  bigint,
  boolean,
  boolean
) from public, anon, authenticated;

-- Backward-compatible interactive command. Registered ordered sources still
-- have to provide a numeric revision (which is parsed as their sequence).
create or replace function public.update_port_call_timing(
  target_port_call_id uuid,
  new_estimated_arrival_at timestamptz,
  new_estimated_departure_at timestamptz,
  new_status public.port_call_status,
  update_source text,
  update_source_revision text default null
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.apply_ordered_port_call_timing_update(
    target_port_call_id,
    new_estimated_arrival_at,
    new_estimated_departure_at,
    new_status,
    update_source,
    update_source_revision,
    null,
    null,
    clock_timestamp(),
    null,
    false,
    false
  );
$$;

-- Ordered ingestion command: the sequence is monotonic per escale/source and
-- expected_current_source_revision is a null-safe compare-and-swap token.
create or replace function public.update_port_call_timing(
  target_port_call_id uuid,
  new_estimated_arrival_at timestamptz,
  new_estimated_departure_at timestamptz,
  new_status public.port_call_status,
  update_source text,
  update_source_revision text,
  update_source_sequence bigint,
  expected_current_source_revision text,
  update_received_at timestamptz
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.apply_ordered_port_call_timing_update(
    target_port_call_id,
    new_estimated_arrival_at,
    new_estimated_departure_at,
    new_status,
    update_source,
    update_source_revision,
    update_source_sequence,
    expected_current_source_revision,
    update_received_at,
    null,
    true,
    false
  );
$$;

-- Robust ingestion overload. The monotonic timing lock is the authoritative
-- CAS token; source revision remains available as an additional diagnostic.
create or replace function public.update_port_call_timing(
  target_port_call_id uuid,
  new_estimated_arrival_at timestamptz,
  new_estimated_departure_at timestamptz,
  new_status public.port_call_status,
  update_source text,
  update_source_revision text,
  update_source_sequence bigint,
  expected_current_source_revision text,
  update_received_at timestamptz,
  expected_timing_lock_version bigint
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.apply_ordered_port_call_timing_update(
    target_port_call_id,
    new_estimated_arrival_at,
    new_estimated_departure_at,
    new_status,
    update_source,
    update_source_revision,
    update_source_sequence,
    expected_current_source_revision,
    update_received_at,
    expected_timing_lock_version,
    true,
    false
  );
$$;

revoke all on function public.update_port_call_timing(
  uuid,
  timestamptz,
  timestamptz,
  public.port_call_status,
  text,
  text
) from public, anon, authenticated;
revoke all on function public.update_port_call_timing(
  uuid,
  timestamptz,
  timestamptz,
  public.port_call_status,
  text,
  text,
  bigint,
  text,
  timestamptz
) from public, anon, authenticated;
revoke all on function public.update_port_call_timing(
  uuid,
  timestamptz,
  timestamptz,
  public.port_call_status,
  text,
  text,
  bigint,
  text,
  timestamptz,
  bigint
) from public, anon, authenticated;

grant execute on function public.update_port_call_timing(
  uuid,
  timestamptz,
  timestamptz,
  public.port_call_status,
  text,
  text
) to authenticated;
grant execute on function public.update_port_call_timing(
  uuid,
  timestamptz,
  timestamptz,
  public.port_call_status,
  text,
  text,
  bigint,
  text,
  timestamptz
) to authenticated;

create or replace function public.apply_port_call_timing_override(
  target_port_call_id uuid,
  new_estimated_arrival_at timestamptz,
  new_estimated_departure_at timestamptz,
  new_status public.port_call_status,
  override_source text,
  override_source_revision text,
  expected_current_source_revision text,
  expected_timing_lock_version bigint,
  override_reason text,
  override_valid_until timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_call public.port_calls;
  updated_call public.port_calls;
  created_override public.port_call_source_overrides;
  update_result jsonb;
begin
  select port_call.* into target_call
  from public.port_calls port_call
  where port_call.id = target_port_call_id
  for update;

  if not found then
    raise exception 'Port call not found';
  end if;

  if not public.has_role(
    target_call.organization_id,
    target_call.site_id,
    array[
      'platform_admin',
      'planning_admin',
      'approver'
    ]::public.app_role[]
  ) then
    raise exception 'Insufficient permissions';
  end if;

  if override_reason is null
    or char_length(pg_catalog.btrim(override_reason)) not between 3 and 500 then
    raise exception 'A valid override reason is required';
  end if;

  if override_valid_until < clock_timestamp() + interval '5 minutes'
    or override_valid_until > clock_timestamp() + interval '24 hours' then
    raise exception using
      errcode = 'P2064',
      message = 'A source override must be bounded between 5 minutes and 24 hours.';
  end if;

  update_result := public.apply_ordered_port_call_timing_update(
    target_port_call_id,
    new_estimated_arrival_at,
    new_estimated_departure_at,
    new_status,
    override_source,
    override_source_revision,
    null,
    expected_current_source_revision,
    clock_timestamp(),
    expected_timing_lock_version,
    true,
    true
  );

  update public.port_calls port_call
  set source_override_until = override_valid_until,
      updated_at = now()
  where port_call.id = target_call.id
  returning port_call.* into updated_call;

  insert into public.port_call_source_overrides (
    organization_id,
    site_id,
    port_call_id,
    previous_state,
    override_state,
    reason,
    valid_until,
    created_by
  ) values (
    target_call.organization_id,
    target_call.site_id,
    target_call.id,
    jsonb_build_object(
      'status', target_call.status,
      'estimatedArrivalAt', target_call.estimated_arrival_at,
      'estimatedDepartureAt', target_call.estimated_departure_at,
      'source', target_call.source,
      'sourceRevision', target_call.source_revision,
      'sourceSequence', target_call.source_sequence,
      'sourcePriority', target_call.source_priority,
      'timingLockVersion', target_call.timing_lock_version,
      'payloadFingerprint', target_call.timing_payload_fingerprint
    ),
    jsonb_build_object(
      'status', updated_call.status,
      'estimatedArrivalAt', updated_call.estimated_arrival_at,
      'estimatedDepartureAt', updated_call.estimated_departure_at,
      'source', updated_call.source,
      'sourceRevision', updated_call.source_revision,
      'sourceSequence', updated_call.source_sequence,
      'sourcePriority', updated_call.source_priority,
      'timingLockVersion', updated_call.timing_lock_version,
      'payloadFingerprint', updated_call.timing_payload_fingerprint
    ),
    pg_catalog.btrim(override_reason),
    override_valid_until,
    (select auth.uid())
  )
  returning * into created_override;

  return update_result || jsonb_build_object(
    'sourceOverrideId', created_override.id,
    'sourceOverrideUntil', created_override.valid_until,
    'previousSource', target_call.source,
    'resumableByHigherPrioritySource', true
  );
end;
$$;

revoke all on function public.apply_port_call_timing_override(
  uuid,
  timestamptz,
  timestamptz,
  public.port_call_status,
  text,
  text,
  text,
  bigint,
  text,
  timestamptz
) from public, anon, authenticated;

create or replace function public.override_port_call_timing(
  target_port_call_id uuid,
  new_estimated_arrival_at timestamptz,
  new_estimated_departure_at timestamptz,
  new_status public.port_call_status,
  override_source text,
  override_source_revision text,
  expected_current_source_revision text,
  override_reason text,
  override_valid_until timestamptz
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.apply_port_call_timing_override(
    target_port_call_id,
    new_estimated_arrival_at,
    new_estimated_departure_at,
    new_status,
    override_source,
    override_source_revision,
    expected_current_source_revision,
    null,
    override_reason,
    override_valid_until
  );
$$;

create or replace function public.override_port_call_timing(
  target_port_call_id uuid,
  new_estimated_arrival_at timestamptz,
  new_estimated_departure_at timestamptz,
  new_status public.port_call_status,
  override_source text,
  override_source_revision text,
  expected_current_source_revision text,
  expected_timing_lock_version bigint,
  override_reason text,
  override_valid_until timestamptz
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.apply_port_call_timing_override(
    target_port_call_id,
    new_estimated_arrival_at,
    new_estimated_departure_at,
    new_status,
    override_source,
    override_source_revision,
    expected_current_source_revision,
    expected_timing_lock_version,
    override_reason,
    override_valid_until
  );
$$;

revoke all on function public.override_port_call_timing(
  uuid,
  timestamptz,
  timestamptz,
  public.port_call_status,
  text,
  text,
  text,
  text,
  timestamptz
) from public, anon, authenticated;
revoke all on function public.override_port_call_timing(
  uuid,
  timestamptz,
  timestamptz,
  public.port_call_status,
  text,
  text,
  text,
  bigint,
  text,
  timestamptz
) from public, anon, authenticated;
grant execute on function public.override_port_call_timing(
  uuid,
  timestamptz,
  timestamptz,
  public.port_call_status,
  text,
  text,
  text,
  text,
  timestamptz
) to authenticated;

create or replace function public.sync_planning_from_port_call()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_period public.planning_periods;
begin
  -- The ordered RPC performs one controlled regeneration after the source
  -- cursor has been advanced. Direct demand-profile updates still use this
  -- trigger path.
  if current_setting('app.ordered_port_call_update', true) = 'true' then
    return new;
  end if;

  perform public.ensure_planning_workspace_for_port_call(new.id);

  if tg_op <> 'UPDATE' then
    return new;
  end if;

  for affected_period in
    select period.*
    from public.planning_periods period
    where period.id in (
      select candidate_period.id
      from public.planning_periods candidate_period
      cross join lateral (
        values
          (coalesce(old.estimated_arrival_at, old.scheduled_arrival_at)),
          (coalesce(old.estimated_departure_at, old.scheduled_departure_at))
      ) previous_anchor(anchor_at)
      where candidate_period.site_id = old.site_id
        and previous_anchor.anchor_at is not null
        and (
          previous_anchor.anchor_at at time zone candidate_period.timezone
        )::date between candidate_period.starts_on and candidate_period.ends_on
        and not exists (
          select 1
          from (
            values
              (coalesce(new.estimated_arrival_at, new.scheduled_arrival_at)),
              (coalesce(new.estimated_departure_at, new.scheduled_departure_at))
          ) current_anchor(anchor_at)
          where current_anchor.anchor_at is not null
            and (
              current_anchor.anchor_at at time zone candidate_period.timezone
            )::date between candidate_period.starts_on
              and candidate_period.ends_on
        )
    )
    order by period.starts_on, period.id
  loop
    perform public.generate_staffing_requirements(affected_period.id);
  end loop;

  return new;
end;
$$;

create or replace function public.ensure_editable_schedule_from_port_call()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_site public.sites;
  target_period public.planning_periods;
  effective_anchor timestamptz;
  call_date date;
begin
  if current_setting('app.ordered_port_call_update', true) = 'true'
    or new.status = 'cancelled' then
    return new;
  end if;

  select site.* into target_site
  from public.sites site
  where site.id = new.site_id;

  effective_anchor := coalesce(
    new.estimated_arrival_at,
    new.scheduled_arrival_at,
    new.estimated_departure_at,
    new.scheduled_departure_at
  );

  if effective_anchor is null or target_site.id is null then
    return new;
  end if;

  call_date := (effective_anchor at time zone target_site.timezone)::date;

  select period.* into target_period
  from public.planning_periods period
  where period.site_id = new.site_id
    and call_date between period.starts_on and period.ends_on
  order by period.starts_on desc
  limit 1;

  if target_period.id is not null then
    perform public.ensure_editable_schedule_for_period(target_period.id);
  end if;

  return new;
end;
$$;

revoke all on function public.sync_planning_from_port_call()
from public, anon, authenticated;
revoke all on function public.ensure_editable_schedule_from_port_call()
from public, anon, authenticated;

-- Monthly counters must aggregate every effective weekly publication, not only
-- the single schedule selected for the displayed week.
create or replace function public.get_agent_hour_balance(
  target_agent_id uuid,
  target_week_start date,
  target_schedule_version_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_agent public.agents;
  target_site public.sites;
  selected_period public.planning_periods;
  individual_target public.hour_target_overrides;
  group_target public.hour_target_overrides;
  selected_schedule_id uuid;
  selected_period_id uuid;
  weekly_target_minutes integer := 0;
  monthly_target_minutes integer;
  scheduled_week_minutes integer := 0;
  scheduled_month_minutes integer := 0;
  worked_month_minutes integer := 0;
  target_source text := 'none';
  month_start date;
  month_end date;
  week_start_at timestamptz;
  week_end_at timestamptz;
  month_start_at timestamptz;
  month_end_at timestamptz;
begin
  if not public.is_current_app_user_active() then
    raise exception 'Active account required';
  end if;

  if extract(isodow from target_week_start) <> 1 then
    raise exception 'Week start must be a Monday';
  end if;

  select agent.* into target_agent
  from public.agents agent
  where agent.id = target_agent_id;

  if target_agent.id is null then
    raise exception 'Agent not found';
  end if;

  if target_agent.user_id is distinct from (select auth.uid())
    and not public.has_role(
      target_agent.organization_id,
      target_agent.primary_site_id,
      array[
        'platform_admin',
        'planning_admin',
        'planner',
        'approver',
        'supervisor',
        'hr',
        'auditor'
      ]::public.app_role[]
    ) then
    raise exception 'Insufficient permissions';
  end if;

  select site.* into target_site
  from public.sites site
  where site.id = target_agent.primary_site_id;

  month_start := date_trunc('month', target_week_start)::date;
  month_end := (
    date_trunc('month', target_week_start) + interval '1 month'
  )::date;
  week_start_at := target_week_start::timestamp
    at time zone target_site.timezone;
  week_end_at := (target_week_start + 7)::timestamp
    at time zone target_site.timezone;
  month_start_at := month_start::timestamp at time zone target_site.timezone;
  month_end_at := month_end::timestamp at time zone target_site.timezone;

  -- Each date contributes one seventh of the weekly target effective on that
  -- date. A primary group value overrides its contract value for that day.
  with calendar_day as (
    select day_value::date as work_date
    from generate_series(
      target_week_start::timestamp,
      (target_week_start + 6)::timestamp,
      interval '1 day'
    ) day_value
  ),
  daily_target as (
    select
      calendar_day.work_date,
      contract.id as contract_id,
      agent_group.id as group_id,
      coalesce(
        agent_group.weekly_target_minutes,
        contract.weekly_target_minutes,
        0
      ) as target_minutes,
      agent_group.weekly_target_minutes is not null as uses_group
    from calendar_day
    left join lateral (
      select contract.*
      from public.agent_contract_versions contract
      where contract.agent_id = target_agent.id
        and contract.effective_from <= calendar_day.work_date
        and (
          contract.effective_until is null
          or contract.effective_until >= calendar_day.work_date
        )
      order by contract.effective_from desc, contract.id
      limit 1
    ) contract on true
    left join lateral (
      select agent_group.*
      from public.agent_group_memberships membership
      join public.agent_groups agent_group
        on agent_group.id = membership.group_id
      where membership.agent_id = target_agent.id
        and membership.is_primary = true
        and membership.effective_from <= calendar_day.work_date
        and (
          membership.effective_until is null
          or membership.effective_until >= calendar_day.work_date
        )
        and agent_group.active = true
      order by membership.effective_from desc, membership.id
      limit 1
    ) agent_group on true
  )
  select
    round(sum(target_minutes::numeric / 7))::integer,
    case
      when bool_and(uses_group) then 'group'
      when bool_and(not uses_group and contract_id is not null) then 'contract'
      when bool_or(group_id is not null or contract_id is not null)
        then 'prorated_effective_targets'
      else 'none'
    end
  into weekly_target_minutes, target_source
  from daily_target;

  -- Monthly targets are nominal full-month values. Contract/group changes are
  -- prorated per effective calendar day; days without a target contribute 0.
  with calendar_day as (
    select day_value::date as work_date
    from generate_series(
      month_start::timestamp,
      (month_end - 1)::timestamp,
      interval '1 day'
    ) day_value
  ),
  daily_target as (
    select coalesce(
      agent_group.monthly_target_minutes,
      contract.monthly_target_minutes
    ) as target_minutes
    from calendar_day
    left join lateral (
      select contract.*
      from public.agent_contract_versions contract
      where contract.agent_id = target_agent.id
        and contract.effective_from <= calendar_day.work_date
        and (
          contract.effective_until is null
          or contract.effective_until >= calendar_day.work_date
        )
      order by contract.effective_from desc, contract.id
      limit 1
    ) contract on true
    left join lateral (
      select agent_group.*
      from public.agent_group_memberships membership
      join public.agent_groups agent_group
        on agent_group.id = membership.group_id
      where membership.agent_id = target_agent.id
        and membership.is_primary = true
        and membership.effective_from <= calendar_day.work_date
        and (
          membership.effective_until is null
          or membership.effective_until >= calendar_day.work_date
        )
        and agent_group.active = true
      order by membership.effective_from desc, membership.id
      limit 1
    ) agent_group on true
  )
  select case
    when count(target_minutes) = 0 then null::integer
    else round(sum(
      coalesce(target_minutes, 0)::numeric / (month_end - month_start)
    ))::integer
  end
  into monthly_target_minutes
  from daily_target;

  select target.* into group_target
  from public.hour_target_overrides target
  join public.agent_group_memberships membership
    on membership.group_id = target.group_id
  where membership.agent_id = target_agent.id
    and membership.is_primary = true
    and membership.effective_from <= target_week_start
    and (
      membership.effective_until is null
      or membership.effective_until >= target_week_start
    )
    and target.week_start = target_week_start
  order by membership.effective_from desc, target.created_at desc
  limit 1;

  if group_target.id is not null then
    weekly_target_minutes := group_target.target_minutes;
    target_source := 'group_override';
  end if;

  select target.* into individual_target
  from public.hour_target_overrides target
  where target.agent_id = target_agent.id
    and target.week_start = target_week_start
  order by target.created_at desc
  limit 1;

  if individual_target.id is not null then
    weekly_target_minutes := individual_target.target_minutes;
    target_source := 'agent_override';
  end if;

  selected_schedule_id := target_schedule_version_id;

  if selected_schedule_id is null then
    select schedule.id into selected_schedule_id
    from public.schedule_versions schedule
    join public.planning_periods period
      on period.id = schedule.planning_period_id
    where schedule.organization_id = target_agent.organization_id
      and schedule.site_id = target_agent.primary_site_id
      and schedule.status = 'published'
      and target_week_start >= period.starts_on
      and target_week_start + 6 <= period.ends_on
    order by schedule.version_number desc
    limit 1;
  end if;

  if selected_schedule_id is not null then
    select period.* into selected_period
    from public.schedule_versions schedule
    join public.planning_periods period
      on period.id = schedule.planning_period_id
    where schedule.id = selected_schedule_id
      and schedule.organization_id = target_agent.organization_id
      and schedule.site_id = target_agent.primary_site_id;

    if selected_period.id is null then
      raise exception 'Schedule version is outside the agent scope';
    end if;

    if target_week_start < selected_period.starts_on
      or target_week_start + 6 > selected_period.ends_on then
      raise exception using
        errcode = 'P2071',
        message = 'Requested schedule version does not cover the requested week.';
    end if;

    selected_period_id := selected_period.id;
  end if;

  -- Boundary services are split by actual overlap. Breaks are allocated in
  -- proportion to elapsed service time so minutes cannot leak across weeks.
  select coalesce(round(sum(
    (
      extract(epoch from (
        least(shift.ends_at, week_end_at)
          - greatest(shift.starts_at, week_start_at)
      )) / 60
    ) * (
      greatest(
        0,
        extract(epoch from (shift.ends_at - shift.starts_at)) / 60
          - shift.break_minutes
      ) / (extract(epoch from (shift.ends_at - shift.starts_at)) / 60)
    )
  )), 0)::integer into scheduled_week_minutes
  from public.planning_shifts shift
  where shift.agent_id = target_agent.id
    and shift.schedule_version_id = selected_schedule_id
    and shift.starts_at < week_end_at
    and shift.ends_at > week_start_at;

  with effective_versions as (
    select selected_schedule_id as id
    where selected_schedule_id is not null

    union all

    select schedule.id
    from public.schedule_versions schedule
    join public.planning_periods period
      on period.id = schedule.planning_period_id
    where schedule.organization_id = target_agent.organization_id
      and schedule.site_id = target_agent.primary_site_id
      and schedule.status = 'published'
      and period.starts_on < month_end
      and period.ends_on + 1 >= month_start
      and schedule.planning_period_id is distinct from selected_period_id
  )
  select coalesce(round(sum(
    (
      extract(epoch from (
        least(shift.ends_at, month_end_at)
          - greatest(shift.starts_at, month_start_at)
      )) / 60
    ) * (
      greatest(
        0,
        extract(epoch from (shift.ends_at - shift.starts_at)) / 60
          - shift.break_minutes
      ) / (extract(epoch from (shift.ends_at - shift.starts_at)) / 60)
    )
  )), 0)::integer into scheduled_month_minutes
  from public.planning_shifts shift
  join effective_versions version on version.id = shift.schedule_version_id
  where shift.agent_id = target_agent.id
    and shift.starts_at < month_end_at
    and shift.ends_at > month_start_at;

  select coalesce(sum(
    coalesce(ledger.worked_minutes, ledger.planned_minutes)
      + ledger.adjustment_minutes
  ), 0)::integer into worked_month_minutes
  from public.time_ledger_entries ledger
  where ledger.agent_id = target_agent.id
    and ledger.work_date >= month_start
    and ledger.work_date < month_end;

  return jsonb_build_object(
    'agentId', target_agent.id,
    'weekStart', target_week_start,
    'scheduleVersionId', selected_schedule_id,
    'weeklyTargetMinutes', weekly_target_minutes,
    'weeklyTargetSource', target_source,
    'scheduledWeekMinutes', scheduled_week_minutes,
    'weeklyVarianceMinutes', scheduled_week_minutes - weekly_target_minutes,
    'monthlyTargetMinutes', monthly_target_minutes,
    'monthlyTargetCalculation', 'daily_calendar_proration',
    'scheduledMonthMinutes', scheduled_month_minutes,
    'scheduledBoundaryCalculation', 'interval_overlap_break_prorata',
    'workedMonthMinutes', worked_month_minutes,
    'monthlyVarianceMinutes', case
      when monthly_target_minutes is null then null
      else scheduled_month_minutes - monthly_target_minutes
    end
  );
end;
$$;

revoke all on function public.get_agent_hour_balance(uuid, date, uuid)
from public, anon, authenticated;
grant execute on function public.get_agent_hour_balance(uuid, date, uuid)
to authenticated;

create or replace function public.shift_is_within_planning_period(
  target_planning_period_id uuid,
  shift_starts_at timestamptz,
  shift_ends_at timestamptz
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    shift_ends_at > shift_starts_at
    and (shift_starts_at at time zone period.timezone)::date
      between period.starts_on and period.ends_on
    and (
      (
        (shift_ends_at - interval '1 microsecond')
          at time zone period.timezone
      )::date <= period.ends_on
      or (
        (shift_starts_at at time zone period.timezone)::date = period.ends_on
        and (
          (shift_ends_at - interval '1 microsecond')
            at time zone period.timezone
        )::date = period.ends_on + 1
      )
    )
  from public.planning_periods period
  where period.id = target_planning_period_id;
$$;

revoke all on function public.shift_is_within_planning_period(
  uuid,
  timestamptz,
  timestamptz
) from public, anon, authenticated;

create or replace function public.schedule_version_coverage_gaps(
  target_schedule_version_id uuid
)
returns table (
  staffing_requirement_id uuid,
  gap_starts_at timestamptz,
  gap_ends_at timestamptz,
  required_agents integer,
  assigned_agents bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with active_requirements as (
    select requirement.*
    from public.schedule_effective_requirements(
      target_schedule_version_id
    ) requirement
  ),
  matching_assignments as (
    select
      requirement.id as requirement_id,
      shift.agent_id,
      greatest(requirement.starts_at, assignment.starts_at) as covered_from,
      least(requirement.ends_at, assignment.ends_at) as covered_until
    from active_requirements requirement
    join public.planning_shifts shift
      on shift.schedule_version_id = target_schedule_version_id
    join public.shift_assignments assignment
      on assignment.planning_shift_id = shift.id
      and assignment.position_id = requirement.position_id
      and tstzrange(assignment.starts_at, assignment.ends_at, '[)')
        && tstzrange(requirement.starts_at, requirement.ends_at, '[)')
      -- Exact allocation prevents one unlinked assignment from satisfying
      -- several simultaneous requirements for the same port call/position.
      and assignment.staffing_requirement_id = requirement.id
  ),
  boundaries as (
    select requirement.id as requirement_id, requirement.starts_at as boundary
    from active_requirements requirement
    union
    select requirement.id, requirement.ends_at
    from active_requirements requirement
    union
    select assignment.requirement_id, assignment.covered_from
    from matching_assignments assignment
    union
    select assignment.requirement_id, assignment.covered_until
    from matching_assignments assignment
  ),
  segments as (
    select
      boundary.requirement_id,
      boundary.boundary as segment_start,
      lead(boundary.boundary) over (
        partition by boundary.requirement_id
        order by boundary.boundary
      ) as segment_end
    from boundaries boundary
  )
  select
    requirement.id,
    segment.segment_start,
    segment.segment_end,
    requirement.required_agents::integer,
    count(distinct assignment.agent_id) filter (
      where assignment.covered_from <= segment.segment_start
        and assignment.covered_until >= segment.segment_end
    ) as assigned_agents
  from segments segment
  join active_requirements requirement
    on requirement.id = segment.requirement_id
  left join matching_assignments assignment
    on assignment.requirement_id = segment.requirement_id
  where segment.segment_end is not null
    and segment.segment_end > segment.segment_start
  group by
    requirement.id,
    segment.segment_start,
    segment.segment_end,
    requirement.required_agents
  having count(distinct assignment.agent_id) filter (
    where assignment.covered_from <= segment.segment_start
      and assignment.covered_until >= segment.segment_end
  ) < requirement.required_agents;
$$;

revoke all on function public.schedule_version_coverage_gaps(uuid)
from public, anon, authenticated;

create or replace function public.validate_schedule_version_integrity(
  target_schedule_version_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_schedule public.schedule_versions;
  target_period public.planning_periods;
  target_agent_id uuid;
  first_gap record;
begin
  select schedule.* into target_schedule
  from public.schedule_versions schedule
  where schedule.id = target_schedule_version_id;

  if target_schedule.id is null then
    raise exception using
      errcode = 'P2040',
      message = 'Schedule version not found.';
  end if;

  if target_schedule.superseded_at is not null then
    raise exception using
      errcode = 'P2050',
      message = 'A superseded draft cannot be published.';
  end if;

  select period.* into target_period
  from public.planning_periods period
  where period.id = target_schedule.planning_period_id;

  if not exists (
    select 1
    from public.planning_shifts shift
    where shift.schedule_version_id = target_schedule.id
  ) and exists (
    select 1
    from public.schedule_effective_requirements(target_schedule.id)
  ) then
    raise exception using
      errcode = 'P2041',
      message = 'A schedule with staffing requirements cannot be published without shifts.';
  end if;

  if exists (
    select 1
    from public.planning_shifts shift
    where shift.schedule_version_id = target_schedule.id
      and not exists (
        select 1
        from public.shift_assignments assignment
        where assignment.planning_shift_id = shift.id
      )
  ) then
    raise exception using
      errcode = 'P2042',
      message = 'Every shift must contain at least one position assignment.';
  end if;

  if exists (
    select 1
    from public.planning_shifts shift
    where shift.schedule_version_id = target_schedule.id
      and not public.shift_is_within_planning_period(
        target_period.id,
        shift.starts_at,
        shift.ends_at
      )
  ) then
    raise exception using
      errcode = 'P2043',
      message = 'A shift falls outside its planning period.';
  end if;

  if exists (
    select 1
    from public.planning_shifts shift
    join public.agents agent on agent.id = shift.agent_id
    where shift.schedule_version_id = target_schedule.id
      and (
        agent.organization_id <> target_schedule.organization_id
        or agent.primary_site_id <> target_schedule.site_id
        or not agent.active
        or (
          agent.hired_on is not null
          and agent.hired_on
            > (shift.starts_at at time zone target_period.timezone)::date
        )
        or (
          agent.left_on is not null
          and agent.left_on < (
            (shift.ends_at - interval '1 microsecond')
              at time zone target_period.timezone
          )::date
        )
      )
  ) then
    raise exception using
      errcode = 'P2044',
      message = 'Every shift requires an active agent employed in the schedule scope.';
  end if;

  if exists (
    select 1
    from public.planning_shifts shift
    where shift.schedule_version_id = target_schedule.id
      and not exists (
        select 1
        from public.agent_contract_versions contract
        where contract.agent_id = shift.agent_id
          and contract.organization_id = target_schedule.organization_id
          and contract.effective_from
            <= (shift.starts_at at time zone target_period.timezone)::date
          and (
            contract.effective_until is null
            or contract.effective_until >= (
              (shift.ends_at - interval '1 microsecond')
                at time zone target_period.timezone
            )::date
          )
      )
  ) then
    raise exception using
      errcode = 'P2045',
      message = 'Every shift must be covered by an effective employment contract.';
  end if;

  if exists (
    select 1
    from public.planning_shifts shift
    join public.agent_unavailability unavailable
      on unavailable.agent_id = shift.agent_id
      and unavailable.organization_id = target_schedule.organization_id
      and tstzrange(unavailable.starts_at, unavailable.ends_at, '[)')
        && tstzrange(shift.starts_at, shift.ends_at, '[)')
    where shift.schedule_version_id = target_schedule.id
  ) then
    raise exception using
      errcode = 'P2046',
      message = 'A scheduled agent is unavailable during a shift.';
  end if;

  if exists (
    select 1
    from public.planning_shifts shift
    join public.shift_assignments assignment
      on assignment.planning_shift_id = shift.id
    left join public.positions position on position.id = assignment.position_id
    where shift.schedule_version_id = target_schedule.id
      and (
        position.id is null
        or not position.active
        or position.organization_id <> target_schedule.organization_id
        or (
          position.site_id is not null
          and position.site_id <> target_schedule.site_id
        )
        or assignment.site_id <> shift.site_id
        or assignment.starts_at < shift.starts_at
        or assignment.ends_at > shift.ends_at
      )
  ) then
    raise exception using
      errcode = 'P2047',
      message = 'Every assignment must use an active in-scope position inside its shift.';
  end if;

  if exists (
    select 1
    from public.planning_shifts shift
    join public.shift_assignments assignment
      on assignment.planning_shift_id = shift.id
    join public.agent_position_restrictions restriction
      on restriction.agent_id = shift.agent_id
      and restriction.position_id = assignment.position_id
      and restriction.organization_id = target_schedule.organization_id
    where shift.schedule_version_id = target_schedule.id
      and restriction.valid_from <= (
        (assignment.ends_at - interval '1 microsecond')
          at time zone target_period.timezone
      )::date
      and (
        restriction.valid_until is null
        or restriction.valid_until
          >= (assignment.starts_at at time zone target_period.timezone)::date
      )
  ) then
    raise exception using
      errcode = 'P2048',
      message = 'An agent is restricted from an assigned position.';
  end if;

  if exists (
    select 1
    from public.planning_shifts shift
    join public.shift_assignments assignment
      on assignment.planning_shift_id = shift.id
    join public.position_skill_requirements requirement
      on requirement.position_id = assignment.position_id
      and requirement.organization_id = target_schedule.organization_id
      and requirement.mandatory = true
    where shift.schedule_version_id = target_schedule.id
      and not exists (
        select 1
        from public.agent_skills agent_skill
        where agent_skill.agent_id = shift.agent_id
          and agent_skill.skill_id = requirement.skill_id
          and agent_skill.organization_id = target_schedule.organization_id
          and agent_skill.level >= requirement.minimum_level
          and agent_skill.valid_from
            <= (assignment.starts_at at time zone target_period.timezone)::date
          and (
            agent_skill.valid_until is null
            or agent_skill.valid_until >= (
              (assignment.ends_at - interval '1 microsecond')
                at time zone target_period.timezone
            )::date
          )
      )
  ) then
    raise exception using
      errcode = 'P2049',
      message = 'An agent lacks a mandatory skill for an assigned position.';
  end if;

  if exists (
    select 1
    from public.planning_shifts shift
    join public.shift_assignments assignment
      on assignment.planning_shift_id = shift.id
    join public.port_calls port_call on port_call.id = assignment.port_call_id
    where shift.schedule_version_id = target_schedule.id
      and (
        port_call.organization_id <> target_schedule.organization_id
        or port_call.site_id <> target_schedule.site_id
        or port_call.status = 'cancelled'
      )
  ) then
    raise exception using
      errcode = 'P2052',
      message = 'A schedule cannot include an invalid or cancelled port call.';
  end if;

  if exists (
    select 1
    from public.planning_shifts shift
    join public.shift_assignments assignment
      on assignment.planning_shift_id = shift.id
    left join public.schedule_effective_requirements(
      target_schedule.id
    ) requirement
      on requirement.id = assignment.staffing_requirement_id
    where shift.schedule_version_id = target_schedule.id
      and assignment.staffing_requirement_id is not null
      and (
        requirement.id is null
        or requirement.planning_period_id <> target_schedule.planning_period_id
        or requirement.organization_id <> target_schedule.organization_id
        or requirement.site_id <> target_schedule.site_id
        or requirement.position_id <> assignment.position_id
        or requirement.port_call_id is distinct from assignment.port_call_id
      )
  ) then
    raise exception using
      errcode = 'P2053',
      message = 'An assignment references an incompatible staffing requirement.';
  end if;

  select gap.* into first_gap
  from public.schedule_version_coverage_gaps(target_schedule.id) gap
  order by gap.gap_starts_at, gap.staffing_requirement_id
  limit 1;

  if found then
    raise exception using
      errcode = 'P2054',
      message = format(
        'Staffing requirement %s is under-covered from %s to %s (%s/%s agents).',
        first_gap.staffing_requirement_id,
        first_gap.gap_starts_at,
        first_gap.gap_ends_at,
        first_gap.assigned_agents,
        first_gap.required_agents
      );
  end if;

  for target_agent_id in
    select distinct shift.agent_id
    from public.planning_shifts shift
    where shift.schedule_version_id = target_schedule.id
  loop
    perform public.assert_agent_planning_rules(
      target_schedule.id,
      target_agent_id
    );
  end loop;
end;
$$;

revoke all on function public.validate_schedule_version_integrity(uuid)
from public, anon, authenticated;

create or replace function public.validate_agent_planning_rules_on_publish()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'published' and old.status <> 'published' then
    perform public.capture_schedule_requirement_snapshot(new.id, 'publication');
    perform public.validate_schedule_version_integrity(new.id);
  end if;

  return new;
end;
$$;

revoke all on function public.validate_agent_planning_rules_on_publish()
from public, anon, authenticated;

-- Keep the established editing RPCs and their authorization/validation logic,
-- replacing only their former calendar-date boundary with the shared
-- Sunday-night rule. The migration fails loudly if a prior definition drifts,
-- instead of silently leaving one mutation path inconsistent.
do $$
declare
  function_definition text;
  previous_definition text;
begin
  select pg_catalog.pg_get_functiondef(
    'public.create_planning_shift(uuid,uuid,timestamptz,timestamptz,integer,uuid,uuid,text)'::regprocedure
  ) into function_definition;
  previous_definition := function_definition;
  function_definition := replace(
    function_definition,
    $condition$if (shift_starts_at at time zone target_period.timezone)::date < target_period.starts_on
    or (shift_ends_at at time zone target_period.timezone)::date > target_period.ends_on then$condition$,
    $condition$if not public.shift_is_within_planning_period(
    target_period.id,
    shift_starts_at,
    shift_ends_at
  ) then$condition$
  );
  if function_definition = previous_definition then
    raise exception 'create_planning_shift period guard definition drifted';
  end if;
  execute function_definition;

  select pg_catalog.pg_get_functiondef(
    'public.update_planning_assignment(uuid,uuid,uuid,uuid,uuid,timestamptz,timestamptz,integer,text)'::regprocedure
  ) into function_definition;
  previous_definition := function_definition;
  function_definition := replace(
    function_definition,
    $condition$if (shift_starts_at at time zone target_period.timezone)::date < target_period.starts_on
    or (shift_ends_at at time zone target_period.timezone)::date > target_period.ends_on then$condition$,
    $condition$if not public.shift_is_within_planning_period(
    target_period.id,
    shift_starts_at,
    shift_ends_at
  ) then$condition$
  );
  if function_definition = previous_definition then
    raise exception 'update_planning_assignment period guard definition drifted';
  end if;
  execute function_definition;

  select pg_catalog.pg_get_functiondef(
    'public.move_planning_assignment(uuid,uuid,date,uuid)'::regprocedure
  ) into function_definition;
  previous_definition := function_definition;
  function_definition := replace(
    function_definition,
    $condition$if (moved_ends_at at time zone target_period.timezone)::date > target_period.ends_on then$condition$,
    $condition$if not public.shift_is_within_planning_period(
    target_period.id,
    moved_starts_at,
    moved_ends_at
  ) then$condition$
  );
  if function_definition = previous_definition then
    raise exception 'move_planning_assignment period guard definition drifted';
  end if;
  execute function_definition;
end;
$$;

-- Re-state the current-draft helper after 029. Besides keeping the single-draft
-- invariant, this removes a malformed duplicate column from the transitional
-- definition and makes clean installs behave like upgraded databases.
create or replace function public.ensure_editable_schedule_for_period(
  target_planning_period_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_period public.planning_periods;
  draft_schedule public.schedule_versions;
  published_schedule public.schedule_versions;
  created_schedule public.schedule_versions;
  next_version_number integer;
begin
  select period.* into target_period
  from public.planning_periods period
  where period.id = target_planning_period_id
  for update;

  if target_period.id is null then
    raise exception 'Planning period not found';
  end if;

  if not (
    public.has_role(
      target_period.organization_id,
      target_period.site_id,
      array[
        'platform_admin',
        'planning_admin',
        'planner'
      ]::public.app_role[]
    )
    or (
      pg_trigger_depth() > 0
      and public.has_role(
        target_period.organization_id,
        target_period.site_id,
        array['approver']::public.app_role[]
      )
    )
  ) then
    raise exception 'Insufficient permissions';
  end if;

  select schedule.* into draft_schedule
  from public.schedule_versions schedule
  where schedule.planning_period_id = target_period.id
    and schedule.status in ('draft', 'validated')
    and schedule.superseded_at is null
  order by schedule.version_number desc
  limit 1;

  if draft_schedule.id is not null then
    return draft_schedule.id;
  end if;

  select schedule.* into published_schedule
  from public.schedule_versions schedule
  where schedule.planning_period_id = target_period.id
    and schedule.status = 'published'
  order by schedule.version_number desc
  limit 1;

  select coalesce(max(schedule.version_number), 0) + 1
  into next_version_number
  from public.schedule_versions schedule
  where schedule.planning_period_id = target_period.id;

  insert into public.schedule_versions (
    organization_id,
    site_id,
    planning_period_id,
    parent_version_id,
    version_number,
    status,
    label,
    change_reason,
    created_by
  ) values (
    target_period.organization_id,
    target_period.site_id,
    target_period.id,
    published_schedule.id,
    next_version_number,
    'draft',
    'Brouillon de travail',
    case
      when published_schedule.id is null
        then 'Initialisation automatique à partir des escales'
      else 'Copie de travail automatique du planning publié'
    end,
    (select auth.uid())
  )
  returning * into created_schedule;

  if published_schedule.id is not null then
    insert into public.planning_shifts (
      organization_id,
      site_id,
      schedule_version_id,
      agent_id,
      starts_at,
      ends_at,
      break_minutes,
      origin,
      note,
      created_by,
      source_shift_id
    )
    select
      source_shift.organization_id,
      source_shift.site_id,
      created_schedule.id,
      source_shift.agent_id,
      source_shift.starts_at,
      source_shift.ends_at,
      source_shift.break_minutes,
      'replanned',
      source_shift.note,
      (select auth.uid()),
      source_shift.id
    from public.planning_shifts source_shift
    where source_shift.schedule_version_id = published_schedule.id;

    insert into public.shift_assignments (
      organization_id,
      site_id,
      planning_shift_id,
      position_id,
      staffing_requirement_id,
      port_call_id,
      starts_at,
      ends_at
    )
    select
      source_assignment.organization_id,
      source_assignment.site_id,
      cloned_shift.id,
      source_assignment.position_id,
      source_assignment.staffing_requirement_id,
      source_assignment.port_call_id,
      source_assignment.starts_at,
      source_assignment.ends_at
    from public.shift_assignments source_assignment
    join public.planning_shifts source_shift
      on source_shift.id = source_assignment.planning_shift_id
    join public.planning_shifts cloned_shift
      on cloned_shift.source_shift_id = source_shift.id
      and cloned_shift.schedule_version_id = created_schedule.id
    where source_shift.schedule_version_id = published_schedule.id;
  end if;

  return created_schedule.id;
end;
$$;

revoke all on function public.ensure_editable_schedule_for_period(uuid)
from public, anon, authenticated;
grant execute on function public.ensure_editable_schedule_for_period(uuid)
to authenticated;

create or replace function public.build_replanning_candidate(
  target_scenario_id uuid,
  approval_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_scenario public.replanning_scenarios;
  base_schedule public.schedule_versions;
  candidate_schedule public.schedule_versions;
  target_period public.planning_periods;
  target_impact public.replanning_impacts;
  candidate_assignment_id uuid;
  candidate_shift_id uuid;
  proposed_starts_at timestamptz;
  proposed_ends_at timestamptz;
  next_version_number integer;
begin
  select scenario.* into target_scenario
  from public.replanning_scenarios scenario
  where scenario.id = target_scenario_id
  for update;

  select schedule.* into base_schedule
  from public.schedule_versions schedule
  where schedule.id = target_scenario.base_schedule_version_id
  for update;

  if target_scenario.id is null
    or target_scenario.status <> 'simulated'
    or base_schedule.id is null
    or base_schedule.status <> 'published' then
    raise exception 'A simulated scenario with a published base is required';
  end if;

  select period.* into target_period
  from public.planning_periods period
  where period.id = base_schedule.planning_period_id
  for update;

  select coalesce(max(schedule.version_number), 0) + 1
  into next_version_number
  from public.schedule_versions schedule
  where schedule.planning_period_id = base_schedule.planning_period_id;

  insert into public.schedule_versions (
    organization_id,
    site_id,
    planning_period_id,
    parent_version_id,
    version_number,
    status,
    label,
    change_reason,
    created_by
  ) values (
    base_schedule.organization_id,
    base_schedule.site_id,
    base_schedule.planning_period_id,
    base_schedule.id,
    next_version_number,
    'draft',
    'Replanification — ' || target_scenario.title,
    approval_reason,
    (select auth.uid())
  )
  returning * into candidate_schedule;

  insert into public.planning_shifts (
    organization_id,
    site_id,
    schedule_version_id,
    agent_id,
    starts_at,
    ends_at,
    break_minutes,
    origin,
    note,
    created_by,
    source_shift_id
  )
  select
    source_shift.organization_id,
    source_shift.site_id,
    candidate_schedule.id,
    source_shift.agent_id,
    source_shift.starts_at,
    source_shift.ends_at,
    source_shift.break_minutes,
    'replanned',
    source_shift.note,
    (select auth.uid()),
    source_shift.id
  from public.planning_shifts source_shift
  where source_shift.schedule_version_id = base_schedule.id;

  insert into public.shift_assignments (
    organization_id,
    site_id,
    planning_shift_id,
    position_id,
    staffing_requirement_id,
    port_call_id,
    starts_at,
    ends_at
  )
  select
    source_assignment.organization_id,
    source_assignment.site_id,
    candidate_shift.id,
    source_assignment.position_id,
    source_assignment.staffing_requirement_id,
    source_assignment.port_call_id,
    source_assignment.starts_at,
    source_assignment.ends_at
  from public.shift_assignments source_assignment
  join public.planning_shifts source_shift
    on source_shift.id = source_assignment.planning_shift_id
  join public.planning_shifts candidate_shift
    on candidate_shift.source_shift_id = source_shift.id
    and candidate_shift.schedule_version_id = candidate_schedule.id
  where source_shift.schedule_version_id = base_schedule.id;

  for target_impact in
    select impact.*
    from public.replanning_impacts impact
    where impact.scenario_id = target_scenario.id
      and impact.impact_type in (
        'assignment.time_shift',
        'assignment.cancellation'
      )
    order by impact.created_at, impact.id
  loop
    select
      candidate_assignment.id,
      candidate_shift.id
    into candidate_assignment_id, candidate_shift_id
    from public.shift_assignments source_assignment
    join public.planning_shifts source_shift
      on source_shift.id = source_assignment.planning_shift_id
    join public.planning_shifts candidate_shift
      on candidate_shift.source_shift_id = source_shift.id
      and candidate_shift.schedule_version_id = candidate_schedule.id
    join public.shift_assignments candidate_assignment
      on candidate_assignment.planning_shift_id = candidate_shift.id
      and candidate_assignment.position_id = source_assignment.position_id
      and candidate_assignment.starts_at = source_assignment.starts_at
      and candidate_assignment.ends_at = source_assignment.ends_at
    where source_assignment.id = (
      target_impact.details ->> 'shiftAssignmentId'
    )::uuid
    limit 1;

    if candidate_assignment_id is null then
      continue;
    end if;

    if target_impact.impact_type = 'assignment.cancellation' then
      delete from public.shift_assignments assignment
      where assignment.id = candidate_assignment_id;
      continue;
    end if;

    proposed_starts_at := (
      target_impact.details ->> 'proposedStartsAt'
    )::timestamptz;
    proposed_ends_at := (
      target_impact.details ->> 'proposedEndsAt'
    )::timestamptz;

    if proposed_starts_at is null
      or proposed_ends_at is null
      or not public.shift_is_within_planning_period(
        target_period.id,
        proposed_starts_at,
        proposed_ends_at
      ) then
      -- The coordinated destination candidate will receive it later.
      delete from public.shift_assignments assignment
      where assignment.id = candidate_assignment_id;
      continue;
    end if;

    -- Widen the parent first so the assignment-bounds trigger remains true,
    -- then shrink every affected shift to its final assignment envelope below.
    update public.planning_shifts shift
    set starts_at = least(shift.starts_at, proposed_starts_at),
        ends_at = greatest(shift.ends_at, proposed_ends_at),
        updated_at = now()
    where shift.id = candidate_shift_id;

    update public.shift_assignments assignment
    set starts_at = proposed_starts_at,
        ends_at = proposed_ends_at,
        updated_at = now()
    where assignment.id = candidate_assignment_id;
  end loop;

  delete from public.planning_shifts candidate_shift
  where candidate_shift.schedule_version_id = candidate_schedule.id
    and not exists (
      select 1
      from public.shift_assignments assignment
      where assignment.planning_shift_id = candidate_shift.id
    );

  update public.planning_shifts candidate_shift
  set starts_at = assignment_bounds.starts_at,
      ends_at = assignment_bounds.ends_at,
      break_minutes = least(
        candidate_shift.break_minutes,
        greatest(
          0,
          floor(
            extract(epoch from (
              assignment_bounds.ends_at - assignment_bounds.starts_at
            )) / 60
          )::integer - 1
        )
      ),
      updated_at = now()
  from (
    select
      assignment.planning_shift_id,
      min(assignment.starts_at) as starts_at,
      max(assignment.ends_at) as ends_at
    from public.shift_assignments assignment
    join public.planning_shifts shift
      on shift.id = assignment.planning_shift_id
    where shift.schedule_version_id = candidate_schedule.id
    group by assignment.planning_shift_id
  ) assignment_bounds
  where candidate_shift.id = assignment_bounds.planning_shift_id;

  return candidate_schedule.id;
end;
$$;

revoke all on function public.build_replanning_candidate(uuid, text)
from public, anon, authenticated;

create or replace function public.approve_replanning_scenario(
  target_scenario_id uuid,
  approval_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_scenario public.replanning_scenarios;
  sibling_scenario public.replanning_scenarios;
  destination_scenario public.replanning_scenarios;
  source_assignment public.shift_assignments;
  source_shift public.planning_shifts;
  destination_period public.planning_periods;
  candidate_schedule_id uuid;
  requested_candidate_id uuid;
  created_shift public.planning_shifts;
  proposed_starts_at timestamptz;
  proposed_ends_at timestamptz;
  target_requirement_id uuid;
  candidate_ids jsonb := '[]'::jsonb;
  target_impact record;
begin
  select scenario.* into target_scenario
  from public.replanning_scenarios scenario
  where scenario.id = target_scenario_id
  for update;

  if target_scenario.id is null then
    raise exception 'Replanning scenario not found';
  end if;

  if target_scenario.status <> 'simulated' then
    raise exception 'Only a simulated scenario can be approved';
  end if;

  if not public.has_role(
    target_scenario.organization_id,
    target_scenario.site_id,
    array['platform_admin', 'planning_admin', 'approver']::public.app_role[]
  ) then
    raise exception 'Insufficient permissions';
  end if;

  if approval_reason is null
    or char_length(approval_reason) not between 3 and 500 then
    raise exception 'A valid approval reason is required';
  end if;

  -- Deterministic locks make concurrent approvals of sibling scenarios safe.
  perform 1
  from public.replanning_scenarios scenario
  where scenario.disruption_event_id = target_scenario.disruption_event_id
    and scenario.status = 'simulated'
  order by scenario.base_schedule_version_id, scenario.id
  for update;

  for sibling_scenario in
    select scenario.*
    from public.replanning_scenarios scenario
    where scenario.disruption_event_id = target_scenario.disruption_event_id
      and scenario.status = 'simulated'
    order by scenario.base_schedule_version_id, scenario.id
  loop
    candidate_schedule_id := public.build_replanning_candidate(
      sibling_scenario.id,
      approval_reason
    );

    update public.replanning_scenarios scenario
    set candidate_schedule_version_id = candidate_schedule_id,
        updated_at = now()
    where scenario.id = sibling_scenario.id;

    if sibling_scenario.id = target_scenario.id then
      requested_candidate_id := candidate_schedule_id;
    end if;
    candidate_ids := candidate_ids || jsonb_build_array(candidate_schedule_id);
  end loop;

  -- Move assignments whose proposed start belongs to a sibling destination
  -- period. They were already removed from their source candidate above.
  for target_impact in
    select
      impact.*,
      source_scenario.base_schedule_version_id as source_base_schedule_id
    from public.replanning_impacts impact
    join public.replanning_scenarios source_scenario
      on source_scenario.id = impact.scenario_id
    where source_scenario.disruption_event_id =
      target_scenario.disruption_event_id
      and impact.impact_type = 'assignment.time_shift'
      and impact.details ->> 'proposedStartsAt' is not null
    order by impact.created_at, impact.id
  loop
    proposed_starts_at := (
      target_impact.details ->> 'proposedStartsAt'
    )::timestamptz;
    proposed_ends_at := (
      target_impact.details ->> 'proposedEndsAt'
    )::timestamptz;

    select assignment.* into source_assignment
    from public.shift_assignments assignment
    where assignment.id = (
      target_impact.details ->> 'shiftAssignmentId'
    )::uuid;

    select shift.* into source_shift
    from public.planning_shifts shift
    where shift.id = source_assignment.planning_shift_id;

    if source_assignment.id is null then
      continue;
    end if;

    for destination_scenario in
      select scenario.*
      from public.replanning_scenarios scenario
      join public.schedule_versions destination_base
        on destination_base.id = scenario.base_schedule_version_id
      join public.planning_periods period
        on period.id = destination_base.planning_period_id
      where scenario.disruption_event_id = target_scenario.disruption_event_id
        and scenario.candidate_schedule_version_id is not null
        and scenario.base_schedule_version_id
          <> target_impact.source_base_schedule_id
        and (proposed_starts_at at time zone period.timezone)::date
          between period.starts_on and period.ends_on
    loop
      select period.* into destination_period
      from public.schedule_versions candidate
      join public.planning_periods period
        on period.id = candidate.planning_period_id
      where candidate.id = destination_scenario.candidate_schedule_version_id;

      if not public.shift_is_within_planning_period(
        destination_period.id,
        proposed_starts_at,
        proposed_ends_at
      ) then
        raise exception using
          errcode = 'P2065',
          message = 'A cross-period assignment does not fit its destination period.';
      end if;

      select requirement.id into target_requirement_id
      from public.staffing_requirements requirement
      where requirement.planning_period_id = destination_period.id
        and requirement.retired_at is null
        and requirement.port_call_id is not distinct from source_assignment.port_call_id
        and requirement.position_id = source_assignment.position_id
        and tstzrange(requirement.starts_at, requirement.ends_at, '[)')
          && tstzrange(proposed_starts_at, proposed_ends_at, '[)')
      order by
        abs(extract(epoch from requirement.starts_at - proposed_starts_at)),
        requirement.id
      limit 1;

      insert into public.planning_shifts (
        organization_id,
        site_id,
        schedule_version_id,
        agent_id,
        starts_at,
        ends_at,
        break_minutes,
        origin,
        note,
        created_by,
        source_shift_id
      ) values (
        source_shift.organization_id,
        source_shift.site_id,
        destination_scenario.candidate_schedule_version_id,
        source_shift.agent_id,
        proposed_starts_at,
        proposed_ends_at,
        least(
          source_shift.break_minutes,
          greatest(
            0,
            floor(extract(epoch from (
              proposed_ends_at - proposed_starts_at
            )) / 60)::integer - 1
          )
        ),
        'replanned',
        source_shift.note,
        (select auth.uid()),
        source_shift.id
      )
      returning * into created_shift;

      insert into public.shift_assignments (
        organization_id,
        site_id,
        planning_shift_id,
        position_id,
        staffing_requirement_id,
        port_call_id,
        starts_at,
        ends_at
      ) values (
        source_assignment.organization_id,
        source_assignment.site_id,
        created_shift.id,
        source_assignment.position_id,
        target_requirement_id,
        source_assignment.port_call_id,
        proposed_starts_at,
        proposed_ends_at
      );
    end loop;
  end loop;

  for sibling_scenario in
    update public.replanning_scenarios scenario
    set status = 'approved',
        candidate_lock_version = candidate.lock_version,
        summary = concat_ws(E'\n', scenario.summary, approval_reason),
        approved_by = (select auth.uid()),
        approved_at = now(),
        updated_at = now()
    from public.schedule_versions candidate
    where scenario.disruption_event_id = target_scenario.disruption_event_id
      and scenario.status = 'simulated'
      and candidate.id = scenario.candidate_schedule_version_id
    returning scenario.*
  loop
    insert into public.outbox_events (
      organization_id,
      site_id,
      topic,
      aggregate_type,
      aggregate_id,
      payload,
      idempotency_key
    ) values (
      sibling_scenario.organization_id,
      sibling_scenario.site_id,
      'planning.replanning.approved',
      'replanning_scenario',
      sibling_scenario.id,
      jsonb_build_object(
        'scenarioId', sibling_scenario.id,
        'disruptionEventId', sibling_scenario.disruption_event_id,
        'candidateScheduleVersionId',
          sibling_scenario.candidate_schedule_version_id,
        'candidateScheduleVersionIds', candidate_ids,
        'candidateLockVersion', sibling_scenario.candidate_lock_version,
        'coordinated', jsonb_array_length(candidate_ids) > 1
      ),
      'replanning-approved-' || sibling_scenario.id::text
    );
  end loop;

  return jsonb_build_object(
    'scenarioId', target_scenario.id,
    'disruptionEventId', target_scenario.disruption_event_id,
    'candidateScheduleVersionId', requested_candidate_id,
    'candidateScheduleVersionIds', candidate_ids,
    'coordinated', jsonb_array_length(candidate_ids) > 1
  );
end;
$$;

revoke all on function public.approve_replanning_scenario(uuid, text)
from public, anon, authenticated;
grant execute on function public.approve_replanning_scenario(uuid, text)
to authenticated;

create or replace function public.validate_replanning_change_set(
  target_disruption_event_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_scenario public.replanning_scenarios;
  target_timezone text;
  target_agent_id uuid;
begin
  select scenario.* into target_scenario
  from public.replanning_scenarios scenario
  where scenario.disruption_event_id = target_disruption_event_id
    and scenario.status = 'approved'
  order by scenario.id
  limit 1;

  if target_scenario.id is null then
    raise exception 'Approved replanning change-set not found';
  end if;

  if exists (
    select 1
    from public.replanning_scenarios scenario
    join public.schedule_versions candidate
      on candidate.id = scenario.candidate_schedule_version_id
    where scenario.disruption_event_id = target_disruption_event_id
      and scenario.status = 'approved'
      and (
        candidate.organization_id <> target_scenario.organization_id
        or candidate.site_id <> target_scenario.site_id
      )
  ) then
    raise exception 'A replanning change-set cannot cross organization/site scope';
  end if;

  select site.timezone into target_timezone
  from public.sites site
  where site.id = target_scenario.site_id;

  create temporary table if not exists
    replanning_change_set_effective_shifts (
      shift_id uuid primary key,
      agent_id uuid not null,
      starts_at timestamptz not null,
      ends_at timestamptz not null
    ) on commit drop;
  truncate pg_temp.replanning_change_set_effective_shifts;

  -- Lock every affected agent row and advisory key in one deterministic order
  -- before reading the effective cross-period schedule or evaluating a
  -- candidate individually.
  for target_agent_id in
    select agent.id
    from public.agents agent
    where agent.id in (
      select candidate_shift.agent_id
      from public.planning_shifts candidate_shift
      join public.replanning_scenarios scenario
        on scenario.candidate_schedule_version_id =
          candidate_shift.schedule_version_id
      where scenario.disruption_event_id = target_disruption_event_id
        and scenario.status = 'approved'
    )
    order by agent.id
    for update
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(target_agent_id::text, 20260720)
    );
  end loop;

  insert into pg_temp.replanning_change_set_effective_shifts (
    shift_id,
    agent_id,
    starts_at,
    ends_at
  )
  with candidate_versions as (
    select
      candidate.id,
      candidate.planning_period_id
    from public.replanning_scenarios scenario
    join public.schedule_versions candidate
      on candidate.id = scenario.candidate_schedule_version_id
    where scenario.disruption_event_id = target_disruption_event_id
      and scenario.status = 'approved'
  ),
  effective_versions as (
    select candidate.id
    from candidate_versions candidate

    union

    select published.id
    from public.schedule_versions published
    where published.organization_id = target_scenario.organization_id
      and published.site_id = target_scenario.site_id
      and published.status = 'published'
      and not exists (
        select 1
        from candidate_versions candidate
        where candidate.planning_period_id = published.planning_period_id
      )
  )
  select shift.id, shift.agent_id, shift.starts_at, shift.ends_at
  from public.planning_shifts shift
  join effective_versions version on version.id = shift.schedule_version_id;

  if exists (
    select 1
    from (
      select
        shift.*,
        max(shift.ends_at) over (
          partition by shift.agent_id
          order by shift.starts_at, shift.ends_at, shift.shift_id
          rows between unbounded preceding and 1 preceding
        ) as previous_max_ends_at
      from pg_temp.replanning_change_set_effective_shifts shift
    ) ordered_shift
    where ordered_shift.previous_max_ends_at is not null
      and ordered_shift.starts_at < ordered_shift.previous_max_ends_at
  ) then
    raise exception using
      errcode = 'P2001',
      message = 'Cet agent a déjà une affectation sur ce créneau.';
  end if;

  if exists (
    select 1
    from (
      select
        shift.*,
        lag(shift.starts_at) over (
          partition by shift.agent_id
          order by shift.starts_at, shift.ends_at, shift.shift_id
        ) as previous_starts_at,
        lag(shift.ends_at) over (
          partition by shift.agent_id
          order by shift.starts_at, shift.ends_at, shift.shift_id
        ) as previous_ends_at
      from pg_temp.replanning_change_set_effective_shifts shift
    ) ordered_shift
    where ordered_shift.previous_ends_at is not null
      and (
        ordered_shift.starts_at at time zone target_timezone
      )::date > (
        ordered_shift.previous_starts_at at time zone target_timezone
      )::date
      and ordered_shift.starts_at - ordered_shift.previous_ends_at
        < interval '11 hours'
  ) then
    raise exception using
      errcode = 'P2002',
      message = 'Repos quotidien insuffisant : 11 heures consécutives sont requises.';
  end if;

  if exists (
    with local_shift as (
      select
        shift.agent_id,
        (shift.starts_at at time zone target_timezone)::date as work_date,
        (shift.starts_at at time zone target_timezone)::time as start_time
      from pg_temp.replanning_change_set_effective_shifts shift
    )
    select 1
    from local_shift early_shift
    join local_shift next_day_shift
      on next_day_shift.agent_id = early_shift.agent_id
      and next_day_shift.work_date = early_shift.work_date + 1
    where early_shift.start_time <= time '06:00'
      and next_day_shift.start_time < time '12:00'
  ) then
    raise exception using
      errcode = 'P2003',
      message = 'Après un service commencé à 06:00 ou avant, le service du lendemain doit commencer à 12:00 ou après.';
  end if;

  if exists (
    with work_date as (
      select distinct
        shift.agent_id,
        (shift.starts_at at time zone target_timezone)::date as work_date
      from pg_temp.replanning_change_set_effective_shifts shift
    )
    select 1
    from work_date first_day
    where exists (
      select 1 from work_date next_day
      where next_day.agent_id = first_day.agent_id
        and next_day.work_date = first_day.work_date + 1
    )
      and exists (
        select 1 from work_date next_day
        where next_day.agent_id = first_day.agent_id
          and next_day.work_date = first_day.work_date + 2
      )
      and exists (
        select 1 from work_date next_day
        where next_day.agent_id = first_day.agent_id
          and next_day.work_date = first_day.work_date + 3
      )
      and exists (
        select 1 from work_date next_day
        where next_day.agent_id = first_day.agent_id
          and next_day.work_date = first_day.work_date + 4
      )
      and exists (
        select 1 from work_date next_day
        where next_day.agent_id = first_day.agent_id
          and next_day.work_date = first_day.work_date + 5
      )
      and exists (
        select 1 from work_date next_day
        where next_day.agent_id = first_day.agent_id
          and next_day.work_date = first_day.work_date + 6
      )
  ) then
    raise exception using
      errcode = 'P2004',
      message = 'Un agent ne peut pas travailler plus de 6 jours consécutifs.';
  end if;
end;
$$;

revoke all on function public.validate_replanning_change_set(uuid)
from public, anon, authenticated;

create or replace function public.publish_replanning_change_set(
  target_candidate_schedule_version_id uuid,
  publication_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_scenario public.replanning_scenarios;
  sibling_scenario public.replanning_scenarios;
  candidate_schedule public.schedule_versions;
  published_ids jsonb := '[]'::jsonb;
begin
  select scenario.* into target_scenario
  from public.replanning_scenarios scenario
  where scenario.candidate_schedule_version_id =
    target_candidate_schedule_version_id
    and scenario.status = 'approved'
  for update;

  if target_scenario.id is null then
    raise exception 'Approved replanning change-set not found';
  end if;

  if not public.has_role(
    target_scenario.organization_id,
    target_scenario.site_id,
    array['platform_admin', 'planning_admin', 'approver']::public.app_role[]
  ) then
    raise exception 'Insufficient permissions';
  end if;

  if publication_reason is null or char_length(publication_reason) < 3 then
    raise exception 'A publication reason is required';
  end if;

  perform 1
  from public.replanning_scenarios scenario
  where scenario.disruption_event_id = target_scenario.disruption_event_id
    and scenario.status = 'approved'
  order by scenario.base_schedule_version_id, scenario.id
  for update;

  perform 1
  from public.schedule_versions schedule
  join public.replanning_scenarios scenario
    on scenario.candidate_schedule_version_id = schedule.id
  where scenario.disruption_event_id = target_scenario.disruption_event_id
    and scenario.status = 'approved'
  order by schedule.planning_period_id, schedule.id
  for update of schedule;

  perform public.validate_replanning_change_set(
    target_scenario.disruption_event_id
  );

  -- Validate every member against its approval-time CAS before changing any
  -- published commitment. A failure rolls the whole statement back.
  for sibling_scenario in
    select scenario.*
    from public.replanning_scenarios scenario
    where scenario.disruption_event_id = target_scenario.disruption_event_id
      and scenario.status = 'approved'
    order by scenario.base_schedule_version_id, scenario.id
  loop
    select schedule.* into candidate_schedule
    from public.schedule_versions schedule
    where schedule.id = sibling_scenario.candidate_schedule_version_id;

    if candidate_schedule.id is null
      or candidate_schedule.status not in ('draft', 'validated')
      or candidate_schedule.superseded_at is not null then
      raise exception 'Every change-set candidate must remain current and editable';
    end if;

    if sibling_scenario.candidate_lock_version is null
      or candidate_schedule.lock_version
        <> sibling_scenario.candidate_lock_version then
      raise exception using
        errcode = 'P2031',
        message = format(
          'Replanning candidate %s changed after approval (expected version %s, current version %s).',
          candidate_schedule.id,
          sibling_scenario.candidate_lock_version,
          candidate_schedule.lock_version
        );
    end if;

    perform public.capture_schedule_requirement_snapshot(
      candidate_schedule.id,
      'publication'
    );
    perform public.validate_schedule_version_integrity(candidate_schedule.id);
  end loop;

  select coalesce(
    jsonb_agg(
      candidate.id
      order by candidate.planning_period_id, candidate.id
    ),
    '[]'::jsonb
  )
  into published_ids
  from public.schedule_versions candidate
  join public.replanning_scenarios scenario
    on scenario.candidate_schedule_version_id = candidate.id
  where scenario.disruption_event_id = target_scenario.disruption_event_id
    and scenario.status = 'approved';

  update public.schedule_versions published
  set status = 'archived',
      updated_at = now()
  where published.status = 'published'
    and published.planning_period_id in (
      select candidate.planning_period_id
      from public.schedule_versions candidate
      join public.replanning_scenarios scenario
        on scenario.candidate_schedule_version_id = candidate.id
      where scenario.disruption_event_id = target_scenario.disruption_event_id
        and scenario.status = 'approved'
    );

  for candidate_schedule in
    update public.schedule_versions candidate
    set status = 'published',
        change_reason = publication_reason,
        published_by = (select auth.uid()),
        published_at = now(),
        updated_at = now()
    from public.replanning_scenarios scenario
    where scenario.disruption_event_id = target_scenario.disruption_event_id
      and scenario.status = 'approved'
      and candidate.id = scenario.candidate_schedule_version_id
    returning candidate.*
  loop
    insert into public.outbox_events (
      organization_id,
      site_id,
      topic,
      aggregate_type,
      aggregate_id,
      payload,
      idempotency_key
    ) values (
      candidate_schedule.organization_id,
      candidate_schedule.site_id,
      'planning.schedule.published',
      'schedule_version',
      candidate_schedule.id,
      jsonb_build_object(
        'scheduleVersionId', candidate_schedule.id,
        'planningPeriodId', candidate_schedule.planning_period_id,
        'publishedAt', candidate_schedule.published_at,
        'coordinatedScheduleVersionIds', published_ids,
        'disruptionEventId', target_scenario.disruption_event_id
      ),
      'schedule-published-' || candidate_schedule.id::text
    );
  end loop;

  return jsonb_build_object(
    'disruptionEventId', target_scenario.disruption_event_id,
    'publishedScheduleVersionIds', published_ids,
    'coordinated', jsonb_array_length(published_ids) > 1
  );
end;
$$;

revoke all on function public.publish_replanning_change_set(uuid, text)
from public, anon, authenticated;

-- Preserve the public signature. Publishing any approved candidate delegates
-- to the all-or-nothing change-set command; ordinary publications keep their
-- original behavior.
create or replace function public.publish_schedule_version(
  target_schedule_version_id uuid,
  publication_reason text
)
returns public.schedule_versions
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.schedule_versions;
begin
  select schedule.* into target
  from public.schedule_versions schedule
  where schedule.id = target_schedule_version_id
  for update;

  if target.id is null then
    raise exception 'Schedule version not found';
  end if;

  if not public.has_role(
    target.organization_id,
    target.site_id,
    array['platform_admin', 'planning_admin', 'approver']::public.app_role[]
  ) then
    raise exception 'Insufficient permissions';
  end if;

  if target.status not in ('draft', 'validated') then
    raise exception 'Only draft or validated schedules can be published';
  end if;

  if publication_reason is null or char_length(publication_reason) < 3 then
    raise exception 'A publication reason is required';
  end if;

  if exists (
    select 1
    from public.replanning_scenarios scenario
    where scenario.candidate_schedule_version_id = target.id
      and scenario.status = 'approved'
  ) then
    perform public.publish_replanning_change_set(
      target.id,
      publication_reason
    );

    select schedule.* into target
    from public.schedule_versions schedule
    where schedule.id = target_schedule_version_id;
    return target;
  end if;

  update public.schedule_versions published
  set status = 'archived', updated_at = now()
  where published.planning_period_id = target.planning_period_id
    and published.status = 'published';

  update public.schedule_versions schedule
  set status = 'published',
      change_reason = publication_reason,
      published_by = (select auth.uid()),
      published_at = now(),
      updated_at = now()
  where schedule.id = target.id
  returning schedule.* into target;

  insert into public.outbox_events (
    organization_id,
    site_id,
    topic,
    aggregate_type,
    aggregate_id,
    payload,
    idempotency_key
  ) values (
    target.organization_id,
    target.site_id,
    'planning.schedule.published',
    'schedule_version',
    target.id,
    jsonb_build_object(
      'scheduleVersionId', target.id,
      'planningPeriodId', target.planning_period_id,
      'publishedAt', target.published_at
    ),
    'schedule-published-' || target.id::text
  );

  return target;
end;
$$;

revoke all on function public.publish_schedule_version(uuid, text)
from public, anon, authenticated;
grant execute on function public.publish_schedule_version(uuid, text)
to authenticated;

comment on function public.approve_replanning_scenario(uuid, text) is
  'Approves every scenario for one disruption and prepares coordinated source/destination candidates.';
comment on function public.publish_replanning_change_set(uuid, text) is
  'Validates CAS and publishes every approved period in one all-or-nothing transaction.';
