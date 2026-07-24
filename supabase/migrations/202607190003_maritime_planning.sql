create extension if not exists btree_gist with schema extensions;

create type public.port_call_status as enum (
  'scheduled',
  'delayed',
  'advanced',
  'arrived',
  'departed',
  'cancelled'
);
create type public.demand_anchor as enum ('arrival', 'departure');
create type public.schedule_status as enum ('draft', 'validated', 'published', 'archived');
create type public.shift_origin as enum ('manual', 'generated', 'replanned');
create type public.disruption_kind as enum ('delay', 'advance', 'cancellation', 'time_correction');
create type public.scenario_status as enum ('draft', 'simulated', 'approved', 'rejected', 'applied');
create type public.impact_severity as enum ('information', 'warning', 'critical');
create type public.notification_status as enum ('pending', 'sent', 'acknowledged', 'failed', 'cancelled');

create table public.ports (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  code text not null check (code ~ '^[A-Z0-9-]{2,12}$'),
  name text not null check (char_length(name) between 2 and 120),
  timezone text not null default 'Europe/Paris',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table public.vessels (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  code text not null check (code ~ '^[A-Z0-9-]{1,16}$'),
  name text not null check (char_length(name) between 1 and 120),
  imo_number text check (imo_number is null or imo_number ~ '^[0-9]{7}$'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code),
  unique (organization_id, imo_number)
);

create table public.routes (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  site_id uuid not null references public.sites(id) on delete restrict,
  code text not null check (code ~ '^[A-Z0-9-]{2,24}$'),
  name text not null check (char_length(name) between 2 and 120),
  origin_port_id uuid not null references public.ports(id) on delete restrict,
  destination_port_id uuid not null references public.ports(id) on delete restrict,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, code),
  check (origin_port_id <> destination_port_id)
);

create table public.port_calls (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  site_id uuid not null references public.sites(id) on delete restrict,
  vessel_id uuid not null references public.vessels(id) on delete restrict,
  route_id uuid references public.routes(id) on delete restrict,
  external_reference text check (external_reference is null or char_length(external_reference) <= 100),
  status public.port_call_status not null default 'scheduled',
  scheduled_arrival_at timestamptz,
  scheduled_departure_at timestamptz,
  estimated_arrival_at timestamptz,
  estimated_departure_at timestamptz,
  actual_arrival_at timestamptz,
  actual_departure_at timestamptz,
  source text not null default 'manual' check (char_length(source) between 2 and 50),
  source_revision text check (source_revision is null or char_length(source_revision) <= 100),
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, external_reference),
  check (scheduled_arrival_at is not null or scheduled_departure_at is not null),
  check (
    scheduled_arrival_at is null
    or scheduled_departure_at is null
    or scheduled_departure_at >= scheduled_arrival_at
  ),
  check (
    actual_arrival_at is null
    or actual_departure_at is null
    or actual_departure_at >= actual_arrival_at
  )
);

create index port_calls_site_schedule
  on public.port_calls (site_id, coalesce(estimated_arrival_at, scheduled_arrival_at), status);
create index port_calls_vessel_schedule
  on public.port_calls (vessel_id, coalesce(estimated_arrival_at, scheduled_arrival_at));

create table public.port_call_revisions (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  site_id uuid not null references public.sites(id) on delete restrict,
  port_call_id uuid not null references public.port_calls(id) on delete cascade,
  status public.port_call_status not null,
  scheduled_arrival_at timestamptz,
  scheduled_departure_at timestamptz,
  estimated_arrival_at timestamptz,
  estimated_departure_at timestamptz,
  actual_arrival_at timestamptz,
  actual_departure_at timestamptz,
  source text not null,
  source_revision text,
  recorded_by uuid references public.app_users(id) on delete set null,
  recorded_at timestamptz not null default now()
);

create index port_call_revisions_call_time
  on public.port_call_revisions (port_call_id, recorded_at desc);

create table public.call_load_forecasts (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  site_id uuid not null references public.sites(id) on delete restrict,
  port_call_id uuid not null references public.port_calls(id) on delete cascade,
  passenger_count integer not null default 0 check (passenger_count >= 0),
  passenger_quota integer check (passenger_quota is null or passenger_quota >= 0),
  vehicle_count integer not null default 0 check (vehicle_count >= 0),
  freight_unit_count integer not null default 0 check (freight_unit_count >= 0),
  coach_count integer not null default 0 check (coach_count >= 0),
  source text not null default 'manual' check (char_length(source) between 2 and 50),
  source_revision text check (source_revision is null or char_length(source_revision) <= 100),
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (port_call_id, source, received_at)
);

