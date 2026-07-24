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
  delta_minutes integer := 0;
  event_kind public.disruption_kind;
  disruption public.disruption_events;
  base_schedule public.schedule_versions;
  scenario public.replanning_scenarios;
  impact_count integer := 0;
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

  if new_status = 'cancelled' then
    event_kind := 'cancellation';
  elsif previous_arrival is not null and effective_new_arrival is not null then
    delta_minutes := round(
      extract(epoch from (effective_new_arrival - previous_arrival)) / 60
    );
    event_kind := case
      when delta_minutes > 0 then 'delay'::public.disruption_kind
      when delta_minutes < 0 then 'advance'::public.disruption_kind
      else 'time_correction'::public.disruption_kind
    end;
  elsif previous_departure is not null and effective_new_departure is not null then
    delta_minutes := round(
      extract(epoch from (effective_new_departure - previous_departure)) / 60
    );
    event_kind := case
      when delta_minutes > 0 then 'delay'::public.disruption_kind
      when delta_minutes < 0 then 'advance'::public.disruption_kind
      else 'time_correction'::public.disruption_kind
    end;
  else
    event_kind := 'time_correction';
  end if;

  if target_call.status = new_status
    and target_call.estimated_arrival_at is not distinct from new_estimated_arrival_at
    and target_call.estimated_departure_at is not distinct from new_estimated_departure_at then
    return jsonb_build_object(
      'changed', false,
      'portCallId', target_call.id,
      'impactCount', 0
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
        when event_kind = 'cancellation' then 'Les affectations liées doivent être annulées ou réattribuées.'
        else format('Décalage opérationnel calculé : %s minutes.', delta_minutes)
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
        when abs(delta_minutes) >= 60 then 'warning'::public.impact_severity
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
        'previousStartsAt', assignment.starts_at,
        'previousEndsAt', assignment.ends_at,
        'proposedStartsAt', case
          when event_kind = 'cancellation' then null
          else assignment.starts_at + make_interval(mins => delta_minutes)
        end,
        'proposedEndsAt', case
          when event_kind = 'cancellation' then null
          else assignment.ends_at + make_interval(mins => delta_minutes)
        end,
        'deltaMinutes', delta_minutes
      )
    from public.shift_assignments assignment
    join public.planning_shifts shift on shift.id = assignment.planning_shift_id
    where assignment.port_call_id = target_call.id
      and shift.schedule_version_id = base_schedule.id;

    get diagnostics impact_count = row_count;
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
      'deltaMinutes', delta_minutes,
      'impactCount', impact_count
    ),
    'port-call-disruption-' || disruption.id::text
  );

  return jsonb_build_object(
    'changed', true,
    'portCallId', target_call.id,
    'disruptionEventId', disruption.id,
    'scenarioId', scenario.id,
    'kind', event_kind,
    'deltaMinutes', delta_minutes,
    'impactCount', impact_count
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
