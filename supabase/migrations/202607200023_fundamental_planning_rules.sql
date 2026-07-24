-- Fundamental rest rules are enforced in PostgreSQL so every planning entry
-- point (manual, automatic or replanning) follows the same constraints.

create or replace function public.assert_agent_planning_rules(
  target_schedule_version_id uuid,
  target_agent_id uuid,
  candidate_starts_at timestamptz default null,
  candidate_ends_at timestamptz default null,
  excluded_shift_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_schedule public.schedule_versions;
  target_timezone text;
  has_violation boolean;
begin
  select schedule.*
  into target_schedule
  from public.schedule_versions schedule
  where schedule.id = target_schedule_version_id;

  if not found then
    raise exception using
      errcode = 'P2000',
      message = 'Version de planning introuvable.';
  end if;

  select period.timezone
  into target_timezone
  from public.planning_periods period
  where period.id = target_schedule.planning_period_id;

  -- Serialize business-rule checks for one agent within normal planning flows.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_agent_id::text, 20260720)
  );

  with effective_versions as (
    select version.id
    from public.schedule_versions version
    where version.id = target_schedule.id
      or (
        version.organization_id = target_schedule.organization_id
        and version.site_id = target_schedule.site_id
        and version.status = 'published'
        and version.planning_period_id <> target_schedule.planning_period_id
      )
  ),
  effective_shifts as (
    select shift.id, shift.starts_at, shift.ends_at
    from public.planning_shifts shift
    join effective_versions version on version.id = shift.schedule_version_id
    where shift.agent_id = target_agent_id
      and (excluded_shift_id is null or shift.id <> excluded_shift_id)

    union all

    select null::uuid, candidate_starts_at, candidate_ends_at
    where candidate_starts_at is not null
      and candidate_ends_at is not null
  ),
  ordered_shifts as (
    select
      shift.*,
      lag(shift.ends_at) over (
        order by shift.starts_at, shift.ends_at, shift.id nulls last
      ) as previous_ends_at
    from effective_shifts shift
  )
  select exists (
    select 1
    from ordered_shifts shift
    where shift.previous_ends_at is not null
      and shift.starts_at < shift.previous_ends_at
  )
  into has_violation;

  if has_violation then
    raise exception using
      errcode = 'P2001',
      message = 'Cet agent a déjà une affectation sur ce créneau.';
  end if;

  with effective_versions as (
    select version.id
    from public.schedule_versions version
    where version.id = target_schedule.id
      or (
        version.organization_id = target_schedule.organization_id
        and version.site_id = target_schedule.site_id
        and version.status = 'published'
        and version.planning_period_id <> target_schedule.planning_period_id
      )
  ),
  effective_shifts as (
    select shift.id, shift.starts_at, shift.ends_at
    from public.planning_shifts shift
    join effective_versions version on version.id = shift.schedule_version_id
    where shift.agent_id = target_agent_id
      and (excluded_shift_id is null or shift.id <> excluded_shift_id)

    union all

    select null::uuid, candidate_starts_at, candidate_ends_at
    where candidate_starts_at is not null
      and candidate_ends_at is not null
  ),
  ordered_shifts as (
    select
      shift.*,
      lag(shift.starts_at) over (
        order by shift.starts_at, shift.ends_at, shift.id nulls last
      ) as previous_starts_at,
      lag(shift.ends_at) over (
        order by shift.starts_at, shift.ends_at, shift.id nulls last
      ) as previous_ends_at
    from effective_shifts shift
  )
  select exists (
    select 1
    from ordered_shifts shift
    where shift.previous_ends_at is not null
      and (shift.starts_at at time zone target_timezone)::date
        > (shift.previous_starts_at at time zone target_timezone)::date
      and shift.starts_at - shift.previous_ends_at < interval '11 hours'
  )
  into has_violation;

  if has_violation then
    raise exception using
      errcode = 'P2002',
      message = 'Repos quotidien insuffisant : 11 heures consécutives sont requises.';
  end if;

  with effective_versions as (
    select version.id
    from public.schedule_versions version
    where version.id = target_schedule.id
      or (
        version.organization_id = target_schedule.organization_id
        and version.site_id = target_schedule.site_id
        and version.status = 'published'
        and version.planning_period_id <> target_schedule.planning_period_id
      )
  ),
  effective_shifts as (
    select shift.id, shift.starts_at, shift.ends_at
    from public.planning_shifts shift
    join effective_versions version on version.id = shift.schedule_version_id
    where shift.agent_id = target_agent_id
      and (excluded_shift_id is null or shift.id <> excluded_shift_id)

    union all

    select null::uuid, candidate_starts_at, candidate_ends_at
    where candidate_starts_at is not null
      and candidate_ends_at is not null
  ),
  local_shifts as (
    select
      (shift.starts_at at time zone target_timezone)::date as work_date,
      (shift.starts_at at time zone target_timezone)::time as start_time
    from effective_shifts shift
  )
  select exists (
    select 1
    from local_shifts early_shift
    join local_shifts next_day_shift
      on next_day_shift.work_date = early_shift.work_date + 1
    where early_shift.start_time <= time '06:00'
      and next_day_shift.start_time < time '12:00'
  )
  into has_violation;

  if has_violation then
    raise exception using
      errcode = 'P2003',
      message = 'Après un service commencé à 06:00 ou avant, le service du lendemain doit commencer à 12:00 ou après.';
  end if;

  with effective_versions as (
    select version.id
    from public.schedule_versions version
    where version.id = target_schedule.id
      or (
        version.organization_id = target_schedule.organization_id
        and version.site_id = target_schedule.site_id
        and version.status = 'published'
        and version.planning_period_id <> target_schedule.planning_period_id
      )
  ),
  effective_shifts as (
    select shift.id, shift.starts_at, shift.ends_at
    from public.planning_shifts shift
    join effective_versions version on version.id = shift.schedule_version_id
    where shift.agent_id = target_agent_id
      and (excluded_shift_id is null or shift.id <> excluded_shift_id)

    union all

    select null::uuid, candidate_starts_at, candidate_ends_at
    where candidate_starts_at is not null
      and candidate_ends_at is not null
  ),
  work_dates as (
    select distinct
      (shift.starts_at at time zone target_timezone)::date as work_date
    from effective_shifts shift
  )
  select exists (
    select 1
    from work_dates first_day
    where exists (
      select 1 from work_dates day_2
      where day_2.work_date = first_day.work_date + 1
    )
      and exists (
        select 1 from work_dates day_3
        where day_3.work_date = first_day.work_date + 2
      )
      and exists (
        select 1 from work_dates day_4
        where day_4.work_date = first_day.work_date + 3
      )
      and exists (
        select 1 from work_dates day_5
        where day_5.work_date = first_day.work_date + 4
      )
      and exists (
        select 1 from work_dates day_6
        where day_6.work_date = first_day.work_date + 5
      )
      and exists (
        select 1 from work_dates day_7
        where day_7.work_date = first_day.work_date + 6
      )
  )
  into has_violation;

  if has_violation then
    raise exception using
      errcode = 'P2004',
      message = 'Un agent ne peut pas travailler plus de 6 jours consécutifs.';
  end if;
