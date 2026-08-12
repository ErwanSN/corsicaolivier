-- Make load forecasts an immutable, source-aware event stream. Human writes
-- and feed ingestion use separate commands so neither can impersonate the
-- other or choose trusted metadata.

create or replace function public.maritime_load_payload_fingerprint(
  load_passenger_count integer,
  load_passenger_quota integer,
  load_vehicle_count integer,
  load_freight_unit_count integer,
  load_coach_count integer,
  load_source text,
  load_source_revision text,
  load_source_sequence bigint
)
returns text
language sql
immutable
set search_path = ''
as $$
  select md5(jsonb_build_object(
    'passengerCount', load_passenger_count,
    'passengerQuota', load_passenger_quota,
    'vehicleCount', load_vehicle_count,
    'freightUnitCount', load_freight_unit_count,
    'coachCount', load_coach_count,
    'source', pg_catalog.lower(pg_catalog.btrim(load_source)),
    'sourceRevision', nullif(pg_catalog.btrim(load_source_revision), ''),
    'sourceSequence', load_source_sequence
  )::text);
$$;

revoke all on function public.maritime_load_payload_fingerprint(
  integer,
  integer,
  integer,
  integer,
  integer,
  text,
  text,
  bigint
) from public, anon, authenticated;

create table public.call_load_forecast_source_policies (
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

insert into public.call_load_forecast_source_policies (
  organization_id, source, priority, ordered_updates_required, active
)
select
  policy.organization_id,
  policy.source,
  policy.priority,
  policy.ordered_updates_required,
  policy.active
from public.port_call_source_policies policy;

create or replace function public.seed_default_call_load_source_policies()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.call_load_forecast_source_policies (
    organization_id, source, priority, ordered_updates_required
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

revoke all on function public.seed_default_call_load_source_policies()
from public, anon, authenticated, service_role;

create trigger organizations_seed_call_load_source_policies
after insert on public.organizations
for each row execute function public.seed_default_call_load_source_policies();

create trigger call_load_source_policies_set_updated_at
before update on public.call_load_forecast_source_policies
for each row execute function public.set_updated_at();

create trigger call_load_source_policies_audit
after insert or update or delete on public.call_load_forecast_source_policies
for each row execute function public.capture_table_audit();

alter table public.call_load_forecast_source_policies enable row level security;
alter table public.call_load_forecast_source_policies force row level security;

create policy call_load_source_policies_select_authorized
on public.call_load_forecast_source_policies
for select to authenticated
using (
  public.has_role(
    organization_id,
    null,
    array[
      'platform_admin', 'planning_admin', 'planner', 'approver',
      'supervisor', 'auditor'
    ]::public.app_role[]
  )
);

create policy call_load_source_policies_active_account_gate
on public.call_load_forecast_source_policies
as restrictive for all to authenticated
using ((select public.is_current_app_user_active()))
with check ((select public.is_current_app_user_active()));

revoke all on table public.call_load_forecast_source_policies
from public, anon, authenticated, service_role;
grant select on table public.call_load_forecast_source_policies
to authenticated, service_role;

alter table public.call_load_forecasts
  add column source_priority smallint
    check (source_priority between 0 and 32767),
  add column source_sequence bigint
    check (source_sequence >= 0),
  add column source_received_at timestamptz,
  add column payload_fingerprint text
    check (payload_fingerprint ~ '^[0-9a-f]{32}$');

with ranked as (
  select
    forecast.id,
    row_number() over (
      partition by
        forecast.port_call_id,
        pg_catalog.lower(pg_catalog.btrim(forecast.source))
      order by forecast.received_at, forecast.created_at, forecast.id
    ) - 1 as source_sequence
  from public.call_load_forecasts forecast
)
update public.call_load_forecasts forecast
set source_priority = coalesce(
      (
        select policy.priority
        from public.call_load_forecast_source_policies policy
        where policy.organization_id = forecast.organization_id
          and policy.source = pg_catalog.lower(
            pg_catalog.btrim(forecast.source)
          )
          and policy.active
      ),
      0
    ),
    source_sequence = ranked.source_sequence,
    source_received_at = coalesce(forecast.received_at, forecast.created_at),
    payload_fingerprint = public.maritime_load_payload_fingerprint(
      forecast.passenger_count,
      forecast.passenger_quota,
      forecast.vehicle_count,
      forecast.freight_unit_count,
      forecast.coach_count,
      forecast.source,
      forecast.source_revision,
      ranked.source_sequence
    )
from ranked
where ranked.id = forecast.id;

alter table public.call_load_forecasts
  alter column source_priority set not null,
  alter column source_priority set default 0,
  alter column source_sequence set not null,
  alter column source_received_at set not null,
  alter column source_received_at set default now(),
  alter column payload_fingerprint set not null;

create unique index call_load_forecasts_source_sequence_unique
  on public.call_load_forecasts (
    port_call_id,
    pg_catalog.lower(pg_catalog.btrim(source)),
    source_sequence
  );

create unique index call_load_forecasts_payload_unique
  on public.call_load_forecasts (
    port_call_id,
    pg_catalog.lower(pg_catalog.btrim(source)),
    payload_fingerprint
  );

create index call_load_forecasts_effective_order
  on public.call_load_forecasts (
    port_call_id,
    source_priority desc,
    source_sequence desc,
    source_received_at desc,
    received_at desc,
    id desc
  );

create or replace function public.initialize_call_load_forecast_metadata()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_call public.port_calls;
  target_priority smallint;
begin
  select call.*
  into target_call
  from public.port_calls call
  where call.id = new.port_call_id;

  if not found then
    raise exception 'Port call not found' using errcode = '23503';
  end if;

  if target_call.organization_id <> new.organization_id
    or target_call.site_id <> new.site_id then
    raise exception 'Forecast scope does not match port call scope'
      using errcode = '23514';
  end if;

  new.source := pg_catalog.lower(pg_catalog.btrim(new.source));
  new.source_revision := nullif(pg_catalog.btrim(new.source_revision), '');

  select policy.priority
  into target_priority
  from public.call_load_forecast_source_policies policy
  where policy.organization_id = new.organization_id
    and policy.source = new.source
    and policy.active;

  if not found then
    raise exception 'Unknown or inactive maritime load source'
      using errcode = '22023';
  end if;

  if new.source_sequence is null or new.source_sequence < 0 then
    raise exception 'A non-negative source sequence is required'
      using errcode = '22023';
  end if;

  new.source_priority := target_priority;
  new.source_received_at := coalesce(
    new.source_received_at,
    clock_timestamp()
  );
  -- received_at is always the platform receipt time, never client input.
  new.received_at := clock_timestamp();
  new.payload_fingerprint := public.maritime_load_payload_fingerprint(
    new.passenger_count,
    new.passenger_quota,
    new.vehicle_count,
    new.freight_unit_count,
    new.coach_count,
    new.source,
    new.source_revision,
    new.source_sequence
  );

  return new;
end;
$$;

revoke all on function public.initialize_call_load_forecast_metadata()
from public, anon, authenticated;

drop trigger if exists call_load_forecasts_00_initialize_metadata
on public.call_load_forecasts;

create trigger call_load_forecasts_00_initialize_metadata
before insert on public.call_load_forecasts
for each row execute function public.initialize_call_load_forecast_metadata();

create or replace function public.prevent_call_load_forecast_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Load forecast events are immutable'
    using errcode = '55000';
end;
$$;

revoke all on function public.prevent_call_load_forecast_mutation()
from public, anon, authenticated;

drop trigger if exists call_load_forecasts_01_immutable
on public.call_load_forecasts;

create trigger call_load_forecasts_01_immutable
before update on public.call_load_forecasts
for each row execute function public.prevent_call_load_forecast_mutation();

create table public.call_load_forecast_overrides (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id) on delete restrict,
  site_id uuid not null references public.sites(id) on delete restrict,
  port_call_id uuid not null
    references public.port_calls(id) on delete cascade,
  forecast_id uuid not null unique
    references public.call_load_forecasts(id) on delete restrict,
  previous_effective_forecast_id uuid
    references public.call_load_forecasts(id) on delete restrict,
  reason text not null check (char_length(reason) between 3 and 500),
  valid_until timestamptz not null check (pg_catalog.isfinite(valid_until)),
  created_by uuid not null references public.app_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  resumed_at timestamptz,
  resumed_reason text check (
    resumed_reason is null or char_length(resumed_reason) between 3 and 120
  ),
  check (valid_until > created_at),
  check ((resumed_at is null) = (resumed_reason is null))
);

create unique index call_load_forecast_overrides_one_open
  on public.call_load_forecast_overrides (port_call_id)
  where resumed_at is null;

create index call_load_forecast_overrides_expiry
  on public.call_load_forecast_overrides (valid_until, port_call_id)
  where resumed_at is null;

alter table public.call_load_forecast_overrides enable row level security;
alter table public.call_load_forecast_overrides force row level security;

create policy call_load_forecast_overrides_select_authorized
on public.call_load_forecast_overrides
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

create policy call_load_forecast_overrides_active_account_gate
on public.call_load_forecast_overrides
as restrictive for all to authenticated
using ((select public.is_current_app_user_active()))
with check ((select public.is_current_app_user_active()));

revoke all on table public.call_load_forecast_overrides
from public, anon, authenticated, service_role;
grant select on table public.call_load_forecast_overrides
to authenticated, service_role;

create or replace view public.effective_call_load_forecasts
with (security_invoker = true)
as
with latest_per_source as (
  select distinct on (
    forecast.port_call_id,
    pg_catalog.lower(pg_catalog.btrim(forecast.source))
  )
    forecast.*,
    policy.priority as current_priority
  from public.call_load_forecasts forecast
  join public.call_load_forecast_source_policies policy
    on policy.organization_id = forecast.organization_id
    and policy.source = pg_catalog.lower(pg_catalog.btrim(forecast.source))
    and policy.active
  where not exists (
    select 1
    from public.call_load_forecast_overrides source_override
    where source_override.forecast_id = forecast.id
  )
  order by
    forecast.port_call_id,
    pg_catalog.lower(pg_catalog.btrim(forecast.source)),
    forecast.source_sequence desc,
    forecast.source_received_at desc,
    forecast.received_at desc,
    forecast.id desc
), candidates as (
  select baseline.*, false as active_override
  from latest_per_source baseline
  union all
  select
    forecast.*,
    policy.priority as current_priority,
    true as active_override
  from public.call_load_forecast_overrides source_override
  join public.call_load_forecasts forecast
    on forecast.id = source_override.forecast_id
  join public.call_load_forecast_source_policies policy
    on policy.organization_id = forecast.organization_id
    and policy.source = pg_catalog.lower(pg_catalog.btrim(forecast.source))
    and policy.active
  where source_override.resumed_at is null
)
select distinct on (candidate.port_call_id)
  candidate.id,
  candidate.organization_id,
  candidate.site_id,
  candidate.port_call_id,
  candidate.passenger_count,
  candidate.passenger_quota,
  candidate.vehicle_count,
  candidate.freight_unit_count,
  candidate.coach_count,
  candidate.source,
  candidate.source_revision,
  candidate.received_at,
  candidate.created_at,
  candidate.source_priority,
  candidate.source_sequence,
  candidate.source_received_at,
  candidate.payload_fingerprint
from candidates candidate
order by
  candidate.port_call_id,
  candidate.active_override desc,
  candidate.current_priority desc,
  candidate.source_received_at desc,
  candidate.received_at desc,
  candidate.source_sequence desc,
  candidate.id desc;

revoke all on table public.effective_call_load_forecasts
from public, anon;
grant select on table public.effective_call_load_forecasts
to authenticated, service_role;

create or replace function public.get_latest_call_load_forecasts(
  target_port_call_ids uuid[]
)
returns setof public.call_load_forecasts
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if target_port_call_ids is null
    or cardinality(target_port_call_ids) > 500 then
    raise exception 'Between 0 and 500 port call ids are accepted'
      using errcode = '22023';
  end if;

  return query
  select forecast.*
  from public.effective_call_load_forecasts forecast
  where forecast.port_call_id = any(target_port_call_ids)
  order by forecast.port_call_id;
end;
$$;

revoke all on function public.get_latest_call_load_forecasts(uuid[])
from public, anon, authenticated;
grant execute on function public.get_latest_call_load_forecasts(uuid[])
to authenticated;

create or replace function public.set_call_load_forecast_source_policy_state(
  target_organization_id uuid,
  target_source text,
  new_priority smallint,
  new_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_source text := pg_catalog.lower(pg_catalog.btrim(target_source));
  target_policy public.call_load_forecast_source_policies;
  affected_call_id uuid;
  reconciled_count integer := 0;
begin
  if normalized_source is null
    or new_priority is null
    or new_priority not between 0 and 32767
    or new_active is null then
    raise exception 'A valid maritime source policy state is required'
      using errcode = '22023';
  end if;

  if not public.has_organization_role(
    target_organization_id,
    array['platform_admin', 'planning_admin']::public.app_role[]
  ) then
    raise exception 'Insufficient permissions' using errcode = '42501';
  end if;

  select policy.*
  into target_policy
  from public.call_load_forecast_source_policies policy
  where policy.organization_id = target_organization_id
    and policy.source = normalized_source
  for update;

  if not found then
    raise exception 'Maritime source policy not found' using errcode = 'P0002';
  end if;

  update public.call_load_forecast_source_policies policy
  set priority = new_priority,
      active = new_active,
      updated_at = now()
  where policy.organization_id = target_organization_id
    and policy.source = normalized_source;

  for affected_call_id in
    select distinct forecast.port_call_id
    from public.call_load_forecasts forecast
    where forecast.organization_id = target_organization_id
      and pg_catalog.lower(pg_catalog.btrim(forecast.source)) =
        normalized_source
    order by forecast.port_call_id
  loop
    perform 1
    from public.port_calls call
    where call.id = affected_call_id
    for update;

    perform public.ensure_planning_workspace_for_port_call(affected_call_id);
    reconciled_count := reconciled_count + 1;
  end loop;

  return jsonb_build_object(
    'source', normalized_source,
    'active', new_active,
    'priority', new_priority,
    'reconciledPortCallCount', reconciled_count
  );
end;
$$;

revoke insert, update, delete on table public.call_load_forecast_source_policies
from authenticated, service_role;
revoke all on function public.set_call_load_forecast_source_policy_state(
  uuid, text, smallint, boolean
) from public, anon, authenticated, service_role;
grant execute on function public.set_call_load_forecast_source_policy_state(
  uuid, text, smallint, boolean
) to authenticated;

create or replace function public.sync_planning_from_load_forecast()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_setting('app.call_load_forecast_override', true) = 'true' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    perform public.ensure_planning_workspace_for_port_call(old.port_call_id);
    return old;
  end if;

  perform public.ensure_planning_workspace_for_port_call(new.port_call_id);
  return new;
end;
$$;

revoke all on function public.sync_planning_from_load_forecast()
from public, anon, authenticated, service_role;

create or replace function public.create_manual_call_load_forecast(
  target_organization_id uuid,
  target_site_id uuid,
  target_port_call_id uuid,
  new_passenger_count integer,
  new_passenger_quota integer,
  new_vehicle_count integer,
  new_freight_unit_count integer,
  new_coach_count integer
)
returns public.call_load_forecasts
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_call public.port_calls;
  next_sequence bigint;
  created_forecast public.call_load_forecasts;
  event_time timestamptz := clock_timestamp();
begin
  if (select auth.uid()) is null
    or not public.is_current_app_user_active()
    or not public.has_role(
      target_organization_id,
      target_site_id,
      array[
        'platform_admin',
        'planning_admin',
        'planner'
      ]::public.app_role[]
    ) then
    raise exception 'Insufficient permissions' using errcode = '42501';
  end if;

  select call.*
  into target_call
  from public.port_calls call
  where call.id = target_port_call_id
    and call.organization_id = target_organization_id
    and call.site_id = target_site_id
  for update;

  if not found then
    raise exception 'Port call not found in scope' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.effective_call_load_forecasts forecast
    where forecast.port_call_id = target_call.id
  ) then
    raise exception 'A durable baseline requires no effective forecast'
      using errcode = 'P2063';
  end if;

  select coalesce(max(forecast.source_sequence), -1) + 1
  into next_sequence
  from public.call_load_forecasts forecast
  where forecast.port_call_id = target_call.id
    and pg_catalog.lower(pg_catalog.btrim(forecast.source)) = 'tools-panel';

  insert into public.call_load_forecasts (
    organization_id,
    site_id,
    port_call_id,
    passenger_count,
    passenger_quota,
    vehicle_count,
    freight_unit_count,
    coach_count,
    source,
    source_revision,
    source_sequence,
    source_received_at
  ) values (
    target_call.organization_id,
    target_call.site_id,
    target_call.id,
    new_passenger_count,
    new_passenger_quota,
    new_vehicle_count,
    coalesce(new_freight_unit_count, 0),
    coalesce(new_coach_count, 0),
    'tools-panel',
    'manual-' || extensions.gen_random_uuid()::text,
    next_sequence,
    event_time
  )
  returning * into created_forecast;

  return created_forecast;
end;
$$;

revoke all on function public.create_manual_call_load_forecast(
  uuid, uuid, uuid, integer, integer, integer, integer, integer
) from public, anon, authenticated, service_role;
grant execute on function public.create_manual_call_load_forecast(
  uuid, uuid, uuid, integer, integer, integer, integer, integer
) to authenticated;

create or replace function public.override_call_load_forecast(
  target_organization_id uuid,
  target_site_id uuid,
  target_port_call_id uuid,
  new_passenger_count integer,
  new_passenger_quota integer,
  new_vehicle_count integer,
  new_freight_unit_count integer,
  new_coach_count integer,
  override_reason text,
  override_valid_until timestamptz,
  expected_effective_forecast_id uuid
)
returns public.call_load_forecasts
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_call public.port_calls;
  previous_forecast public.call_load_forecasts;
  next_sequence bigint;
  created_forecast public.call_load_forecasts;
  event_time timestamptz := clock_timestamp();
begin
  if (select auth.uid()) is null
    or not public.is_current_app_user_active()
    or not public.has_role(
      target_organization_id,
      target_site_id,
      array[
        'platform_admin',
        'planning_admin',
        'planner'
      ]::public.app_role[]
    ) then
    raise exception 'Insufficient permissions' using errcode = '42501';
  end if;

  if override_reason is null
    or char_length(pg_catalog.btrim(override_reason)) not between 3 and 500
  then
    raise exception 'A valid load override reason is required'
      using errcode = '22023';
  end if;

  if override_valid_until is null
    or not pg_catalog.isfinite(override_valid_until)
    or override_valid_until < event_time + interval '5 minutes'
    or override_valid_until > event_time + interval '24 hours'
  then
    raise exception 'A load override must expire between 5 minutes and 24 hours'
      using errcode = '22023';
  end if;

  select call.*
  into target_call
  from public.port_calls call
  where call.id = target_port_call_id
    and call.organization_id = target_organization_id
    and call.site_id = target_site_id
  for update;

  if not found then
    raise exception 'Port call not found in scope' using errcode = 'P0002';
  end if;

  select forecast.*
  into previous_forecast
  from public.effective_call_load_forecasts forecast
  where forecast.port_call_id = target_call.id;

  if previous_forecast.id is distinct from expected_effective_forecast_id then
    raise exception 'Effective load forecast changed concurrently'
      using errcode = 'P2063';
  end if;

  update public.call_load_forecast_overrides source_override
  set resumed_at = event_time,
      resumed_reason = 'superseded'
  where source_override.port_call_id = target_call.id
    and source_override.resumed_at is null;

  select coalesce(max(forecast.source_sequence), -1) + 1
  into next_sequence
  from public.call_load_forecasts forecast
  where forecast.port_call_id = target_call.id
    and pg_catalog.lower(pg_catalog.btrim(forecast.source)) = 'tools-panel';

  perform set_config('app.call_load_forecast_override', 'true', true);

  insert into public.call_load_forecasts (
    organization_id,
    site_id,
    port_call_id,
    passenger_count,
    passenger_quota,
    vehicle_count,
    freight_unit_count,
    coach_count,
    source,
    source_revision,
    source_sequence,
    source_received_at
  ) values (
    target_call.organization_id,
    target_call.site_id,
    target_call.id,
    new_passenger_count,
    new_passenger_quota,
    new_vehicle_count,
    coalesce(new_freight_unit_count, 0),
    coalesce(new_coach_count, 0),
    'tools-panel',
    'manual-' || extensions.gen_random_uuid()::text,
    next_sequence,
    event_time
  )
  returning * into created_forecast;

  insert into public.call_load_forecast_overrides (
      organization_id,
      site_id,
      port_call_id,
      forecast_id,
      previous_effective_forecast_id,
      reason,
      valid_until,
      created_by
    ) values (
      target_call.organization_id,
      target_call.site_id,
      target_call.id,
      created_forecast.id,
      previous_forecast.id,
      pg_catalog.btrim(override_reason),
      override_valid_until,
      (select auth.uid())
  );

  perform set_config('app.call_load_forecast_override', '', true);
  perform public.ensure_planning_workspace_for_port_call(target_call.id);
  return created_forecast;
exception
  when others then
    perform set_config('app.call_load_forecast_override', '', true);
    raise;
end;
$$;

revoke all on function public.override_call_load_forecast(
  uuid, uuid, uuid, integer, integer, integer, integer, integer,
  text, timestamptz, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.override_call_load_forecast(
  uuid, uuid, uuid, integer, integer, integer, integer, integer,
  text, timestamptz, uuid
) to authenticated;

create or replace function public.ingest_ordered_call_load_forecast(
  target_organization_id uuid,
  target_site_id uuid,
  target_port_call_id uuid,
  update_source text,
  update_source_revision text,
  update_source_sequence bigint,
  update_source_received_at timestamptz,
  new_passenger_count integer,
  new_passenger_quota integer,
  new_vehicle_count integer,
  new_freight_unit_count integer,
  new_coach_count integer
)
returns public.call_load_forecasts
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_source text := pg_catalog.lower(pg_catalog.btrim(update_source));
  normalized_revision text := nullif(
    pg_catalog.btrim(update_source_revision),
    ''
  );
  target_call public.port_calls;
  target_policy public.call_load_forecast_source_policies;
  known_forecast public.call_load_forecasts;
  incoming_fingerprint text;
  created_forecast public.call_load_forecasts;
begin
  if normalized_source is null or normalized_source = 'tools-panel'
    or normalized_revision is null
    or update_source_sequence is null
    or update_source_sequence < 0
    or update_source_sequence > 1000000000000
    or update_source_received_at is null then
    raise exception 'A trusted ordered source event is required'
      using errcode = '22023';
  end if;

  if not pg_catalog.isfinite(update_source_received_at)
    or update_source_received_at > clock_timestamp() + interval '5 minutes'
  then
    raise exception 'The source event time must be finite and current'
      using errcode = '22023';
  end if;

  select call.*
  into target_call
  from public.port_calls call
  where call.id = target_port_call_id
    and call.organization_id = target_organization_id
    and call.site_id = target_site_id
  for update;

  if not found then
    raise exception 'Port call not found in scope' using errcode = 'P0002';
  end if;

  select policy.*
  into target_policy
  from public.call_load_forecast_source_policies policy
  where policy.organization_id = target_call.organization_id
    and policy.source = normalized_source
    and policy.active
    and policy.ordered_updates_required;

  if not found then
    raise exception 'Unknown, inactive, or unordered feed source'
      using errcode = '22023';
  end if;

  incoming_fingerprint := public.maritime_load_payload_fingerprint(
    new_passenger_count,
    new_passenger_quota,
    new_vehicle_count,
    coalesce(new_freight_unit_count, 0),
    coalesce(new_coach_count, 0),
    normalized_source,
    normalized_revision,
    update_source_sequence
  );

  if exists (
    select 1
    from public.call_load_forecasts forecast
    where forecast.port_call_id = target_call.id
      and pg_catalog.lower(pg_catalog.btrim(forecast.source)) = normalized_source
      and (
        forecast.source_revision = normalized_revision
        or forecast.payload_fingerprint = incoming_fingerprint
      )
  ) then
    raise exception 'Duplicate load forecast event' using errcode = '23505';
  end if;

  select forecast.*
  into known_forecast
  from public.call_load_forecasts forecast
  where forecast.port_call_id = target_call.id
    and pg_catalog.lower(pg_catalog.btrim(forecast.source)) = normalized_source
  order by
    forecast.source_sequence desc,
    forecast.source_received_at desc,
    forecast.id desc
  limit 1;

  if found and (
    update_source_sequence <= known_forecast.source_sequence
    or update_source_received_at < known_forecast.source_received_at
  ) then
    raise exception 'Out-of-order load forecast event'
      using errcode = '22023';
  end if;

  if (
    known_forecast.id is null
    and update_source_sequence > 1000000
  ) or (
    known_forecast.id is not null
    and update_source_sequence::numeric
      > known_forecast.source_sequence::numeric + 1000000
  ) then
    raise exception 'Load forecast sequence jump exceeds the safety window'
      using errcode = '22023';
  end if;

  -- The planning synchronization trigger performs the same scoped role check
  -- as timing ingestion. Open its machine-principal gate only around this
  -- service-only command, and always close it again on failure.
  perform set_config('app.maritime_machine_feed', 'true', true);

  insert into public.call_load_forecasts (
    organization_id,
    site_id,
    port_call_id,
    passenger_count,
    passenger_quota,
    vehicle_count,
    freight_unit_count,
    coach_count,
    source,
    source_revision,
    source_sequence,
    source_received_at
  ) values (
    target_call.organization_id,
    target_call.site_id,
    target_call.id,
    new_passenger_count,
    new_passenger_quota,
    new_vehicle_count,
    coalesce(new_freight_unit_count, 0),
    coalesce(new_coach_count, 0),
    normalized_source,
    normalized_revision,
    update_source_sequence,
    update_source_received_at
  )
  returning * into created_forecast;

  perform set_config('app.maritime_machine_feed', '', true);
  return created_forecast;
exception
  when others then
    perform set_config('app.maritime_machine_feed', '', true);
    raise;
end;
$$;

revoke all on function public.ingest_ordered_call_load_forecast(
  uuid, uuid, uuid, text, text, bigint, timestamptz,
  integer, integer, integer, integer, integer
) from public, anon, authenticated, service_role;
grant execute on function public.ingest_ordered_call_load_forecast(
  uuid, uuid, uuid, text, text, bigint, timestamptz,
  integer, integer, integer, integer, integer
) to service_role;

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
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_source text := pg_catalog.lower(pg_catalog.btrim(update_source));
  known_sequence bigint;
  update_result jsonb;
begin
  if update_source_sequence is not null
    and (
      update_source_sequence < 0
      or update_source_sequence > 1000000000000
    )
  then
    raise exception 'Timing source sequence is outside the safety range'
      using errcode = 'P2060';
  end if;

  if (
    new_estimated_arrival_at is not null
    and not pg_catalog.isfinite(new_estimated_arrival_at)
  ) or (
    new_estimated_departure_at is not null
    and not pg_catalog.isfinite(new_estimated_departure_at)
  ) or (
    update_received_at is not null
    and not pg_catalog.isfinite(update_received_at)
  ) then
    raise exception 'Timing source timestamps must be finite'
      using errcode = 'P2060';
  end if;

  select cursor.last_sequence
  into known_sequence
  from public.port_call_source_cursors cursor
  where cursor.port_call_id = target_port_call_id
    and cursor.source = normalized_source;

  if update_source_sequence is not null and (
    (
      known_sequence is null
      and update_source_sequence > 1000000
    ) or (
      known_sequence is not null
      and update_source_sequence::numeric > known_sequence::numeric + 1000000
    )
  ) then
    raise exception 'Timing source sequence jump exceeds the safety window'
      using errcode = 'P2060';
  end if;

  perform set_config('app.maritime_machine_feed', 'true', true);

  update_result := public.apply_ordered_port_call_timing_update(
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

  perform set_config('app.maritime_machine_feed', '', true);
  return update_result;
exception
  when others then
    perform set_config('app.maritime_machine_feed', '', true);
    raise;
end;
$$;

revoke all on function public.update_port_call_timing(
  uuid, timestamptz, timestamptz, public.port_call_status, text, text,
  bigint, text, timestamptz, bigint
) from public, anon, authenticated, service_role;
grant execute on function public.update_port_call_timing(
  uuid, timestamptz, timestamptz, public.port_call_status, text, text,
  bigint, text, timestamptz, bigint
) to service_role;

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
language plpgsql
security definer
set search_path = ''
as $$
begin
  if pg_catalog.lower(pg_catalog.btrim(override_source)) <> 'tools-panel' then
    raise exception 'Interactive timing overrides must use tools-panel'
      using errcode = '22023';
  end if;

  if (
    new_estimated_arrival_at is not null
    and not pg_catalog.isfinite(new_estimated_arrival_at)
  ) or (
    new_estimated_departure_at is not null
    and not pg_catalog.isfinite(new_estimated_departure_at)
  ) then
    raise exception 'Interactive timing values must be finite'
      using errcode = '22023';
  end if;

  return public.apply_port_call_timing_override(
    target_port_call_id,
    new_estimated_arrival_at,
    new_estimated_departure_at,
    new_status,
    'tools-panel',
    'manual-' || extensions.gen_random_uuid()::text,
    expected_current_source_revision,
    expected_timing_lock_version,
    override_reason,
    override_valid_until
  );
end;
$$;

revoke all on function public.override_port_call_timing(
  uuid, timestamptz, timestamptz, public.port_call_status, text, text,
  text, bigint, text, timestamptz
) from public, anon, authenticated, service_role;
grant execute on function public.override_port_call_timing(
  uuid, timestamptz, timestamptz, public.port_call_status, text, text,
  text, bigint, text, timestamptz
) to authenticated;

create or replace function public.create_manual_port_call(
  target_organization_id uuid,
  target_site_id uuid,
  target_vessel_id uuid,
  target_route_id uuid,
  new_external_reference text,
  new_scheduled_arrival_at timestamptz,
  new_scheduled_departure_at timestamptz
)
returns public.port_calls
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_call public.port_calls;
  event_time timestamptz := clock_timestamp();
begin
  if (select auth.uid()) is null
    or not public.is_current_app_user_active()
    or not public.has_role(
      target_organization_id,
      target_site_id,
      array[
        'platform_admin',
        'planning_admin',
        'planner'
      ]::public.app_role[]
    ) then
    raise exception 'Insufficient permissions' using errcode = '42501';
  end if;

  if new_scheduled_arrival_at is null
    and new_scheduled_departure_at is null then
    raise exception 'An arrival or departure time is required'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.sites site
    where site.id = target_site_id
      and site.organization_id = target_organization_id
      and site.active
  ) or not exists (
    select 1
    from public.vessels vessel
    where vessel.id = target_vessel_id
      and vessel.organization_id = target_organization_id
      and vessel.active
  ) or (
    target_route_id is not null
    and not exists (
      select 1
      from public.routes route
      where route.id = target_route_id
        and route.organization_id = target_organization_id
        and route.site_id = target_site_id
    )
  ) then
    raise exception 'Port call references are outside the authorized scope'
      using errcode = '23514';
  end if;

  insert into public.port_calls (
    organization_id,
    site_id,
    vessel_id,
    route_id,
    external_reference,
    scheduled_arrival_at,
    scheduled_departure_at,
    source,
    source_revision,
    source_received_at,
    received_at
  ) values (
    target_organization_id,
    target_site_id,
    target_vessel_id,
    target_route_id,
    nullif(pg_catalog.btrim(new_external_reference), ''),
    new_scheduled_arrival_at,
    new_scheduled_departure_at,
    'tools-panel',
    'manual-' || extensions.gen_random_uuid()::text,
    event_time,
    event_time
  )
  returning * into created_call;

  return created_call;
end;
$$;

revoke all on function public.create_manual_port_call(
  uuid, uuid, uuid, uuid, text, timestamptz, timestamptz
) from public, anon, authenticated, service_role;
grant execute on function public.create_manual_port_call(
  uuid, uuid, uuid, uuid, text, timestamptz, timestamptz
) to authenticated;

create or replace function public.guard_port_call_demand_profile_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.demand_profile_id is not null and not exists (
    select 1
    from public.demand_profiles profile
    where profile.id = new.demand_profile_id
      and profile.organization_id = new.organization_id
      and profile.site_id = new.site_id
  ) then
    raise exception 'Port-call demand profile is outside its organization/site'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.guard_demand_profile_line_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.demand_profiles profile
    where profile.id = new.demand_profile_id
      and profile.organization_id = new.organization_id
      and profile.site_id = new.site_id
  ) then
    raise exception 'Demand-profile line is outside its profile scope'
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.positions position
    where position.id = new.position_id
      and position.organization_id = new.organization_id
      and (position.site_id is null or position.site_id = new.site_id)
  ) then
    raise exception 'Demand-profile line position is outside its site scope'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.guard_demand_profile_scope_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.port_calls call
    where call.demand_profile_id = old.id
      and (
        call.organization_id <> new.organization_id
        or call.site_id <> new.site_id
      )
  ) or exists (
    select 1
    from public.demand_profile_lines line
    where line.demand_profile_id = old.id
      and (
        line.organization_id <> new.organization_id
        or line.site_id <> new.site_id
      )
  ) then
    raise exception 'Referenced demand-profile scope cannot be changed'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.guard_position_scope_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.demand_profile_lines line
    where line.position_id = old.id
      and (
        line.organization_id <> new.organization_id
        or (new.site_id is not null and line.site_id <> new.site_id)
      )
  ) then
    raise exception 'Referenced position scope cannot exclude its demand profiles'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_port_call_demand_profile_scope(),
  public.guard_demand_profile_line_scope(),
  public.guard_demand_profile_scope_change(),
  public.guard_position_scope_change()
