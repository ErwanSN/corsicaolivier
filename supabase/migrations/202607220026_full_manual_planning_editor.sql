-- Manual planning edits are exposed as transactional commands. The database
-- remains the authority for scope, draft state, skills and working-time rules.

create or replace function public.update_planning_assignment(
  target_schedule_version_id uuid,
  target_assignment_id uuid,
  target_agent_id uuid,
  target_position_id uuid,
  target_port_call_id uuid,
  shift_starts_at timestamptz,
  shift_ends_at timestamptz,
  shift_break_minutes integer,
  shift_note text
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
  target_agent public.agents;
  target_position public.positions;
  target_port_call public.port_calls;
  target_requirement public.staffing_requirements;
  assignment_count integer;
begin
  select assignment.* into target_assignment
  from public.shift_assignments assignment
  where assignment.id = target_assignment_id
  for update;

  if target_assignment.id is null then
    raise exception using errcode = 'P2020', message = 'Affectation introuvable.';
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
    raise exception using errcode = 'P2020', message = 'Planning de cette affectation introuvable.';
  end if;

  if not public.has_role(
    target_schedule.organization_id,
    target_schedule.site_id,
    array['platform_admin', 'planning_admin', 'planner']::public.app_role[]
  ) then
    raise exception 'Insufficient permissions';
  end if;

  if target_schedule.status <> 'draft' then
    raise exception using errcode = 'P2021', message = 'Seul un brouillon peut être modifié.';
  end if;

  select count(*) into assignment_count
  from public.shift_assignments assignment
  where assignment.planning_shift_id = target_shift.id;

  if assignment_count <> 1 then
    raise exception using
      errcode = 'P2022',
      message = 'Cette affectation comporte plusieurs postes et doit être traitée séparément.';
  end if;

  if shift_ends_at <= shift_starts_at then
    raise exception using errcode = 'P2023', message = 'L’heure de fin doit suivre l’heure de début.';
  end if;

  if shift_break_minutes < 0
    or shift_break_minutes >= extract(epoch from (shift_ends_at - shift_starts_at)) / 60 then
    raise exception using errcode = 'P2023', message = 'La pause doit être plus courte que le service.';
  end if;

  if shift_note is not null and char_length(shift_note) > 500 then
    raise exception using errcode = 'P2023', message = 'La note est limitée à 500 caractères.';
  end if;

  select period.* into target_period
  from public.planning_periods period
  where period.id = target_schedule.planning_period_id;

  if (shift_starts_at at time zone target_period.timezone)::date < target_period.starts_on
    or (shift_ends_at at time zone target_period.timezone)::date > target_period.ends_on then
    raise exception using errcode = 'P2023', message = 'Le service doit rester dans cette semaine.';
  end if;

  select agent.* into target_agent
  from public.agents agent
  where agent.id = target_agent_id
    and agent.organization_id = target_schedule.organization_id
    and agent.primary_site_id = target_schedule.site_id
    and agent.active = true;

  if target_agent.id is null then
    raise exception using errcode = 'P2024', message = 'Cet agent actif n’appartient pas à cette zone.';
  end if;

  select position.* into target_position
  from public.positions position
  where position.id = target_position_id
    and position.organization_id = target_schedule.organization_id
    and (position.site_id is null or position.site_id = target_schedule.site_id)
    and position.active = true;

  if target_position.id is null then
    raise exception using errcode = 'P2024', message = 'Ce poste n’est pas disponible dans cette zone.';
  end if;

  if target_port_call_id is not null then
    select port_call.* into target_port_call
    from public.port_calls port_call
    where port_call.id = target_port_call_id
      and port_call.organization_id = target_schedule.organization_id
      and port_call.site_id = target_schedule.site_id;

    if target_port_call.id is null then
      raise exception using errcode = 'P2024', message = 'Cette escale n’appartient pas à la zone.';
    end if;
  end if;

  if exists (
    select 1
    from public.agent_unavailability unavailable
    where unavailable.agent_id = target_agent.id
      and tstzrange(unavailable.starts_at, unavailable.ends_at, '[)')
        && tstzrange(shift_starts_at, shift_ends_at, '[)')
  ) then
    raise exception using errcode = 'P2025', message = 'L’agent est indisponible pendant ce service.';
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
    raise exception using errcode = 'P2026', message = 'Ce poste est interdit pour cet agent.';
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
    raise exception using
      errcode = 'P2027',
      message = 'L’agent ne possède pas les habilitations requises pour ce poste.';
  end if;

  select requirement.* into target_requirement
  from public.staffing_requirements requirement
  where requirement.planning_period_id = target_period.id
    and requirement.position_id = target_position.id
    and requirement.port_call_id is not distinct from target_port_call_id
    and tstzrange(requirement.starts_at, requirement.ends_at, '[)')
      && tstzrange(shift_starts_at, shift_ends_at, '[)')
  order by
    abs(extract(epoch from requirement.starts_at - shift_starts_at)),
    requirement.starts_at
  limit 1;

  update public.planning_shifts shift
  set agent_id = target_agent.id,
      starts_at = shift_starts_at,
      ends_at = shift_ends_at,
      break_minutes = shift_break_minutes,
      origin = 'manual',
      note = nullif(trim(shift_note), ''),
      updated_at = now()
  where shift.id = target_shift.id;

  update public.shift_assignments assignment
  set position_id = target_position.id,
      staffing_requirement_id = target_requirement.id,
      port_call_id = target_port_call_id,
      starts_at = shift_starts_at,
      ends_at = shift_ends_at,
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
    'planning.assignment.updated',
    'shift_assignment',
    target_assignment.id,
    jsonb_build_object(
      'assignmentId', target_assignment.id,
      'shiftId', target_shift.id,
      'updatedBy', (select auth.uid()),
      'before', jsonb_build_object(
        'agentId', target_shift.agent_id,
        'positionId', target_assignment.position_id,
        'portCallId', target_assignment.port_call_id,
        'startsAt', target_shift.starts_at,
        'endsAt', target_shift.ends_at,
        'breakMinutes', target_shift.break_minutes,
        'note', target_shift.note
      ),
      'after', jsonb_build_object(
        'agentId', target_agent.id,
        'positionId', target_position.id,
        'portCallId', target_port_call_id,
        'startsAt', shift_starts_at,
        'endsAt', shift_ends_at,
        'breakMinutes', shift_break_minutes,
        'note', nullif(trim(shift_note), '')
      )
    ),
    'assignment-updated-' || target_assignment.id::text || '-' || extensions.gen_random_uuid()::text
  );

  return jsonb_build_object(
    'assignmentId', target_assignment.id,
    'shiftId', target_shift.id,
    'scheduleVersionId', target_schedule.id,
    'agentId', target_agent.id,
    'positionId', target_position.id,
    'portCallId', target_port_call_id,
    'staffingRequirementId', target_requirement.id,
    'startsAt', shift_starts_at,
    'endsAt', shift_ends_at,
    'breakMinutes', shift_break_minutes,
    'note', nullif(trim(shift_note), '')
  );
