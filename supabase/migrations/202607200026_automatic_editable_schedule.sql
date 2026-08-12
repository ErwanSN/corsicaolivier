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

  if not public.has_role(
    target_period.organization_id,
    target_period.site_id,
    array['platform_admin', 'planning_admin', 'planner']::public.app_role[]
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

create or replace function public.ensure_editable_schedule_from_port_call()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_site public.sites;
  target_period public.planning_periods;
  effective_anchor timestamptz;
  call_date date;
begin
  if new.status = 'cancelled' then
    return new;
  end if;

  select site.* into target_site
  from public.sites site
  where site.id = new.site_id;

  effective_anchor := coalesce(
    new.estimated_arrival_at,
    new.scheduled_arrival_at,
    new.estimated_departure_at,
    new.scheduled_departure_at
  );

  if effective_anchor is null or target_site.id is null then
    return new;
  end if;

  call_date := (effective_anchor at time zone target_site.timezone)::date;

  select period.* into target_period
  from public.planning_periods period
  where period.site_id = new.site_id
    and call_date between period.starts_on and period.ends_on
  order by period.starts_on desc
  limit 1;

  if target_period.id is not null then
    perform public.ensure_editable_schedule_for_period(target_period.id);
  end if;

  return new;
end;
$$;

revoke all on function public.ensure_editable_schedule_from_port_call()
from public, authenticated;

drop trigger if exists port_calls_zz_ensure_editable_schedule
on public.port_calls;

create trigger port_calls_zz_ensure_editable_schedule
after insert or update of
  scheduled_arrival_at,
  scheduled_departure_at,
  estimated_arrival_at,
  estimated_departure_at,
  status,
  demand_profile_id
on public.port_calls
for each row execute function public.ensure_editable_schedule_from_port_call();

create or replace function public.create_followup_draft_after_publication()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'published' and old.status <> 'published' then
    perform public.ensure_editable_schedule_for_period(new.planning_period_id);
  end if;

  return new;
end;
$$;

revoke all on function public.create_followup_draft_after_publication()
from public, authenticated;

drop trigger if exists schedule_versions_create_followup_draft
on public.schedule_versions;

create trigger schedule_versions_create_followup_draft
after update of status on public.schedule_versions
for each row execute function public.create_followup_draft_after_publication();

do $$
declare
  actor_id uuid;
  target_period_id uuid;
begin
  select app_user.id into actor_id
  from public.app_users app_user
  where lower(app_user.email) = 'demo.operator@example.invalid'
    and app_user.status = 'active'
  order by app_user.created_at
  limit 1;

  if actor_id is null then
    return;
  end if;

  perform set_config('request.jwt.claim.sub', actor_id::text, true);

  for target_period_id in
    select period.id
    from public.planning_periods period
    where period.site_id = '00000000-0000-4000-8000-000000000101'
      and period.starts_on <= date '2026-08-19'
      and period.ends_on >= date '2026-07-20'
  loop
    perform public.ensure_editable_schedule_for_period(target_period_id);
  end loop;
end;
$$;

comment on function public.ensure_editable_schedule_for_period(uuid) is
  'Returns the editable draft for a week, cloning the published schedule when necessary.';