from public, anon, authenticated, service_role;

do $$
begin
  if exists (
    select 1
    from public.port_calls call
    join public.demand_profiles profile on profile.id = call.demand_profile_id
    where profile.organization_id <> call.organization_id
      or profile.site_id <> call.site_id
  ) or exists (
    select 1
    from public.demand_profile_lines line
    join public.demand_profiles profile on profile.id = line.demand_profile_id
    join public.positions position on position.id = line.position_id
    where profile.organization_id <> line.organization_id
      or profile.site_id <> line.site_id
      or position.organization_id <> line.organization_id
      or (position.site_id is not null and position.site_id <> line.site_id)
  ) then
    raise exception 'Existing planning references violate organization/site scope'
      using errcode = '23514';
  end if;
end;
$$;

create trigger port_calls_01_guard_demand_profile_scope
before insert or update of organization_id, site_id, demand_profile_id
on public.port_calls
for each row execute function public.guard_port_call_demand_profile_scope();

create trigger demand_profile_lines_01_guard_scope
before insert or update of
  organization_id, site_id, demand_profile_id, position_id
on public.demand_profile_lines
for each row execute function public.guard_demand_profile_line_scope();

create trigger demand_profiles_01_guard_scope_change
before update of organization_id, site_id on public.demand_profiles
for each row execute function public.guard_demand_profile_scope_change();