end;
$$;

create or replace function public.delete_planning_assignment(
  target_schedule_version_id uuid,
  target_assignment_id uuid
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
  assignment_count integer;
begin
  select assignment.* into target_assignment
  from public.shift_assignments assignment
  where assignment.id = target_assignment_id
  for update;

  if target_assignment.id is null then
    raise exception using errcode = 'P2020', message = 'Affectation introuvable.';
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
    raise exception using errcode = 'P2020', message = 'Planning de cette affectation introuvable.';
  end if;

  if not public.has_role(
    target_schedule.organization_id,
    target_schedule.site_id,
    array['platform_admin', 'planning_admin', 'planner']::public.app_role[]
  ) then
    raise exception 'Insufficient permissions';
  end if;

  if target_schedule.status <> 'draft' then
    raise exception using errcode = 'P2021', message = 'Seul un brouillon peut être modifié.';
  end if;

  select count(*) into assignment_count
  from public.shift_assignments assignment
  where assignment.planning_shift_id = target_shift.id;

  if assignment_count <> 1 then
    raise exception using
      errcode = 'P2022',
      message = 'Cette affectation comporte plusieurs postes et ne peut pas être supprimée ici.';
  end if;

  if exists (
    select 1
    from public.time_ledger_entries ledger
    where ledger.planning_shift_id = target_shift.id
      and ledger.worked_minutes is not null
  ) then
    raise exception using
      errcode = 'P2028',
      message = 'Cette affectation contient déjà des heures réalisées et ne peut plus être supprimée.';
  end if;

  update public.time_ledger_entries ledger
  set planning_shift_id = null,
      planned_minutes = 0,
      updated_at = now()
  where ledger.planning_shift_id = target_shift.id;

  delete from public.planning_shifts shift
  where shift.id = target_shift.id;

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
    'planning.assignment.deleted',
    'shift_assignment',
    target_assignment.id,
    jsonb_build_object(
      'assignmentId', target_assignment.id,
      'shiftId', target_shift.id,
      'agentId', target_shift.agent_id,
      'positionId', target_assignment.position_id,
      'startsAt', target_shift.starts_at,
      'endsAt', target_shift.ends_at,
      'deletedBy', (select auth.uid())
    ),
    'assignment-deleted-' || target_assignment.id::text || '-' || extensions.gen_random_uuid()::text
  );

  return jsonb_build_object(
    'assignmentId', target_assignment.id,
    'shiftId', target_shift.id,
    'scheduleVersionId', target_schedule.id,
    'deleted', true
  );
end;
$$;

revoke all on function public.update_planning_assignment(
  uuid, uuid, uuid, uuid, uuid, timestamptz, timestamptz, integer, text
) from public;
revoke all on function public.delete_planning_assignment(uuid, uuid) from public;

grant execute on function public.update_planning_assignment(
  uuid, uuid, uuid, uuid, uuid, timestamptz, timestamptz, integer, text
) to authenticated;
grant execute on function public.delete_planning_assignment(uuid, uuid) to authenticated;

comment on function public.update_planning_assignment(
  uuid, uuid, uuid, uuid, uuid, timestamptz, timestamptz, integer, text
) is 'Atomically updates all manually editable fields of a single draft planning assignment.';
comment on function public.delete_planning_assignment(uuid, uuid) is
  'Atomically deletes a single draft planning assignment while preserving completed time records.';
