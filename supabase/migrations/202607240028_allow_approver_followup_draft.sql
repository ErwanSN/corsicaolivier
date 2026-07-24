-- An approver is allowed to publish a schedule. The publication trigger must
-- therefore also allow that actor to create the automatic follow-up draft.

create or replace function public.ensure_editable_schedule_for_period(
  target_planning_period_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_period public.planning_periods;
  draft_schedule public.schedule_versions;
  published_schedule public.schedule_versions;
  created_schedule public.schedule_versions;
  next_version_number integer;
begin
  select period.* into target_period
  from public.planning_periods period
  where period.id = target_planning_period_id
  for update;

  if target_period.id is null then
    raise exception 'Planning period not found';
  end if;

  if not (
    public.has_role(
      target_period.organization_id,
      target_period.site_id,
      array[
        'platform_admin',
        'planning_admin',
        'planner'
      ]::public.app_role[]
    )
    or (
      pg_trigger_depth() > 0
      and public.has_role(
        target_period.organization_id,
        target_period.site_id,
        array['approver']::public.app_role[]
      )
    )
  ) then
    raise exception 'Insufficient permissions';
  end if;

  select schedule.* into draft_schedule
  from public.schedule_versions schedule
  where schedule.planning_period_id = target_period.id
    and schedule.status = 'draft'
  order by schedule.version_number desc
  limit 1;

  if draft_schedule.id is not null then
    return draft_schedule.id;
  end if;

  select schedule.* into published_schedule
  from public.schedule_versions schedule
  where schedule.planning_period_id = target_period.id
    and schedule.status = 'published'
  order by schedule.version_number desc
  limit 1;

  select coalesce(max(schedule.version_number), 0) + 1
  into next_version_number
  from public.schedule_versions schedule
  where schedule.planning_period_id = target_period.id;

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
    published_schedule.id,
    next_version_number,
    'draft',
    'Brouillon de travail',
    case
      when published_schedule.id is null
        then 'Initialisation automatique à partir des escales'
      else 'Copie de travail automatique du planning publié'
    end,
    (select auth.uid())
  )
  returning * into created_schedule;

  if published_schedule.id is not null then
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
      created_schedule.id,
      source_shift.agent_id,
      source_shift.starts_at,
      source_shift.ends_at,
      source_shift.break_minutes,
      'replanned',
      source_shift.note,
      (select auth.uid()),
      source_shift.id
    from public.planning_shifts source_shift
    where source_shift.schedule_version_id = published_schedule.id;

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
      cloned_shift.id,
      source_assignment.position_id,
      source_assignment.staffing_requirement_id,
      source_assignment.port_call_id,
      source_assignment.starts_at,
      source_assignment.ends_at
    from public.shift_assignments source_assignment
    join public.planning_shifts source_shift
      on source_shift.id = source_assignment.planning_shift_id
    join public.planning_shifts cloned_shift
      on cloned_shift.source_shift_id = source_shift.id
      and cloned_shift.schedule_version_id = created_schedule.id
    where source_shift.schedule_version_id = published_schedule.id;
  end if;

  return created_schedule.id;
end;
$$;

revoke all on function public.ensure_editable_schedule_for_period(uuid)
from public;

grant execute on function public.ensure_editable_schedule_for_period(uuid)
to authenticated;
