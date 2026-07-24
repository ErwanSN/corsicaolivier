-- Extend the operational demo from 20 July through 19 August 2026.
-- Port-call triggers create one automatic weekly planning workspace and its
-- staffing requirements as soon as the first call of each week is inserted.

do $$
#variable_conflict use_variable
declare
  organization_id constant uuid := '00000000-0000-4000-8000-000000000001';
  joliette_site_id constant uuid := '00000000-0000-4000-8000-000000000101';
  actor_id uuid;
  profile_id uuid;
  generated_call_count integer;
  generated_week_count integer;
begin
  select app_user.id into actor_id
  from public.app_users app_user
  where lower(app_user.email) = 'otourre@corsicalinea.com'
    and app_user.status = 'active'
  order by app_user.created_at
  limit 1;

  if actor_id is null then
    raise exception 'The Olivier demo owner account is required before generating the monthly planning';
  end if;

  select profile.id into profile_id
  from public.demand_profiles profile
  where profile.site_id = joliette_site_id
    and profile.code = 'DEMO-CA-HAUTE-CHARGE'
    and profile.active = true
  order by profile.version desc
  limit 1;

  if profile_id is null then
    raise exception 'The demo demand profile is required before generating the monthly planning';
  end if;

  if not exists (
    select 1
    from public.vessels vessel
    where vessel.organization_id = organization_id
      and vessel.active = true
  ) then
    raise exception 'At least one active vessel is required before generating the monthly planning';
  end if;

  perform set_config('request.jwt.claim.sub', actor_id::text, true);

  with fleet as (
    select
      vessel.id,
      row_number() over (order by vessel.name, vessel.id) as fleet_position,
      count(*) over () as fleet_size
    from public.vessels vessel
    where vessel.organization_id = organization_id
      and vessel.active = true
  ),
  service_days as (
    select generated_day::date as service_date
    from generate_series(
      date '2026-07-27',
      date '2026-08-19',
      interval '1 day'
    ) generated_day
  ),
  rotation_slots as (
    select
      service_day.service_date,
      'AM'::text as slot_code,
      time '06:15'
        + make_interval(
            mins => mod(extract(doy from service_day.service_date)::integer, 4) * 15
          ) as arrival_time,
      interval '1 hour 45 minutes' as port_duration
    from service_days service_day

    union all

    select
      service_day.service_date,
      'PM'::text as slot_code,
      time '17:15'
        + make_interval(
            mins => mod(extract(doy from service_day.service_date)::integer, 3) * 15
          ) as arrival_time,
      interval '2 hours 15 minutes' as port_duration
    from service_days service_day
    where extract(isodow from service_day.service_date)::integer in (2, 4, 6)
  ),
  numbered_slots as (
    select
      rotation.*,
      row_number() over (
        order by rotation.service_date, rotation.slot_code
      ) as rotation_number
    from rotation_slots rotation
  ),
  generated_calls as (
    select
      slot.service_date,
      slot.slot_code,
      fleet.id as vessel_id,
      'DEMO-MONTH-'
        || to_char(slot.service_date, 'YYYYMMDD')
        || '-'
        || slot.slot_code as external_reference,
      (
        slot.service_date + slot.arrival_time
      ) at time zone 'Europe/Paris' as scheduled_arrival_at,
      (
        slot.service_date + slot.arrival_time + slot.port_duration
      ) at time zone 'Europe/Paris' as scheduled_departure_at
    from numbered_slots slot
    join fleet
      on fleet.fleet_position = 1 + mod(slot.rotation_number - 1, fleet.fleet_size)
  )
  insert into public.port_calls (
    organization_id,
    site_id,
    vessel_id,
    external_reference,
    status,
    scheduled_arrival_at,
    scheduled_departure_at,
    estimated_arrival_at,
    estimated_departure_at,
    source,
    source_revision,
    demand_profile_id
  )
  select
    organization_id,
    joliette_site_id,
    generated.vessel_id,
    generated.external_reference,
    case
      when extract(day from generated.service_date)::integer % 5 = 0
        then 'delayed'::public.port_call_status
      else 'scheduled'::public.port_call_status
    end,
    generated.scheduled_arrival_at,
    generated.scheduled_departure_at,
    case
      when extract(day from generated.service_date)::integer % 5 = 0
        then generated.scheduled_arrival_at + interval '35 minutes'
      else null
    end,
    case
      when extract(day from generated.service_date)::integer % 5 = 0
        then generated.scheduled_departure_at + interval '35 minutes'
      else null
    end,
    'demo-month-generator',
    'demo-month-' || generated.external_reference,
    profile_id
  from generated_calls generated
  on conflict (site_id, external_reference) do update
  set vessel_id = excluded.vessel_id,
      status = excluded.status,
      scheduled_arrival_at = excluded.scheduled_arrival_at,
      scheduled_departure_at = excluded.scheduled_departure_at,
      estimated_arrival_at = excluded.estimated_arrival_at,
      estimated_departure_at = excluded.estimated_departure_at,
      source = excluded.source,
      source_revision = excluded.source_revision,
      demand_profile_id = excluded.demand_profile_id,
      updated_at = now();

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
    received_at
  )
  select
    organization_id,
    joliette_site_id,
    call.id,
    260 + mod(abs(hashtextextended(call.external_reference, 0)), 360)::integer,
    35 + mod(abs(hashtextextended(call.external_reference, 1)), 120)::integer,
    110 + mod(abs(hashtextextended(call.external_reference, 2)), 330)::integer,
    8 + mod(abs(hashtextextended(call.external_reference, 3)), 72)::integer,
    mod(abs(hashtextextended(call.external_reference, 4)), 6)::integer,
    'demo-month-generator',
    'load-' || call.external_reference,
    '2026-07-20 10:00:00+02'::timestamptz
  from public.port_calls call
  where call.site_id = joliette_site_id
    and call.external_reference like 'DEMO-MONTH-%'
    and (call.scheduled_arrival_at at time zone 'Europe/Paris')::date
      between date '2026-07-27' and date '2026-08-19'
  on conflict (port_call_id, source, received_at) do update
  set passenger_count = excluded.passenger_count,
      passenger_quota = excluded.passenger_quota,
      vehicle_count = excluded.vehicle_count,
      freight_unit_count = excluded.freight_unit_count,
      coach_count = excluded.coach_count,
      source_revision = excluded.source_revision;

  select count(*) into generated_call_count
  from public.port_calls call
  where call.site_id = joliette_site_id
    and call.external_reference like 'DEMO-MONTH-%'
    and (call.scheduled_arrival_at at time zone 'Europe/Paris')::date
      between date '2026-07-27' and date '2026-08-19';

  select count(*) into generated_week_count
  from public.planning_periods period
  where period.site_id = joliette_site_id
    and period.starts_on in (
      date '2026-07-27',
      date '2026-08-03',
      date '2026-08-10',
      date '2026-08-17'
    )
    and exists (
      select 1
      from public.schedule_versions version
      where version.planning_period_id = period.id
    );

  if generated_call_count <> 34 then
    raise exception 'The monthly planning must contain exactly 34 generated port calls after the corpus week';
  end if;

  if generated_week_count <> 4 then
    raise exception 'The monthly planning must create four additional automatic weekly workspaces';
  end if;
end;
$$;

comment on table public.planning_periods is
  'Weekly planning workspaces, automatically provisioned from port calls; the demo covers 20 July through 19 August 2026.';
