-- Strengthen the existing planning commands without changing the signatures
-- used by the API. Published schedules remain immutable, every publication is
-- revalidated against current operational facts, and authenticated users must
-- use the transactional RPCs instead of mutating planning tables directly.

alter table public.schedule_versions
  add column superseded_at timestamptz,
  add column lock_version bigint not null default 0;

alter table public.schedule_versions
  add constraint schedule_versions_lock_version_nonnegative
    check (lock_version >= 0);

-- Existing installations may already contain parallel drafts. Keep the most
-- recent version current and retain the others as immutable historical drafts.
with ranked_drafts as (
  select
    schedule.id,
    row_number() over (
      partition by schedule.planning_period_id
      order by schedule.version_number desc, schedule.created_at desc, schedule.id
    ) as current_rank
  from public.schedule_versions schedule
  where schedule.status in ('draft', 'validated')
    and schedule.superseded_at is null
)
update public.schedule_versions schedule
set superseded_at = now(),
    updated_at = now()
from ranked_drafts ranked
where ranked.id = schedule.id
  and ranked.current_rank > 1;

create unique index schedule_versions_one_current_draft
  on public.schedule_versions (planning_period_id)
  where status in ('draft', 'validated')
    and superseded_at is null;

create index schedule_versions_current_lookup
  on public.schedule_versions (planning_period_id, version_number desc)
  where superseded_at is null;

create or replace function public.prepare_current_schedule_draft()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status not in ('draft', 'validated')
    or new.superseded_at is not null then
    return new;
  end if;

  -- All existing creation RPCs already lock the period. Keeping the lock here
  -- also protects future internal creation paths and direct service-role jobs.
  perform 1
  from public.planning_periods period
  where period.id = new.planning_period_id
  for update;

  update public.schedule_versions schedule
  set superseded_at = now(),
      updated_at = now()
  where schedule.planning_period_id = new.planning_period_id
    and schedule.id <> new.id
    and schedule.status in ('draft', 'validated')
    and schedule.superseded_at is null;

  return new;
end;
$$;

revoke all on function public.prepare_current_schedule_draft()
from public, authenticated;

drop trigger if exists schedule_versions_00_prepare_current_draft
on public.schedule_versions;

create trigger schedule_versions_00_prepare_current_draft
before insert or update of status, superseded_at
on public.schedule_versions
for each row execute function public.prepare_current_schedule_draft();

create or replace function public.protect_schedule_version_state()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.organization_id <> old.organization_id
    or new.site_id <> old.site_id
    or new.planning_period_id <> old.planning_period_id
    or new.version_number <> old.version_number then
    raise exception 'Schedule identity and scope are immutable';
  end if;

  if old.status = 'archived' then
    raise exception 'Archived schedules are immutable';
  end if;

  if old.status = 'published' and new.status <> 'archived' then
    raise exception 'Published schedules can only be archived';
  end if;

  if old.superseded_at is not null then
    if new.superseded_at is distinct from old.superseded_at then
      raise exception using
        errcode = 'P2050',
        message = 'A superseded draft cannot become current again.';
    end if;

    if new.status not in (old.status, 'archived') then
      raise exception using
        errcode = 'P2050',
        message = 'A superseded draft is immutable.';
    end if;
  end if;

  if new.status = 'published' and new.superseded_at is not null then
    raise exception using
      errcode = 'P2050',
      message = 'A superseded draft cannot be published.';
  end if;

  if new.status = 'published' and old.status <> 'published' and not public.has_role(
    new.organization_id,
    new.site_id,
    array['platform_admin', 'planning_admin', 'approver']::public.app_role[]
  ) then
    raise exception 'Only an approver can publish a schedule';
  end if;

  return new;
end;
$$;

revoke all on function public.protect_schedule_version_state()
from public, authenticated;

-- The checked RPC overloads set an expected version in transaction-local
-- settings. The first content mutation verifies it while holding the schedule
-- row lock; subsequent mutations belonging to the same atomic command reuse
-- that verification.
create or replace function public.protect_schedule_content()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  version_id uuid;
  version_status public.schedule_status;
  version_superseded_at timestamptz;
  version_lock_version bigint;
  expected_lock_version_text text;
  verified_version_id_text text;