create trigger positions_01_guard_scope_change
before update of organization_id, site_id on public.positions
for each row execute function public.guard_position_scope_change();

-- Human clients can only read the immutable ledger and use the two manual
-- commands. Feed insertion is restricted to its service-role command.
revoke insert, update, delete on table public.call_load_forecasts
from authenticated, service_role;
revoke insert, delete on table public.port_calls from authenticated;
revoke insert, update, delete on table public.port_calls from service_role;

comment on view public.effective_call_load_forecasts is
  'One deterministic effective load per call: active override, current policy, source time, receipt time, intra-source sequence, UUID.';
comment on function public.create_manual_call_load_forecast(
  uuid, uuid, uuid, integer, integer, integer, integer, integer
) is 'Human command forcing tools-panel source and server-controlled metadata.';
comment on function public.ingest_ordered_call_load_forecast(
  uuid, uuid, uuid, text, text, bigint, timestamptz,
  integer, integer, integer, integer, integer
) is 'Service-only monotonic feed command rejecting replays and duplicates.';
comment on function public.create_manual_port_call(
  uuid, uuid, uuid, uuid, text, timestamptz, timestamptz
) is 'Human command creating an in-scope tools-panel port call with server metadata.';

create or replace function public.reconcile_expired_call_load_forecast_overrides(
  reconcile_batch_size integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  expired_override record;
  reconciled_count integer := 0;
  failed_count integer := 0;
  failed_ids uuid[] := '{}'::uuid[];
  remaining_count integer;
begin
  if reconcile_batch_size is null
    or reconcile_batch_size not between 1 and 1000 then
    raise exception 'reconcile_batch_size must be between 1 and 1000'
      using errcode = '22023';
  end if;

  for expired_override in
    select source_override.id, source_override.port_call_id
    from public.call_load_forecast_overrides source_override
    where source_override.resumed_at is null
      and source_override.valid_until <= clock_timestamp()
    order by source_override.valid_until, source_override.id
    for update skip locked
    limit reconcile_batch_size
  loop
    begin
      update public.call_load_forecast_overrides source_override
      set resumed_at = clock_timestamp(),
          resumed_reason = 'expired'
      where source_override.id = expired_override.id
        and source_override.resumed_at is null;

      if found then
        perform set_config('app.maritime_machine_feed', 'true', true);
        perform public.ensure_planning_workspace_for_port_call(
          expired_override.port_call_id
        );
        perform set_config('app.maritime_machine_feed', '', true);
        reconciled_count := reconciled_count + 1;
      end if;
    exception
      when others then
        perform set_config('app.maritime_machine_feed', '', true);
        failed_count := failed_count + 1;
        if cardinality(failed_ids) < 50 then
          failed_ids := array_append(failed_ids, expired_override.id);
        end if;
    end;
  end loop;

  select count(*)::integer
  into remaining_count
  from public.call_load_forecast_overrides source_override
  where source_override.resumed_at is null
    and source_override.valid_until <= clock_timestamp();

  return jsonb_build_object(
    'reconciledCount', reconciled_count,
    'failedCount', failed_count,
    'failedIds', to_jsonb(failed_ids),
    'remainingCount', remaining_count
  );
exception
  when others then
    perform set_config('app.maritime_machine_feed', '', true);
    raise;
end;
$$;

revoke all on function
  public.reconcile_expired_call_load_forecast_overrides(integer)
from public, anon, authenticated, service_role;
grant execute on function
  public.reconcile_expired_call_load_forecast_overrides(integer)
to service_role;

-- Publication snapshots must retain the forecast that actually drove the
-- requirement. Receipt time alone is not authoritative when a newer manual
-- event coexists with a higher-priority ordered feed event.
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
  reconciled_override_count integer := 0;
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

  update public.call_load_forecast_overrides source_override
  set resumed_at = clock_timestamp(),
      resumed_reason = 'expired-before-snapshot'
  where source_override.resumed_at is null
    and source_override.valid_until <= clock_timestamp()
    and exists (
      select 1
      from public.staffing_requirements requirement
      where requirement.planning_period_id = target_schedule.planning_period_id
        and requirement.port_call_id = source_override.port_call_id
        and requirement.retired_at is null
    );

  get diagnostics reconciled_override_count = row_count;
  if reconciled_override_count > 0 then
    perform public.generate_staffing_requirements(
      target_schedule.planning_period_id
    );
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
      'freightUnitsPerExtraAgent',
        profile_line.freight_units_per_extra_agent,
      'coachesPerExtraAgent', profile_line.coaches_per_extra_agent,
      'minimumAgents', profile_line.minimum_agents,
      'maximumAgents', profile_line.maximum_agents,
      'forecast', case
        when forecast.id is null then null
        else jsonb_build_object(
          'passengerCount', forecast.passenger_count,
          'vehicleCount', forecast.vehicle_count,
          'freightUnitCount', forecast.freight_unit_count,
          'coachCount', forecast.coach_count,
          'source', forecast.source,
          'sourceRevision', forecast.source_revision,
          'receivedAt', forecast.received_at
        )
      end
    ))
  from public.staffing_requirements requirement
  left join public.port_calls port_call
    on port_call.id = requirement.port_call_id
  left join public.demand_profile_lines profile_line
    on profile_line.id = requirement.demand_profile_line_id
  left join public.demand_profiles profile
    on profile.id = profile_line.demand_profile_id
  left join public.effective_call_load_forecasts forecast
    on forecast.port_call_id = requirement.port_call_id
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
from public, anon, authenticated, service_role;

-- Requirement generation must consume the same effective row as the UI and
-- export. A newer low-priority manual entry must never silently replace a
-- trusted feed event in staffing calculations.
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
  left join public.effective_call_load_forecasts load
    on load.port_call_id = port_call.id
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