create index call_load_forecasts_latest
  on public.call_load_forecasts (port_call_id, received_at desc);

create table public.demand_profiles (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  site_id uuid not null references public.sites(id) on delete restrict,
  code text not null check (code ~ '^[A-Z0-9-]{2,32}$'),
  name text not null check (char_length(name) between 2 and 120),
  version integer not null default 1 check (version > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, code, version)
);

create table public.demand_profile_lines (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  site_id uuid not null references public.sites(id) on delete restrict,
  demand_profile_id uuid not null references public.demand_profiles(id) on delete cascade,
  position_id uuid not null references public.positions(id) on delete restrict,
  anchor public.demand_anchor not null,
  starts_offset_minutes integer not null check (starts_offset_minutes between -1440 and 1440),
  duration_minutes integer not null check (duration_minutes between 15 and 1440),
  base_agents smallint not null default 0 check (base_agents between 0 and 100),
  passengers_per_extra_agent integer check (passengers_per_extra_agent is null or passengers_per_extra_agent > 0),
  vehicles_per_extra_agent integer check (vehicles_per_extra_agent is null or vehicles_per_extra_agent > 0),
  minimum_agents smallint not null default 0 check (minimum_agents between 0 and 100),
  maximum_agents smallint check (maximum_agents is null or maximum_agents between 0 and 100),
  created_at timestamptz not null default now(),
  check (maximum_agents is null or maximum_agents >= minimum_agents)
);

create table public.planning_periods (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  site_id uuid not null references public.sites(id) on delete restrict,
  name text not null check (char_length(name) between 2 and 120),
  starts_on date not null,
  ends_on date not null,
  timezone text not null default 'Europe/Paris',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, starts_on, ends_on),
  check (ends_on >= starts_on),
  check (ends_on - starts_on <= 92)
);

