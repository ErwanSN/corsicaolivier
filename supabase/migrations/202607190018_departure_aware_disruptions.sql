-- A maritime update can move arrival and departure by different amounts.
-- Every affected assignment therefore receives the delta of its own anchor.

alter table public.port_calls
  add constraint port_calls_effective_timing_order
  check (
    coalesce(estimated_arrival_at, scheduled_arrival_at) is null
    or coalesce(estimated_departure_at, scheduled_departure_at) is null
    or coalesce(estimated_departure_at, scheduled_departure_at)
      >= coalesce(estimated_arrival_at, scheduled_arrival_at)
  );

create unique index port_call_revisions_source_idempotency
  on public.port_call_revisions (port_call_id, source, source_revision)
  where source_revision is not null;

create unique index agent_groups_global_code
  on public.agent_groups (organization_id, code)
  where site_id is null;

create or replace function public.update_port_call_timing(
  target_port_call_id uuid,
  new_estimated_arrival_at timestamptz,
  new_estimated_departure_at timestamptz,
  new_status public.port_call_status,
  update_source text,
  update_source_revision text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_call public.port_calls;
  previous_arrival timestamptz;
  previous_departure timestamptz;
  effective_new_arrival timestamptz;
  effective_new_departure timestamptz;
  arrival_delta_minutes integer := 0;
  departure_delta_minutes integer := 0;
  primary_delta_minutes integer := 0;
  event_kind public.disruption_kind;
  disruption public.disruption_events;
  base_schedule public.schedule_versions;
  scenario public.replanning_scenarios;
  requirements_result jsonb;
  impact_count integer := 0;
  generated_requirement_count integer := 0;
begin
  select * into target_call
  from public.port_calls
  where id = target_port_call_id
  for update;

  if target_call.id is null then
    raise exception 'Port call not found';
  end if;

  if not public.has_role(
    target_call.organization_id,
    target_call.site_id,
    array['platform_admin', 'planning_admin', 'planner']::public.app_role[]
  ) then
    raise exception 'Insufficient permissions';
  end if;

  if update_source is null or char_length(update_source) not between 2 and 50 then
    raise exception 'A valid update source is required';
  end if;

  if update_source_revision is not null and exists (
    select 1
    from public.port_call_revisions revision
    where revision.port_call_id = target_call.id
      and revision.source = update_source
      and revision.source_revision = update_source_revision
  ) then
    return jsonb_build_object(
      'changed', false,
      'duplicateRevision', true,
      'portCallId', target_call.id,
      'impactCount', 0,
      'generatedRequirementCount', 0
    );
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

  if target_call.status = new_status
    and target_call.estimated_arrival_at is not distinct from new_estimated_arrival_at
    and target_call.estimated_departure_at is not distinct from new_estimated_departure_at then
    return jsonb_build_object(
      'changed', false,
      'portCallId', target_call.id,
      'impactCount', 0,
      'generatedRequirementCount', 0
    );
  end if;

  update public.port_calls
  set estimated_arrival_at = new_estimated_arrival_at,
      estimated_departure_at = new_estimated_departure_at,
      status = new_status,
      source = update_source,
      source_revision = update_source_revision,
      received_at = now(),
      updated_at = now()
  where id = target_call.id;

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

  select schedule.* into base_schedule
  from public.schedule_versions schedule
  join public.planning_periods period on period.id = schedule.planning_period_id
  where schedule.site_id = target_call.site_id
    and schedule.status = 'published'
    and (
      coalesce(effective_new_arrival, effective_new_departure) at time zone period.timezone
    )::date between period.starts_on and period.ends_on
  order by schedule.version_number desc
  limit 1;

  if base_schedule.id is not null and exists (
    select 1
    from public.shift_assignments assignment
    join public.planning_shifts shift on shift.id = assignment.planning_shift_id
    where assignment.port_call_id = target_call.id
      and shift.schedule_version_id = base_schedule.id
  ) then
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
        when abs(anchor_delta.delta_minutes) >= 60 then 'warning'::public.impact_severity
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
          else assignment.starts_at + make_interval(mins => anchor_delta.delta_minutes)
        end,
        'proposedEndsAt', case
          when event_kind = 'cancellation' then null
          else assignment.ends_at + make_interval(mins => anchor_delta.delta_minutes)
        end,
        'arrivalDeltaMinutes', arrival_delta_minutes,
        'departureDeltaMinutes', departure_delta_minutes,
        'deltaMinutes', anchor_delta.delta_minutes
      )
    from public.shift_assignments assignment
    join public.planning_shifts shift on shift.id = assignment.planning_shift_id
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

    get diagnostics impact_count = row_count;
  end if;

  if base_schedule.id is not null then
    requirements_result := public.generate_staffing_requirements(
      base_schedule.planning_period_id
    );
    generated_requirement_count := coalesce(
      (requirements_result ->> 'generatedCount')::integer,
      0
    );
  end if;

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
      'scenarioId', scenario.id,
      'kind', event_kind,
      'deltaMinutes', primary_delta_minutes,
      'arrivalDeltaMinutes', arrival_delta_minutes,
      'departureDeltaMinutes', departure_delta_minutes,
      'impactCount', impact_count,
      'generatedRequirementCount', generated_requirement_count
    ),
    'port-call-disruption-' || disruption.id::text
  );

  return jsonb_build_object(
    'changed', true,
    'portCallId', target_call.id,
    'disruptionEventId', disruption.id,
    'scenarioId', scenario.id,
    'kind', event_kind,
    'deltaMinutes', primary_delta_minutes,
    'arrivalDeltaMinutes', arrival_delta_minutes,
    'departureDeltaMinutes', departure_delta_minutes,
    'impactCount', impact_count,
    'generatedRequirementCount', generated_requirement_count
  );
end;
$$;

revoke all on function public.update_port_call_timing(
  uuid,
  timestamptz,
  timestamptz,
  public.port_call_status,
  text,
  text
) from public;

grant execute on function public.update_port_call_timing(
  uuid,
  timestamptz,
  timestamptz,
  public.port_call_status,
  text,
  text
) to authenticated;