begin
  -- Keep table-specific record fields in separate branches. PL/pgSQL resolves
  -- CASE expressions against the trigger row type even for branches that are
  -- not taken, which would make planning_shifts look for planning_shift_id.
  if tg_table_name = 'planning_shifts' then
    version_id := case
      when tg_op = 'DELETE' then old.schedule_version_id
      else new.schedule_version_id
    end;
  else
    select shift.schedule_version_id
    into version_id
    from public.planning_shifts shift
    where shift.id = case
      when tg_op = 'DELETE' then old.planning_shift_id
      else new.planning_shift_id
    end;
  end if;

  select schedule.status, schedule.superseded_at, schedule.lock_version
  into version_status, version_superseded_at, version_lock_version
  from public.schedule_versions schedule
  where schedule.id = version_id;

  if not found then
    raise exception 'Schedule version not found';
  end if;

  if version_status in ('published', 'archived') then
    raise exception 'Published or archived schedules are immutable';
  end if;

  if version_superseded_at is not null then
    raise exception using
      errcode = 'P2051',
      message = 'A superseded draft cannot be modified.';
  end if;

  expected_lock_version_text := nullif(
    current_setting('app.expected_schedule_lock_version', true),
    ''
  );
  verified_version_id_text := nullif(
    current_setting('app.expected_schedule_lock_verified', true),
    ''
  );

  if expected_lock_version_text is not null
    and verified_version_id_text is distinct from version_id::text then
    select schedule.lock_version
    into version_lock_version
    from public.schedule_versions schedule
    where schedule.id = version_id
    for update;

    if version_lock_version <> expected_lock_version_text::bigint then
      raise exception using
        errcode = 'P2031',
        message = format(
          'Schedule changed concurrently (expected version %s, current version %s).',
          expected_lock_version_text,
          version_lock_version
        );
    end if;

    perform set_config(
      'app.expected_schedule_lock_verified',
      version_id::text,
      true
    );
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.protect_schedule_content()
from public, authenticated;

create or replace function public.bump_schedule_lock_from_content()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_version_id uuid;
  next_version_id uuid;
begin
  if tg_table_name = 'planning_shifts' then
    if tg_op <> 'INSERT' then
      previous_version_id := old.schedule_version_id;
    end if;
    if tg_op <> 'DELETE' then
      next_version_id := new.schedule_version_id;
    end if;
  else
    if tg_op <> 'INSERT' then
      select shift.schedule_version_id
      into previous_version_id
      from public.planning_shifts shift
      where shift.id = old.planning_shift_id;
    end if;
    if tg_op <> 'DELETE' then
      select shift.schedule_version_id
      into next_version_id
      from public.planning_shifts shift
      where shift.id = new.planning_shift_id;
    end if;
  end if;

  update public.schedule_versions schedule
  set lock_version = schedule.lock_version + 1
  where schedule.id in (previous_version_id, next_version_id)
    and schedule.status in ('draft', 'validated')
    and schedule.superseded_at is null;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.bump_schedule_lock_from_content()
from public, authenticated;

drop trigger if exists planning_shifts_bump_schedule_lock
on public.planning_shifts;
drop trigger if exists shift_assignments_bump_schedule_lock
on public.shift_assignments;

create trigger planning_shifts_bump_schedule_lock
after insert or update or delete on public.planning_shifts
for each row execute function public.bump_schedule_lock_from_content();

create trigger shift_assignments_bump_schedule_lock
after insert or update or delete on public.shift_assignments
for each row execute function public.bump_schedule_lock_from_content();

create or replace function public.bump_current_schedule_lock_from_requirement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_period_id uuid;
begin
  target_period_id := case
    when tg_op = 'DELETE' then old.planning_period_id
    else new.planning_period_id
  end;

  update public.schedule_versions schedule
  set lock_version = schedule.lock_version + 1
  where schedule.planning_period_id = target_period_id
    and schedule.status in ('draft', 'validated')
    and schedule.superseded_at is null;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.bump_current_schedule_lock_from_requirement()
from public, authenticated;

drop trigger if exists staffing_requirements_bump_schedule_lock
on public.staffing_requirements;

create trigger staffing_requirements_bump_schedule_lock
after insert or update or delete on public.staffing_requirements
for each row execute function public.bump_current_schedule_lock_from_requirement();

