alter table public.planning_shifts
  add column source_shift_id uuid references public.planning_shifts(id) on delete set null;

alter table public.planning_shifts
  add constraint planning_shifts_source_same_organization
    foreign key (source_shift_id, organization_id)
    references public.planning_shifts (id, organization_id);

create index planning_shifts_source on public.planning_shifts (source_shift_id)
  where source_shift_id is not null;

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
  base_schedule public.schedule_versions;
  candidate_schedule public.schedule_versions;
  next_version_number integer;
  cloned_shift_count integer := 0;
  cloned_assignment_count integer := 0;
begin
  select * into target_scenario
  from public.replanning_scenarios
  where id = target_scenario_id
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

  if approval_reason is null or char_length(approval_reason) not between 3 and 500 then
    raise exception 'A valid approval reason is required';
  end if;

  select * into base_schedule
  from public.schedule_versions
  where id = target_scenario.base_schedule_version_id
  for update;

  if base_schedule.id is null or base_schedule.status <> 'published' then
    raise exception 'The base schedule must still be published';
  end if;

  perform 1
  from public.planning_periods
  where id = base_schedule.planning_period_id
  for update;

  select coalesce(max(version_number), 0) + 1 into next_version_number
  from public.schedule_versions
  where planning_period_id = base_schedule.planning_period_id;

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
    source_shift.starts_at + make_interval(mins => coalesce(impact_delta.delta_minutes, 0)),
    source_shift.ends_at + make_interval(mins => coalesce(impact_delta.delta_minutes, 0)),
    source_shift.break_minutes,
    'replanned',
    source_shift.note,
    (select auth.uid()),
    source_shift.id
  from public.planning_shifts source_shift
  left join lateral (
    select max((impact.details ->> 'deltaMinutes')::integer) as delta_minutes
    from public.replanning_impacts impact
    where impact.scenario_id = target_scenario.id
      and impact.planning_shift_id = source_shift.id
      and impact.impact_type = 'assignment.time_shift'
  ) impact_delta on true
  where source_shift.schedule_version_id = base_schedule.id;

  get diagnostics cloned_shift_count = row_count;

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
    source_assignment.starts_at + make_interval(mins => shift_delta.delta_minutes),
    source_assignment.ends_at + make_interval(mins => shift_delta.delta_minutes)
  from public.shift_assignments source_assignment
  join public.planning_shifts source_shift on source_shift.id = source_assignment.planning_shift_id
  join public.planning_shifts candidate_shift
    on candidate_shift.source_shift_id = source_shift.id
    and candidate_shift.schedule_version_id = candidate_schedule.id
  cross join lateral (
    select coalesce(max((impact.details ->> 'deltaMinutes')::integer), 0) as delta_minutes
    from public.replanning_impacts impact
    where impact.scenario_id = target_scenario.id
      and impact.planning_shift_id = source_shift.id
      and impact.impact_type = 'assignment.time_shift'
  ) shift_delta
  where source_shift.schedule_version_id = base_schedule.id
    and not exists (
      select 1
      from public.replanning_impacts cancellation
      where cancellation.scenario_id = target_scenario.id
        and cancellation.impact_type = 'assignment.cancellation'
        and cancellation.details ->> 'shiftAssignmentId' = source_assignment.id::text
    );

  get diagnostics cloned_assignment_count = row_count;

  delete from public.planning_shifts candidate_shift
  where candidate_shift.schedule_version_id = candidate_schedule.id
    and not exists (
      select 1
      from public.shift_assignments assignment
      where assignment.planning_shift_id = candidate_shift.id
    );

  update public.replanning_scenarios
  set status = 'approved',
      candidate_schedule_version_id = candidate_schedule.id,
      summary = concat_ws(E'\n', summary, approval_reason),
      approved_by = (select auth.uid()),
      approved_at = now(),
      updated_at = now()
  where id = target_scenario.id;

  insert into public.outbox_events (
    organization_id,
    site_id,
    topic,
    aggregate_type,
    aggregate_id,
    payload,
    idempotency_key
  ) values (
    target_scenario.organization_id,
    target_scenario.site_id,
    'planning.replanning.approved',
    'replanning_scenario',
    target_scenario.id,
    jsonb_build_object(
      'scenarioId', target_scenario.id,
      'candidateScheduleVersionId', candidate_schedule.id,
      'clonedShiftCount', cloned_shift_count,
      'clonedAssignmentCount', cloned_assignment_count
    ),
    'replanning-approved-' || target_scenario.id::text
  );

  return jsonb_build_object(
    'scenarioId', target_scenario.id,
    'candidateScheduleVersionId', candidate_schedule.id,
    'clonedShiftCount', cloned_shift_count,
    'clonedAssignmentCount', cloned_assignment_count
  );
end;
$$;

revoke all on function public.approve_replanning_scenario(uuid, text) from public;
grant execute on function public.approve_replanning_scenario(uuid, text) to authenticated;
