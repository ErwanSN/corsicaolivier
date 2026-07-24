create or replace function public.create_schedule_version(
  target_planning_period_id uuid,
  version_label text,
  version_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_period public.planning_periods;
  parent_version public.schedule_versions;
  created_version public.schedule_versions;
  next_version_number integer;
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

  if version_label is null or char_length(version_label) not between 2 and 120 then
    raise exception 'A valid version label is required';
  end if;

  select * into parent_version
  from public.schedule_versions
  where planning_period_id = target_period.id
    and status = 'published'
  order by version_number desc
  limit 1;

  select coalesce(max(version_number), 0) + 1 into next_version_number
  from public.schedule_versions
  where planning_period_id = target_period.id;

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
    parent_version.id,
    next_version_number,
    'draft',
    version_label,
    version_reason,
    (select auth.uid())
  )
  returning * into created_version;

  return jsonb_build_object(
    'id', created_version.id,
    'planningPeriodId', created_version.planning_period_id,
    'parentVersionId', created_version.parent_version_id,
    'versionNumber', created_version.version_number,
    'status', created_version.status,
    'label', created_version.label
  );
end;
$$;

create or replace function public.create_planning_shift(
  target_schedule_version_id uuid,
  target_agent_id uuid,
  shift_starts_at timestamptz,
  shift_ends_at timestamptz,
  shift_break_minutes integer,
  target_position_id uuid,
  target_port_call_id uuid default null,
  shift_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_schedule public.schedule_versions;
  target_period public.planning_periods;
  target_agent public.agents;
  target_position public.positions;
  created_shift public.planning_shifts;
  created_assignment public.shift_assignments;
begin
  select * into target_schedule
  from public.schedule_versions
  where id = target_schedule_version_id
  for update;

  if target_schedule.id is null then
    raise exception 'Schedule version not found';
  end if;

  if target_schedule.status <> 'draft' then
    raise exception 'Shifts can only be added to a draft schedule';
  end if;

  if not public.has_role(
    target_schedule.organization_id,
    target_schedule.site_id,
    array['platform_admin', 'planning_admin', 'planner']::public.app_role[]
  ) then
    raise exception 'Insufficient permissions';
  end if;

  if shift_ends_at <= shift_starts_at then
    raise exception 'Shift end must follow shift start';
  end if;

  if shift_break_minutes < 0
    or shift_break_minutes >= extract(epoch from (shift_ends_at - shift_starts_at)) / 60 then
    raise exception 'Invalid break duration';
  end if;

  select * into target_period
  from public.planning_periods
  where id = target_schedule.planning_period_id;

  if (shift_starts_at at time zone target_period.timezone)::date < target_period.starts_on
    or (shift_ends_at at time zone target_period.timezone)::date > target_period.ends_on then
    raise exception 'Shift is outside the planning period';
  end if;

  select * into target_agent
  from public.agents
  where id = target_agent_id
    and organization_id = target_schedule.organization_id
    and primary_site_id = target_schedule.site_id
    and active = true;

  if target_agent.id is null then
    raise exception 'Active agent not found in schedule scope';
  end if;

  select * into target_position
  from public.positions
  where id = target_position_id
    and organization_id = target_schedule.organization_id
    and (site_id is null or site_id = target_schedule.site_id)
    and active = true;

  if target_position.id is null then
    raise exception 'Active position not found in schedule scope';
  end if;

  if exists (
    select 1
    from public.agent_unavailability unavailable
    where unavailable.agent_id = target_agent.id
      and tstzrange(unavailable.starts_at, unavailable.ends_at, '[)')
        && tstzrange(shift_starts_at, shift_ends_at, '[)')
  ) then
    raise exception 'Agent is unavailable during this shift';
  end if;

  if exists (
    select 1
    from public.agent_position_restrictions restriction
    where restriction.agent_id = target_agent.id
      and restriction.position_id = target_position.id
      and restriction.valid_from <= (shift_starts_at at time zone target_period.timezone)::date
      and (
        restriction.valid_until is null
        or restriction.valid_until >= (shift_starts_at at time zone target_period.timezone)::date
      )
  ) then
    raise exception 'Agent is restricted from this position';
  end if;

  if exists (
    select 1
    from public.position_skill_requirements requirement
    where requirement.position_id = target_position.id
      and requirement.mandatory = true
      and not exists (
        select 1
        from public.agent_skills agent_skill
        where agent_skill.agent_id = target_agent.id
          and agent_skill.skill_id = requirement.skill_id
          and agent_skill.level >= requirement.minimum_level
          and agent_skill.valid_from <= (shift_starts_at at time zone target_period.timezone)::date
          and (
            agent_skill.valid_until is null
            or agent_skill.valid_until >= (shift_ends_at at time zone target_period.timezone)::date
          )
      )
  ) then
    raise exception 'Agent does not satisfy mandatory position skills';
  end if;

  if target_port_call_id is not null and not exists (
    select 1 from public.port_calls port_call
    where port_call.id = target_port_call_id
      and port_call.organization_id = target_schedule.organization_id
      and port_call.site_id = target_schedule.site_id
  ) then
    raise exception 'Port call not found in schedule scope';
  end if;

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
    created_by
  ) values (
    target_schedule.organization_id,
    target_schedule.site_id,
    target_schedule.id,
    target_agent.id,
    shift_starts_at,
    shift_ends_at,
    shift_break_minutes,
    'manual',
    shift_note,
    (select auth.uid())
  )
  returning * into created_shift;

  insert into public.shift_assignments (
    organization_id,
    site_id,
    planning_shift_id,
    position_id,
    port_call_id,
    starts_at,
    ends_at
  ) values (
    target_schedule.organization_id,
    target_schedule.site_id,
    created_shift.id,
    target_position.id,
    target_port_call_id,
    shift_starts_at,
    shift_ends_at
  )
  returning * into created_assignment;

  return jsonb_build_object(
    'shiftId', created_shift.id,
    'assignmentId', created_assignment.id,
    'scheduleVersionId', target_schedule.id,
    'agentId', target_agent.id,
    'positionId', target_position.id,
    'startsAt', created_shift.starts_at,
    'endsAt', created_shift.ends_at,
    'breakMinutes', created_shift.break_minutes
  );
end;
$$;

revoke all on function public.create_schedule_version(uuid, text, text) from public;
revoke all on function public.create_planning_shift(
  uuid,
  uuid,
  timestamptz,
  timestamptz,
  integer,
  uuid,
  uuid,
  text
) from public;

grant execute on function public.create_schedule_version(uuid, text, text) to authenticated;
grant execute on function public.create_planning_shift(
  uuid,
  uuid,
  timestamptz,
  timestamptz,
  integer,
  uuid,
  uuid,
  text
) to authenticated;