create table public.schedule_versions (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  site_id uuid not null references public.sites(id) on delete restrict,
  planning_period_id uuid not null references public.planning_periods(id) on delete cascade,
  parent_version_id uuid references public.schedule_versions(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  status public.schedule_status not null default 'draft',
  label text not null check (char_length(label) between 2 and 120),
  change_reason text check (change_reason is null or char_length(change_reason) <= 500),
  created_by uuid not null references public.app_users(id) on delete restrict,
  validated_by uuid references public.app_users(id) on delete set null,
  validated_at timestamptz,
  published_by uuid references public.app_users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (planning_period_id, version_number),
  check ((validated_at is null) = (validated_by is null)),
  check ((published_at is null) = (published_by is null))
);

create unique index schedule_versions_one_published
  on public.schedule_versions (planning_period_id)
  where status = 'published';

create table public.staffing_requirements (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  site_id uuid not null references public.sites(id) on delete restrict,
  planning_period_id uuid not null references public.planning_periods(id) on delete cascade,
  port_call_id uuid references public.port_calls(id) on delete cascade,
  demand_profile_line_id uuid references public.demand_profile_lines(id) on delete set null,
  position_id uuid not null references public.positions(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  required_agents smallint not null check (required_agents between 1 and 100),
  source_revision text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index staffing_requirements_period_time
  on public.staffing_requirements (planning_period_id, starts_at, ends_at, position_id);

create table public.planning_shifts (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  site_id uuid not null references public.sites(id) on delete restrict,
  schedule_version_id uuid not null references public.schedule_versions(id) on delete cascade,
  agent_id uuid not null references public.agents(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  break_minutes integer not null default 0 check (break_minutes between 0 and 720),
  origin public.shift_origin not null default 'manual',
  note text check (note is null or char_length(note) <= 500),
  created_by uuid not null references public.app_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (break_minutes < extract(epoch from (ends_at - starts_at)) / 60)
);

alter table public.planning_shifts
  add constraint planning_shifts_no_agent_overlap
  exclude using gist (
    schedule_version_id with =,
    agent_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  );

create index planning_shifts_version_time
  on public.planning_shifts (schedule_version_id, starts_at, ends_at);
create index planning_shifts_agent_time
  on public.planning_shifts (agent_id, starts_at, ends_at);

create table public.shift_assignments (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  site_id uuid not null references public.sites(id) on delete restrict,
  planning_shift_id uuid not null references public.planning_shifts(id) on delete cascade,
  position_id uuid not null references public.positions(id) on delete restrict,
  staffing_requirement_id uuid references public.staffing_requirements(id) on delete set null,
  port_call_id uuid references public.port_calls(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index shift_assignments_shift_time
  on public.shift_assignments (planning_shift_id, starts_at, ends_at);
create index shift_assignments_call
  on public.shift_assignments (port_call_id, starts_at, ends_at)
  where port_call_id is not null;

create table public.time_ledger_entries (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  site_id uuid not null references public.sites(id) on delete restrict,
  agent_id uuid not null references public.agents(id) on delete restrict,
  planning_shift_id uuid references public.planning_shifts(id) on delete set null,
  work_date date not null,
  planned_minutes integer not null default 0 check (planned_minutes between 0 and 1440),
  worked_minutes integer check (worked_minutes is null or worked_minutes between 0 and 1440),
  adjustment_minutes integer not null default 0 check (adjustment_minutes between -1440 and 1440),
  adjustment_reason text check (
    (adjustment_minutes = 0 and adjustment_reason is null)
    or (adjustment_minutes <> 0 and char_length(adjustment_reason) between 3 and 500)
  ),
  approved_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (agent_id, planning_shift_id, work_date)
);

create index time_ledger_agent_date
  on public.time_ledger_entries (agent_id, work_date);

create table public.disruption_events (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  site_id uuid not null references public.sites(id) on delete restrict,
  port_call_id uuid not null references public.port_calls(id) on delete cascade,
  kind public.disruption_kind not null,
  previous_arrival_at timestamptz,
  new_arrival_at timestamptz,
  previous_departure_at timestamptz,
  new_departure_at timestamptz,
  source text not null check (char_length(source) between 2 and 50),
  source_revision text,
  detected_at timestamptz not null default now(),
  created_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (
    previous_arrival_at is distinct from new_arrival_at
    or previous_departure_at is distinct from new_departure_at
    or kind = 'cancellation'
  )
);

create index disruption_events_call_time
  on public.disruption_events (port_call_id, detected_at desc);

create table public.replanning_scenarios (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  site_id uuid not null references public.sites(id) on delete restrict,
  disruption_event_id uuid not null references public.disruption_events(id) on delete cascade,
  base_schedule_version_id uuid not null references public.schedule_versions(id) on delete restrict,
  candidate_schedule_version_id uuid references public.schedule_versions(id) on delete restrict,
  status public.scenario_status not null default 'draft',
  title text not null check (char_length(title) between 2 and 160),
  summary text check (summary is null or char_length(summary) <= 1000),
  created_by uuid not null references public.app_users(id) on delete restrict,
  approved_by uuid references public.app_users(id) on delete set null,
  approved_at timestamptz,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((approved_at is null) = (approved_by is null)),
  check (status <> 'applied' or (approved_at is not null and applied_at is not null))
);

create table public.replanning_impacts (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  site_id uuid not null references public.sites(id) on delete restrict,
  scenario_id uuid not null references public.replanning_scenarios(id) on delete cascade,
  severity public.impact_severity not null,
  impact_type text not null check (impact_type ~ '^[a-z][a-z0-9_.-]{2,80}$'),
  agent_id uuid references public.agents(id) on delete set null,
  planning_shift_id uuid references public.planning_shifts(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  acknowledged_by uuid references public.app_users(id) on delete set null,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  check (jsonb_typeof(details) = 'object'),
  check ((acknowledged_at is null) = (acknowledged_by is null))
);

create table public.agent_notifications (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  site_id uuid not null references public.sites(id) on delete restrict,
  agent_id uuid not null references public.agents(id) on delete cascade,
  scenario_id uuid references public.replanning_scenarios(id) on delete set null,
  status public.notification_status not null default 'pending',
  channel text not null check (channel in ('in_app', 'email', 'sms', 'push')),
  subject text not null check (char_length(subject) between 2 and 160),
  body text not null check (char_length(body) between 2 and 2000),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 160),
  sent_at timestamptz,
  acknowledged_at timestamptz,
  failed_reason text check (failed_reason is null or char_length(failed_reason) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);

create index agent_notifications_agent_status
  on public.agent_notifications (agent_id, status, created_at desc);

create table public.outbox_events (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  site_id uuid references public.sites(id) on delete restrict,
  topic text not null check (topic ~ '^[a-z][a-z0-9_.-]{2,100}$'),
  aggregate_type text not null check (aggregate_type ~ '^[a-z][a-z0-9_.-]{1,80}$'),
  aggregate_id uuid not null,
  payload jsonb not null,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 160),
  available_at timestamptz not null default now(),
  processed_at timestamptz,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error text,
  created_at timestamptz not null default now(),
  unique (organization_id, idempotency_key),
  check (jsonb_typeof(payload) = 'object')
);

create index outbox_events_pending
  on public.outbox_events (available_at, created_at)
  where processed_at is null;

create or replace function public.record_port_call_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
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
    (select auth.uid())
  );
  return new;
end;
$$;

create trigger port_calls_record_revision
after insert or update on public.port_calls
for each row execute function public.record_port_call_revision();

create or replace function public.protect_schedule_content()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  version_id uuid;
  version_status public.schedule_status;
begin
  version_id := case
    when tg_table_name = 'planning_shifts' then coalesce(new.schedule_version_id, old.schedule_version_id)
    else (
      select shift.schedule_version_id
      from public.planning_shifts shift
      where shift.id = coalesce(new.planning_shift_id, old.planning_shift_id)
    )
  end;

  select schedule.status into version_status
  from public.schedule_versions schedule
  where schedule.id = version_id;

  if version_status in ('published', 'archived') then
    raise exception 'Published or archived schedules are immutable';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger planning_shifts_protect_published
before insert or update or delete on public.planning_shifts
for each row execute function public.protect_schedule_content();

create trigger shift_assignments_protect_published
before insert or update or delete on public.shift_assignments
for each row execute function public.protect_schedule_content();

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
  select * into target
  from public.schedule_versions
  where id = target_schedule_version_id
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

  update public.schedule_versions
  set status = 'archived', updated_at = now()
  where planning_period_id = target.planning_period_id
    and status = 'published';

  update public.schedule_versions
  set status = 'published',
      change_reason = publication_reason,
      published_by = (select auth.uid()),
      published_at = now(),
      updated_at = now()
  where id = target.id
  returning * into target;

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

revoke all on function public.record_port_call_revision() from public;
revoke all on function public.protect_schedule_content() from public;
revoke all on function public.publish_schedule_version(uuid, text) from public;
grant execute on function public.publish_schedule_version(uuid, text) to authenticated;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'ports',
    'vessels',
    'routes',
    'port_calls',
    'demand_profiles',
    'planning_periods',
    'schedule_versions',
    'staffing_requirements',
    'planning_shifts',
    'shift_assignments',
    'time_ledger_entries',
    'replanning_scenarios',
    'agent_notifications'
  ] loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      target_table || '_set_updated_at',
      target_table
    );
  end loop;
end;
$$;

create policy ports_manage_organization
on public.ports for all to authenticated
using (
  public.has_organization_role(
    organization_id,
    array['platform_admin', 'planning_admin']::public.app_role[]
  )
)
with check (
  public.has_organization_role(
    organization_id,
    array['platform_admin', 'planning_admin']::public.app_role[]
  )
);

create policy vessels_manage_organization
on public.vessels for all to authenticated
using (
  public.has_organization_role(
    organization_id,
    array['platform_admin', 'planning_admin']::public.app_role[]
  )
)
with check (
  public.has_organization_role(
    organization_id,
    array['platform_admin', 'planning_admin']::public.app_role[]
  )
);

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'ports',
    'vessels',
    'routes',
    'port_calls',
    'call_load_forecasts',
    'demand_profiles',
    'demand_profile_lines',
    'planning_periods',
    'schedule_versions',
    'staffing_requirements',
    'planning_shifts',
    'shift_assignments',
    'time_ledger_entries',
    'disruption_events',
    'replanning_scenarios',
    'replanning_impacts',
    'agent_notifications'
  ] loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function public.capture_table_audit()',
      target_table || '_audit',
      target_table
    );
  end loop;
end;
$$;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'ports',
    'vessels',
    'routes',
    'port_calls',
    'port_call_revisions',
    'call_load_forecasts',
    'demand_profiles',
    'demand_profile_lines',
    'planning_periods',
    'schedule_versions',
    'staffing_requirements',
    'planning_shifts',
    'shift_assignments',
    'time_ledger_entries',
    'disruption_events',
    'replanning_scenarios',
    'replanning_impacts',
    'agent_notifications',
    'outbox_events'
  ] loop
    execute format('alter table public.%I enable row level security', target_table);
  end loop;