end;
$$;

revoke all on function public.assert_agent_planning_rules(
  uuid,
  uuid,
  timestamptz,
  timestamptz,
  uuid
) from public, authenticated;

create or replace function public.enforce_agent_planning_rules_on_shift()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_agent_planning_rules(
    new.schedule_version_id,
    new.agent_id,
    new.starts_at,
    new.ends_at,
    case when tg_op = 'UPDATE' then old.id else null end
  );

  return new;
end;
$$;

revoke all on function public.enforce_agent_planning_rules_on_shift()
from public, authenticated;

drop trigger if exists planning_shifts_enforce_fundamental_rules
on public.planning_shifts;

create trigger planning_shifts_enforce_fundamental_rules
before insert or update of schedule_version_id, agent_id, starts_at, ends_at
on public.planning_shifts
for each row execute function public.enforce_agent_planning_rules_on_shift();

create or replace function public.validate_agent_planning_rules_on_publish()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_agent_id uuid;
begin
  if new.status = 'published' and old.status <> 'published' then
    for target_agent_id in
      select distinct shift.agent_id
      from public.planning_shifts shift
      where shift.schedule_version_id = new.id
    loop
      perform public.assert_agent_planning_rules(new.id, target_agent_id);
    end loop;
  end if;

  return new;
end;
$$;

revoke all on function public.validate_agent_planning_rules_on_publish()
from public, authenticated;

drop trigger if exists schedule_versions_validate_fundamental_rules
on public.schedule_versions;

create trigger schedule_versions_validate_fundamental_rules
before update of status on public.schedule_versions
for each row execute function public.validate_agent_planning_rules_on_publish();

comment on function public.assert_agent_planning_rules(
  uuid,
  uuid,
  timestamptz,
  timestamptz,
  uuid
) is 'Enforces 11-hour daily rest, post-early-shift rotation and at most 6 consecutive workdays across planning periods.';
