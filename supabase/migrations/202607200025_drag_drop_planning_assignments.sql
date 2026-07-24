create or replace function public.move_planning_assignment(
  target_schedule_version_id uuid,
  target_assignment_id uuid,
  target_work_date date,
  target_position_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_assignment public.shift_assignments;
  target_shift public.planning_shifts;
  target_schedule public.schedule_versions;
  target_period public.planning_periods;
  target_position public.positions;
  target_requirement public.staffing_requirements;
  assignment_count integer;
  moved_starts_at timestamptz;
  moved_ends_at timestamptz;
begin
  select assignment.* into target_assignment
  from public.shift_assignments assignment
  where assignment.id = target_assignment_id
  for update;

  if target_assignment.id is null then
    raise exception using
      errcode = 'P2010',
      message = 'Affectation introuvable.';
  end if;

  select shift.* into target_shift
  from public.planning_shifts shift
  where shift.id = target_assignment.planning_shift_id
  for update;

  select schedule.* into target_schedule
  from public.schedule_versions schedule
  where schedule.id = target_schedule_version_id
    and schedule.id = target_shift.schedule_version_id
  for update;

  if target_schedule.id is null then
    raise exception using
      errcode = 'P2010',
      message = 'Planning de cette affectation introuvable.';
  end if;

  if not public.has_role(
    target_schedule.organization_id,
    target_schedule.site_id,
    array['platform_admin', 'planning_admin', 'planner']::public.app_role[]
  ) then
    raise exception 'Insufficient permissions';
  end if;

  if target_schedule.status <> 'draft' then
    raise exception using
      errcode = 'P2011',
      message = 'Seul un brouillon peut être réorganisé.';
  end if;

  select count(*) into assignment_count
  from public.shift_assignments assignment
  where assignment.planning_shift_id = target_shift.id;

  if assignment_count <> 1 then
    raise exception using
      errcode = 'P2016',
      message = 'Cette affectation multiple doit être modifiée depuis son détail.';
  end if;

  select period.* into target_period
  from public.planning_periods period
  where period.id = target_schedule.planning_period_id;

  if target_work_date not between target_period.starts_on and target_period.ends_on then
    raise exception using
      errcode = 'P2012',
      message = 'La case cible se trouve hors de cette semaine.';
  end if;

  select position.* into target_position
  from public.positions position
  where position.id = target_position_id
    and position.organization_id = target_schedule.organization_id
    and (position.site_id is null or position.site_id = target_schedule.site_id)
    and position.active = true;

  if target_position.id is null then
    raise exception using
      errcode = 'P2012',
      message = 'Le poste cible n’est pas disponible dans cette zone.';
  end if;

  moved_starts_at := (
    target_work_date
      + (target_shift.starts_at at time zone target_period.timezone)::time
  ) at time zone target_period.timezone;
  moved_ends_at := moved_starts_at + (target_shift.ends_at - target_shift.starts_at);

  if (moved_ends_at at time zone target_period.timezone)::date > target_period.ends_on then
    raise exception using
      errcode = 'P2012',
      message = 'La fin de cette affectation dépasserait la semaine.';
  end if;

  if exists (
    select 1
    from public.agent_unavailability unavailable
    where unavailable.agent_id = target_shift.agent_id
      and tstzrange(unavailable.starts_at, unavailable.ends_at, '[)')
        && tstzrange(moved_starts_at, moved_ends_at, '[)')
  ) then
    raise exception using
      errcode = 'P2013',
      message = 'L’agent est indisponible dans cette case.';
  end if;

  if exists (
    select 1
    from public.agent_position_restrictions restriction
    where restriction.agent_id = target_shift.agent_id
      and restriction.position_id = target_position.id
      and restriction.valid_from <= target_work_date
      and (
        restriction.valid_until is null
        or restriction.valid_until >= target_work_date
      )
  ) then
    raise exception using
      errcode = 'P2014',
      message = 'Ce poste est interdit pour cet agent.';
  end if;

  if exists (
    select 1
    from public.position_skill_requirements requirement
    where requirement.position_id = target_position.id
      and requirement.mandatory = true
      and not exists (
        select 1
        from public.agent_skills agent_skill
        where agent_skill.agent_id = target_shift.agent_id
          and agent_skill.skill_id = requirement.skill_id
          and agent_skill.level >= requirement.minimum_level
          and agent_skill.valid_from <= target_work_date
          and (
            agent_skill.valid_until is null
            or agent_skill.valid_until
              >= (moved_ends_at at time zone target_period.timezone)::date
          )
      )
  ) then
    raise exception using
      errcode = 'P2015',
      message = 'L’agent ne possède pas les habilitations requises pour ce poste.';
  end if;

  select requirement.* into target_requirement
  from public.staffing_requirements requirement
  where requirement.planning_period_id = target_period.id
    and requirement.position_id = target_position.id
    and (requirement.starts_at at time zone target_period.timezone)::date
      = target_work_date
    and tstzrange(requirement.starts_at, requirement.ends_at, '[)')
      && tstzrange(moved_starts_at, moved_ends_at, '[)')
  order by
    abs(extract(epoch from requirement.starts_at - moved_starts_at)),
    requirement.starts_at
  limit 1;

  update public.planning_shifts shift
  set starts_at = moved_starts_at,
      ends_at = moved_ends_at,
      updated_at = now()
  where shift.id = target_shift.id;

  update public.shift_assignments assignment
  set position_id = target_position.id,
      staffing_requirement_id = target_requirement.id,
      port_call_id = target_requirement.port_call_id,
      starts_at = moved_starts_at,
      ends_at = moved_ends_at,
      updated_at = now()
  where assignment.id = target_assignment.id;

  insert into public.outbox_events (
    organization_id,
    site_id,
    topic,
    aggregate_type,
    aggregate_id,
    payload,
    idempotency_key
  ) values (
    target_schedule.organization_id,
    target_schedule.site_id,
    'planning.assignment.moved',
    'shift_assignment',
    target_assignment.id,
    jsonb_build_object(
      'assignmentId', target_assignment.id,
      'shiftId', target_shift.id,
      'previousDate',
        (target_shift.starts_at at time zone target_period.timezone)::date,
      'targetDate', target_work_date,
      'previousPositionId', target_assignment.position_id,
      'targetPositionId', target_position.id,
      'movedBy', (select auth.uid())
    ),
    'assignment-moved-'
      || target_assignment.id::text
      || '-'
      || extensions.gen_random_uuid()::text
  );

  return jsonb_build_object(
    'assignmentId', target_assignment.id,
    'shiftId', target_shift.id,
    'scheduleVersionId', target_schedule.id,
    'positionId', target_position.id,
    'workDate', target_work_date,
    'startsAt', moved_starts_at,
    'endsAt', moved_ends_at,
    'staffingRequirementId', target_requirement.id,
    'portCallId', target_requirement.port_call_id
  );
end;
$$;

revoke all on function public.move_planning_assignment(uuid, uuid, date, uuid)
from public;

grant execute on function public.move_planning_assignment(uuid, uuid, date, uuid)
to authenticated;

comment on function public.move_planning_assignment(uuid, uuid, date, uuid) is
  'Atomically moves a single draft assignment to another day and position while rechecking planning constraints.';