create or replace function public.schedule_version_coverage_gaps(
  target_schedule_version_id uuid
)
returns table (
  staffing_requirement_id uuid,
  gap_starts_at timestamptz,
  gap_ends_at timestamptz,
  required_agents integer,
  assigned_agents bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with target_schedule as (
    select schedule.id, schedule.planning_period_id
    from public.schedule_versions schedule
    where schedule.id = target_schedule_version_id
  ),
  active_requirements as (
    select requirement.*
    from public.staffing_requirements requirement
    join target_schedule schedule
      on schedule.planning_period_id = requirement.planning_period_id
    left join public.port_calls port_call
      on port_call.id = requirement.port_call_id
    where port_call.id is null or port_call.status <> 'cancelled'
  ),
  matching_assignments as (
    select
      requirement.id as requirement_id,
      shift.agent_id,
      greatest(requirement.starts_at, assignment.starts_at) as covered_from,
      least(requirement.ends_at, assignment.ends_at) as covered_until
    from active_requirements requirement
    join target_schedule schedule on true
    join public.planning_shifts shift
      on shift.schedule_version_id = schedule.id
    join public.shift_assignments assignment
      on assignment.planning_shift_id = shift.id
      and assignment.position_id = requirement.position_id
      and tstzrange(assignment.starts_at, assignment.ends_at, '[)')
        && tstzrange(requirement.starts_at, requirement.ends_at, '[)')
      and (
        assignment.staffing_requirement_id = requirement.id
        or (
          assignment.staffing_requirement_id is null
          and assignment.port_call_id is not distinct from requirement.port_call_id
        )
      )
  ),
  boundaries as (
    select requirement.id as requirement_id, requirement.starts_at as boundary
    from active_requirements requirement
    union
    select requirement.id, requirement.ends_at
    from active_requirements requirement
    union
    select assignment.requirement_id, assignment.covered_from
    from matching_assignments assignment
    union
    select assignment.requirement_id, assignment.covered_until
    from matching_assignments assignment
  ),
  segments as (
    select
      boundary.requirement_id,
      boundary.boundary as segment_start,
      lead(boundary.boundary) over (
        partition by boundary.requirement_id
        order by boundary.boundary
      ) as segment_end
    from boundaries boundary
  )
  select
    requirement.id,
    segment.segment_start,
    segment.segment_end,
    requirement.required_agents::integer,
    count(distinct assignment.agent_id) filter (
      where assignment.covered_from <= segment.segment_start
        and assignment.covered_until >= segment.segment_end
    ) as assigned_agents
  from segments segment
  join active_requirements requirement
    on requirement.id = segment.requirement_id
  left join matching_assignments assignment
    on assignment.requirement_id = segment.requirement_id
  where segment.segment_end is not null
    and segment.segment_end > segment.segment_start
  group by
    requirement.id,
    segment.segment_start,
    segment.segment_end,
    requirement.required_agents
  having count(distinct assignment.agent_id) filter (
    where assignment.covered_from <= segment.segment_start
      and assignment.covered_until >= segment.segment_end
  ) < requirement.required_agents;
$$;

revoke all on function public.schedule_version_coverage_gaps(uuid)
from public, authenticated;

create or replace function public.validate_schedule_version_integrity(
  target_schedule_version_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_schedule public.schedule_versions;
  target_period public.planning_periods;
  target_agent_id uuid;
  first_gap record;
begin
  select schedule.*
  into target_schedule
  from public.schedule_versions schedule
  where schedule.id = target_schedule_version_id;

  if target_schedule.id is null then
    raise exception using
      errcode = 'P2040',
      message = 'Schedule version not found.';
  end if;

  if target_schedule.superseded_at is not null then
    raise exception using
      errcode = 'P2050',
      message = 'A superseded draft cannot be published.';
  end if;

  select period.*
  into target_period
  from public.planning_periods period
  where period.id = target_schedule.planning_period_id;

  if not exists (
    select 1
    from public.planning_shifts shift
    where shift.schedule_version_id = target_schedule.id
  ) then
    raise exception using
      errcode = 'P2041',
      message = 'A schedule cannot be published without shifts.';
  end if;

  if exists (
    select 1
    from public.planning_shifts shift
    where shift.schedule_version_id = target_schedule.id
      and not exists (
        select 1
        from public.shift_assignments assignment
        where assignment.planning_shift_id = shift.id
      )
  ) then
    raise exception using
      errcode = 'P2042',
      message = 'Every shift must contain at least one position assignment.';
  end if;

  if exists (
    select 1
    from public.planning_shifts shift
    where shift.schedule_version_id = target_schedule.id
      and (
        (shift.starts_at at time zone target_period.timezone)::date
          < target_period.starts_on
        or (
          (shift.ends_at - interval '1 microsecond')
            at time zone target_period.timezone
        )::date > target_period.ends_on
      )
  ) then
    raise exception using
      errcode = 'P2043',
      message = 'A shift falls outside its planning period.';
  end if;

  if exists (
    select 1
    from public.planning_shifts shift
    join public.agents agent on agent.id = shift.agent_id
    where shift.schedule_version_id = target_schedule.id
      and (
        agent.organization_id <> target_schedule.organization_id
        or agent.primary_site_id <> target_schedule.site_id
        or not agent.active
        or (
          agent.hired_on is not null
          and agent.hired_on
            > (shift.starts_at at time zone target_period.timezone)::date
        )
        or (
          agent.left_on is not null
          and agent.left_on < (
            (shift.ends_at - interval '1 microsecond')
              at time zone target_period.timezone
          )::date
        )
      )
  ) then
    raise exception using
      errcode = 'P2044',
      message = 'Every shift requires an active agent employed in the schedule scope.';
  end if;

  if exists (
    select 1
    from public.planning_shifts shift
    where shift.schedule_version_id = target_schedule.id
      and not exists (
        select 1
        from public.agent_contract_versions contract
        where contract.agent_id = shift.agent_id
          and contract.organization_id = target_schedule.organization_id
          and contract.effective_from
            <= (shift.starts_at at time zone target_period.timezone)::date
          and (
            contract.effective_until is null
            or contract.effective_until >= (
              (shift.ends_at - interval '1 microsecond')
                at time zone target_period.timezone
            )::date
          )
      )
  ) then
    raise exception using
      errcode = 'P2045',
      message = 'Every shift must be covered by an effective employment contract.';
  end if;

  if exists (
    select 1
    from public.planning_shifts shift
    join public.agent_unavailability unavailable
      on unavailable.agent_id = shift.agent_id
      and unavailable.organization_id = target_schedule.organization_id
      and tstzrange(unavailable.starts_at, unavailable.ends_at, '[)')
        && tstzrange(shift.starts_at, shift.ends_at, '[)')
    where shift.schedule_version_id = target_schedule.id
  ) then
    raise exception using
      errcode = 'P2046',
      message = 'A scheduled agent is unavailable during a shift.';
  end if;

  if exists (
    select 1
    from public.planning_shifts shift
    join public.shift_assignments assignment
      on assignment.planning_shift_id = shift.id
    left join public.positions position on position.id = assignment.position_id
    where shift.schedule_version_id = target_schedule.id
      and (
        position.id is null
        or not position.active
        or position.organization_id <> target_schedule.organization_id
        or (position.site_id is not null and position.site_id <> target_schedule.site_id)
        or assignment.site_id <> shift.site_id
        or assignment.starts_at < shift.starts_at
        or assignment.ends_at > shift.ends_at
      )
  ) then
    raise exception using
      errcode = 'P2047',
      message = 'Every assignment must use an active in-scope position inside its shift.';
  end if;

  if exists (
    select 1
    from public.planning_shifts shift
    join public.shift_assignments assignment
      on assignment.planning_shift_id = shift.id
    join public.agent_position_restrictions restriction
      on restriction.agent_id = shift.agent_id
      and restriction.position_id = assignment.position_id
      and restriction.organization_id = target_schedule.organization_id
    where shift.schedule_version_id = target_schedule.id
      and restriction.valid_from <= (
        (assignment.ends_at - interval '1 microsecond')
          at time zone target_period.timezone
      )::date
      and (
        restriction.valid_until is null
        or restriction.valid_until
          >= (assignment.starts_at at time zone target_period.timezone)::date
      )
  ) then
    raise exception using
      errcode = 'P2048',
      message = 'An agent is restricted from an assigned position.';
  end if;

  if exists (
    select 1
    from public.planning_shifts shift
    join public.shift_assignments assignment
      on assignment.planning_shift_id = shift.id
    join public.position_skill_requirements requirement
      on requirement.position_id = assignment.position_id
      and requirement.organization_id = target_schedule.organization_id
      and requirement.mandatory = true
    where shift.schedule_version_id = target_schedule.id
      and not exists (
        select 1
        from public.agent_skills agent_skill
        where agent_skill.agent_id = shift.agent_id
          and agent_skill.skill_id = requirement.skill_id
          and agent_skill.organization_id = target_schedule.organization_id
          and agent_skill.level >= requirement.minimum_level
          and agent_skill.valid_from
            <= (assignment.starts_at at time zone target_period.timezone)::date
          and (
            agent_skill.valid_until is null
            or agent_skill.valid_until >= (
              (assignment.ends_at - interval '1 microsecond')
                at time zone target_period.timezone
            )::date
          )
      )
  ) then
    raise exception using
      errcode = 'P2049',
      message = 'An agent lacks a mandatory skill for an assigned position.';
  end if;

  if exists (
    select 1
    from public.planning_shifts shift
    join public.shift_assignments assignment
      on assignment.planning_shift_id = shift.id
    join public.port_calls port_call on port_call.id = assignment.port_call_id
    where shift.schedule_version_id = target_schedule.id
      and (
        port_call.organization_id <> target_schedule.organization_id
        or port_call.site_id <> target_schedule.site_id
        or port_call.status = 'cancelled'
      )
  ) then
    raise exception using
      errcode = 'P2052',
      message = 'A schedule cannot include an invalid or cancelled port call.';
  end if;

  if exists (
    select 1
    from public.planning_shifts shift
    join public.shift_assignments assignment
      on assignment.planning_shift_id = shift.id
    join public.staffing_requirements requirement
      on requirement.id = assignment.staffing_requirement_id
    where shift.schedule_version_id = target_schedule.id
      and (
        requirement.planning_period_id <> target_schedule.planning_period_id
        or requirement.organization_id <> target_schedule.organization_id
        or requirement.site_id <> target_schedule.site_id
        or requirement.position_id <> assignment.position_id
        or requirement.port_call_id is distinct from assignment.port_call_id
      )
  ) then
    raise exception using
      errcode = 'P2053',
      message = 'An assignment references an incompatible staffing requirement.';
  end if;

  select gap.*
  into first_gap
  from public.schedule_version_coverage_gaps(target_schedule.id) gap
  order by gap.gap_starts_at, gap.staffing_requirement_id
  limit 1;

  if found then
    raise exception using
      errcode = 'P2054',
      message = format(
        'Staffing requirement %s is under-covered from %s to %s (%s/%s agents).',
        first_gap.staffing_requirement_id,
        first_gap.gap_starts_at,
        first_gap.gap_ends_at,
        first_gap.assigned_agents,
        first_gap.required_agents
      );
  end if;

  for target_agent_id in
    select distinct shift.agent_id
    from public.planning_shifts shift
    where shift.schedule_version_id = target_schedule.id
  loop
    perform public.assert_agent_planning_rules(
      target_schedule.id,
      target_agent_id
    );
  end loop;
end;
$$;

revoke all on function public.validate_schedule_version_integrity(uuid)
from public, authenticated;

-- Keep the existing publication trigger name so every status transition,
-- including internal service-role paths, receives the complete validation.
create or replace function public.validate_agent_planning_rules_on_publish()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'published' and old.status <> 'published' then
    perform public.validate_schedule_version_integrity(new.id);
  end if;

  return new;
end;
$$;

revoke all on function public.validate_agent_planning_rules_on_publish()
from public, authenticated;

-- Preserve the automatic workspace API while ignoring historical stale drafts.
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
    and schedule.status in ('draft', 'validated')
    and schedule.superseded_at is null
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

-- Optional optimistic-concurrency overloads. The original signatures remain
-- available, so the deployed API keeps working while clients can progressively
-- start sending the lock_version they read with a schedule.
create or replace function public.create_planning_shift(
  target_schedule_version_id uuid,
  target_agent_id uuid,
  shift_starts_at timestamptz,
  shift_ends_at timestamptz,
  shift_break_minutes integer,
  target_position_id uuid,
  target_port_call_id uuid,
  shift_note text,
  expected_lock_version bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if expected_lock_version is null or expected_lock_version < 0 then
    raise exception using errcode = 'P2030', message = 'A valid expected lock version is required.';
  end if;

  perform set_config('app.expected_schedule_lock_version', expected_lock_version::text, true);
  perform set_config('app.expected_schedule_lock_verified', '', true);

  result := public.create_planning_shift(
    target_schedule_version_id,
    target_agent_id,
    shift_starts_at,
    shift_ends_at,
    shift_break_minutes,
    target_position_id,
    target_port_call_id,
    shift_note
  );

  perform set_config('app.expected_schedule_lock_version', '', true);
  perform set_config('app.expected_schedule_lock_verified', '', true);

  return result || jsonb_build_object(
    'lockVersion',
    (select schedule.lock_version from public.schedule_versions schedule where schedule.id = target_schedule_version_id)
  );
end;
$$;

create or replace function public.move_planning_assignment(
  target_schedule_version_id uuid,
  target_assignment_id uuid,
  target_work_date date,
  target_position_id uuid,
  expected_lock_version bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if expected_lock_version is null or expected_lock_version < 0 then
    raise exception using errcode = 'P2030', message = 'A valid expected lock version is required.';
  end if;

  perform set_config('app.expected_schedule_lock_version', expected_lock_version::text, true);
  perform set_config('app.expected_schedule_lock_verified', '', true);

  result := public.move_planning_assignment(
    target_schedule_version_id,
    target_assignment_id,
    target_work_date,
    target_position_id
  );

  perform set_config('app.expected_schedule_lock_version', '', true);
  perform set_config('app.expected_schedule_lock_verified', '', true);

  return result || jsonb_build_object(
    'lockVersion',
    (select schedule.lock_version from public.schedule_versions schedule where schedule.id = target_schedule_version_id)
  );
end;
$$;

create or replace function public.update_planning_assignment(
  target_schedule_version_id uuid,
  target_assignment_id uuid,
  target_agent_id uuid,
  target_position_id uuid,
  target_port_call_id uuid,
  shift_starts_at timestamptz,
  shift_ends_at timestamptz,
  shift_break_minutes integer,
  shift_note text,
  expected_lock_version bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if expected_lock_version is null or expected_lock_version < 0 then
    raise exception using errcode = 'P2030', message = 'A valid expected lock version is required.';
  end if;

  perform set_config('app.expected_schedule_lock_version', expected_lock_version::text, true);
  perform set_config('app.expected_schedule_lock_verified', '', true);

  result := public.update_planning_assignment(
    target_schedule_version_id,
    target_assignment_id,
    target_agent_id,
    target_position_id,
    target_port_call_id,
    shift_starts_at,
    shift_ends_at,
    shift_break_minutes,
    shift_note
  );

  perform set_config('app.expected_schedule_lock_version', '', true);
  perform set_config('app.expected_schedule_lock_verified', '', true);

  return result || jsonb_build_object(
    'lockVersion',
    (select schedule.lock_version from public.schedule_versions schedule where schedule.id = target_schedule_version_id)
  );
end;
$$;

create or replace function public.delete_planning_assignment(
  target_schedule_version_id uuid,
  target_assignment_id uuid,
  expected_lock_version bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if expected_lock_version is null or expected_lock_version < 0 then
    raise exception using errcode = 'P2030', message = 'A valid expected lock version is required.';
  end if;

  perform set_config('app.expected_schedule_lock_version', expected_lock_version::text, true);
  perform set_config('app.expected_schedule_lock_verified', '', true);

  result := public.delete_planning_assignment(
    target_schedule_version_id,
    target_assignment_id
  );

  perform set_config('app.expected_schedule_lock_version', '', true);
  perform set_config('app.expected_schedule_lock_verified', '', true);

  return result || jsonb_build_object(
    'lockVersion',
    (select schedule.lock_version from public.schedule_versions schedule where schedule.id = target_schedule_version_id)
  );
end;
$$;

create or replace function public.publish_schedule_version(
  target_schedule_version_id uuid,
  publication_reason text,
  expected_lock_version bigint
)
returns public.schedule_versions
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_lock_version bigint;
begin
  if expected_lock_version is null or expected_lock_version < 0 then
    raise exception using errcode = 'P2030', message = 'A valid expected lock version is required.';
  end if;

  select schedule.lock_version
  into current_lock_version
  from public.schedule_versions schedule
  where schedule.id = target_schedule_version_id
  for update;

  if not found then
    raise exception 'Schedule version not found';
  end if;

  if current_lock_version <> expected_lock_version then
    raise exception using
      errcode = 'P2031',
      message = format(
        'Schedule changed concurrently (expected version %s, current version %s).',
        expected_lock_version,
        current_lock_version
      );
  end if;

  return public.publish_schedule_version(
    target_schedule_version_id,
    publication_reason
  );
end;
$$;

revoke all on function public.create_planning_shift(
  uuid, uuid, timestamptz, timestamptz, integer, uuid, uuid, text, bigint
) from public;
revoke all on function public.move_planning_assignment(
  uuid, uuid, date, uuid, bigint
) from public;
revoke all on function public.update_planning_assignment(
  uuid, uuid, uuid, uuid, uuid, timestamptz, timestamptz, integer, text, bigint
) from public;
revoke all on function public.delete_planning_assignment(uuid, uuid, bigint)
from public;
revoke all on function public.publish_schedule_version(uuid, text, bigint)
from public;

grant execute on function public.create_planning_shift(
  uuid, uuid, timestamptz, timestamptz, integer, uuid, uuid, text, bigint
) to authenticated;
grant execute on function public.move_planning_assignment(
  uuid, uuid, date, uuid, bigint
) to authenticated;
grant execute on function public.update_planning_assignment(
  uuid, uuid, uuid, uuid, uuid, timestamptz, timestamptz, integer, text, bigint
) to authenticated;
grant execute on function public.delete_planning_assignment(uuid, uuid, bigint)
to authenticated;
grant execute on function public.publish_schedule_version(uuid, text, bigint)
to authenticated;

-- Read the complete schedule through one bounded PostgREST RPC instead of
-- serializing every shift UUID into an `.in(...)` query. SECURITY INVOKER is
-- intentional: all four source tables keep applying the caller's RLS scope.
create or replace function public.get_schedule_content(
  target_schedule_version_id uuid
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'version', to_jsonb(schedule),
    'period', to_jsonb(period),
    'shifts', coalesce(
      (
        select jsonb_agg(to_jsonb(shift) order by shift.starts_at, shift.id)
        from public.planning_shifts shift
        where shift.schedule_version_id = schedule.id
      ),
      '[]'::jsonb
    ),
    'assignments', coalesce(
      (
        select jsonb_agg(
          to_jsonb(assignment)
          order by assignment.starts_at, assignment.id
        )
        from public.shift_assignments assignment
        join public.planning_shifts assignment_shift
          on assignment_shift.id = assignment.planning_shift_id
        where assignment_shift.schedule_version_id = schedule.id
      ),
      '[]'::jsonb
    )
  )
  from public.schedule_versions schedule
  join public.planning_periods period
    on period.id = schedule.planning_period_id
  where schedule.id = target_schedule_version_id;
$$;

revoke all on function public.get_schedule_content(uuid) from public;
grant execute on function public.get_schedule_content(uuid) to authenticated;

-- Reads remain available through RLS. Mutations are intentionally limited to
-- the security-definer commands and the service role used by trusted jobs.
revoke insert, update, delete on public.planning_periods from authenticated;
revoke insert, update, delete on public.schedule_versions from authenticated;
revoke insert, update, delete on public.staffing_requirements from authenticated;
revoke insert, update, delete on public.planning_shifts from authenticated;
revoke insert, update, delete on public.shift_assignments from authenticated;

comment on column public.schedule_versions.superseded_at is
  'Set when another draft becomes the sole editable version for the planning period.';
comment on column public.schedule_versions.lock_version is
  'Monotonic optimistic-concurrency token incremented by planning content and requirement mutations.';
comment on function public.validate_schedule_version_integrity(uuid) is
  'Revalidates publication readiness, employment, availability, restrictions, mandatory skills, coverage and fundamental planning rules.';
comment on function public.schedule_version_coverage_gaps(uuid) is
  'Returns every interval where distinct assigned agents do not satisfy a current staffing requirement.';
comment on function public.get_schedule_content(uuid) is
  'Returns one RLS-filtered schedule snapshot without encoding shift identifiers in a PostgREST URL.';
