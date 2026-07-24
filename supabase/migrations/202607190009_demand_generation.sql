alter table public.port_calls
  add column demand_profile_id uuid references public.demand_profiles(id) on delete set null;

alter table public.port_calls
  add constraint port_calls_demand_profile_same_organization
    foreign key (demand_profile_id, organization_id)
    references public.demand_profiles (id, organization_id);

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
begin
  select * into target_period
  from public.planning_periods
  where id = target_planning_period_id
  for update;

  if target_period.id is null then
    raise exception 'Planning period not found';
  end if;

  if not public.has_role(
    target_period.organization_id,
    target_period.site_id,
    array['platform_admin', 'planning_admin', 'planner']::public.app_role[]
  ) then
    raise exception 'Insufficient permissions';
  end if;

  delete from public.staffing_requirements requirement
  where requirement.planning_period_id = target_period.id
    and requirement.demand_profile_line_id is not null;

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
    source_revision
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
      + make_interval(mins => profile_line.starts_offset_minutes + profile_line.duration_minutes),
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
        )
      )
    ),
    concat_ws(':', port_call.source_revision, load.source_revision, profile.version)
  from public.port_calls port_call
  join public.demand_profiles profile on profile.id = port_call.demand_profile_id
  join public.demand_profile_lines profile_line on profile_line.demand_profile_id = profile.id
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
    order by forecast.received_at desc
    limit 1
  ) load on true
  where port_call.site_id = target_period.site_id
    and port_call.status <> 'cancelled'
    and profile.active = true
    and anchor.anchor_at is not null
    and (anchor.anchor_at at time zone target_period.timezone)::date
      between target_period.starts_on and target_period.ends_on;

  get diagnostics generated_count = row_count;

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
      'generatedAt', now()
    ),
    'requirements-' || target_period.id::text || '-' || extract(epoch from clock_timestamp())::bigint::text
  );

  return jsonb_build_object(
    'planningPeriodId', target_period.id,
    'generatedCount', generated_count
  );
end;
$$;

revoke all on function public.generate_staffing_requirements(uuid) from public;
grant execute on function public.generate_staffing_requirements(uuid) to authenticated;