end;
$$;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'ports',
    'vessels',
    'routes',
    'port_calls',
    'port_call_revisions',
    'call_load_forecasts',
    'demand_profiles',
    'demand_profile_lines',
    'planning_periods',
    'schedule_versions',
    'staffing_requirements',
    'planning_shifts',
    'shift_assignments',
    'time_ledger_entries',
    'disruption_events',
    'replanning_scenarios',
    'replanning_impacts',
    'agent_notifications'
  ] loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.has_role(organization_id, coalesce((to_jsonb(%I) ->> ''site_id'')::uuid, null), array[''platform_admin'', ''planning_admin'', ''planner'', ''approver'', ''supervisor'', ''hr'', ''auditor'']::public.app_role[]) or exists (select 1 from public.agents a where a.id = nullif(to_jsonb(%I) ->> ''agent_id'', '''')::uuid and a.user_id = (select auth.uid())))',
      target_table || '_select_authorized',
      target_table,
      target_table,
      target_table
    );
  end loop;
end;
$$;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'routes',
    'port_calls',
    'call_load_forecasts',
    'demand_profiles',
    'demand_profile_lines',
    'planning_periods',
    'schedule_versions',
    'staffing_requirements',
    'planning_shifts',
    'shift_assignments',
    'time_ledger_entries',
    'disruption_events',
    'replanning_scenarios',
    'replanning_impacts',
    'agent_notifications'
  ] loop
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.has_role(organization_id, coalesce((to_jsonb(%I) ->> ''site_id'')::uuid, null), array[''platform_admin'', ''planning_admin'', ''planner'']::public.app_role[])) with check (public.has_role(organization_id, coalesce((to_jsonb(%I) ->> ''site_id'')::uuid, null), array[''platform_admin'', ''planning_admin'', ''planner'']::public.app_role[]))',
      target_table || '_manage_authorized',
      target_table,
      target_table,
      target_table
    );
  end loop;
end;
$$;

create policy schedule_versions_approver_update
on public.schedule_versions for update to authenticated
using (
  public.has_role(
    organization_id,
    site_id,
    array['platform_admin', 'planning_admin', 'approver']::public.app_role[]
  )
)
with check (
  public.has_role(
    organization_id,
    site_id,
    array['platform_admin', 'planning_admin', 'approver']::public.app_role[]
  )
);

create policy port_call_revisions_insert_authorized
on public.port_call_revisions for insert to authenticated
with check (
  public.has_role(
    organization_id,
    site_id,
    array['platform_admin', 'planning_admin', 'planner']::public.app_role[]
  )
);

create policy agent_notifications_acknowledge_self
on public.agent_notifications for update to authenticated
using (
  exists (
    select 1 from public.agents agent
    where agent.id = agent_notifications.agent_id
      and agent.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.agents agent
    where agent.id = agent_notifications.agent_id
      and agent.user_id = (select auth.uid())
  )
  and status = 'acknowledged'
);

create policy outbox_events_service_only
on public.outbox_events for all to service_role
using (true)
with check (true);

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'ports',
    'vessels',
    'routes',
    'port_calls',
    'port_call_revisions',
    'call_load_forecasts',
    'demand_profiles',
    'demand_profile_lines',
    'planning_periods',
    'schedule_versions',
    'staffing_requirements',
    'planning_shifts',
    'shift_assignments',
    'time_ledger_entries',
    'disruption_events',
    'replanning_scenarios',
    'replanning_impacts',
    'agent_notifications',
    'outbox_events'
  ] loop
    execute format('revoke all on public.%I from anon', target_table);
    execute format('grant all on public.%I to service_role', target_table);
  end loop;
end;
$$;

grant select, insert, update, delete on public.ports to authenticated;
grant select, insert, update, delete on public.vessels to authenticated;
grant select, insert, update, delete on public.routes to authenticated;
grant select, insert, update, delete on public.port_calls to authenticated;
grant select, insert on public.port_call_revisions to authenticated;
grant select, insert, update, delete on public.call_load_forecasts to authenticated;
grant select, insert, update, delete on public.demand_profiles to authenticated;
grant select, insert, update, delete on public.demand_profile_lines to authenticated;
grant select, insert, update, delete on public.planning_periods to authenticated;
grant select, insert, update, delete on public.schedule_versions to authenticated;
grant select, insert, update, delete on public.staffing_requirements to authenticated;
grant select, insert, update, delete on public.planning_shifts to authenticated;
grant select, insert, update, delete on public.shift_assignments to authenticated;
grant select, insert, update, delete on public.time_ledger_entries to authenticated;
grant select, insert, update, delete on public.disruption_events to authenticated;
grant select, insert, update, delete on public.replanning_scenarios to authenticated;
grant select, insert, update, delete on public.replanning_impacts to authenticated;
grant select, insert, update on public.agent_notifications to authenticated;

grant usage, select on sequence public.port_call_revisions_id_seq to authenticated, service_role;
