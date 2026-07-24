-- A published schedule is an operational commitment. Refuse structurally
-- incomplete versions even when a caller bypasses the web interface.

create or replace function public.publish_schedule_version(
  target_schedule_version_id uuid,
  publication_reason text
)
returns public.schedule_versions
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.schedule_versions;
begin
  select * into target
  from public.schedule_versions
  where id = target_schedule_version_id
  for update;

  if target.id is null then
    raise exception 'Schedule version not found';
  end if;

  if not public.has_role(
    target.organization_id,
    target.site_id,
    array['platform_admin', 'planning_admin', 'approver']::public.app_role[]
  ) then
    raise exception 'Insufficient permissions';
  end if;

  if target.status not in ('draft', 'validated') then
    raise exception 'Only draft or validated schedules can be published';
  end if;

  if publication_reason is null or char_length(publication_reason) < 3 then
    raise exception 'A publication reason is required';
  end if;

  if not exists (
    select 1
    from public.planning_shifts shift
    where shift.schedule_version_id = target.id
  ) then
    raise exception 'A schedule cannot be published without shifts';
  end if;

  if exists (
    select 1
    from public.planning_shifts shift
    where shift.schedule_version_id = target.id
      and not exists (
        select 1
        from public.shift_assignments assignment
        where assignment.planning_shift_id = shift.id
      )
  ) then
    raise exception 'Every shift must contain at least one position assignment';
  end if;

  if exists (
    select 1
    from public.planning_shifts shift
    join public.shift_assignments assignment
      on assignment.planning_shift_id = shift.id
    join public.port_calls call on call.id = assignment.port_call_id
    where shift.schedule_version_id = target.id
      and call.status = 'cancelled'
  ) then
    raise exception 'A schedule cannot include assignments for cancelled port calls';
  end if;

  update public.schedule_versions
  set status = 'archived', updated_at = now()
  where planning_period_id = target.planning_period_id
    and status = 'published';

  update public.schedule_versions
  set status = 'published',
      change_reason = publication_reason,
      published_by = (select auth.uid()),
      published_at = now(),
      updated_at = now()
  where id = target.id
  returning * into target;

  insert into public.outbox_events (
    organization_id,
    site_id,
    topic,
    aggregate_type,
    aggregate_id,
    payload,
    idempotency_key
  ) values (
    target.organization_id,
    target.site_id,
    'planning.schedule.published',
    'schedule_version',
    target.id,
    jsonb_build_object(
      'scheduleVersionId', target.id,
      'planningPeriodId', target.planning_period_id,
      'publishedAt', target.published_at
    ),
    'schedule-published-' || target.id::text
  );

  return target;
end;
$$;

revoke all on function public.publish_schedule_version(uuid, text) from public;
grant execute on function public.publish_schedule_version(uuid, text) to authenticated;
