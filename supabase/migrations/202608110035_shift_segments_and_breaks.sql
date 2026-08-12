-- A shift is the duty envelope for one agent. Position assignments are
-- non-overlapping responsibility segments inside that envelope and breaks are
-- first-class intervals. This keeps the legacy break_minutes column as a
-- derived compatibility value while making coverage and future edits exact.

create table public.planning_shift_breaks (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null,
  site_id uuid not null,
  planning_shift_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  label text check (label is null or char_length(label) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint planning_shift_breaks_shift_same_organization
    foreign key (planning_shift_id, organization_id)
    references public.planning_shifts (id, organization_id) on delete cascade,
  constraint planning_shift_breaks_site_same_organization
    foreign key (site_id, organization_id)
    references public.sites (id, organization_id) on delete restrict,
  constraint planning_shift_breaks_positive_duration
    check (ends_at > starts_at),
  constraint planning_shift_breaks_whole_minutes
    check (mod(extract(epoch from (ends_at - starts_at))::numeric, 60) = 0)
);

alter table public.planning_shift_breaks
  add constraint planning_shift_breaks_no_overlap
  exclude using gist (
    planning_shift_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) deferrable initially immediate;

create index planning_shift_breaks_shift_time
  on public.planning_shift_breaks (planning_shift_id, starts_at, ends_at);

-- Preserve every historical duration by materializing it as a deterministic
-- centred interval. No assignment row is rewritten or discarded.
insert into public.planning_shift_breaks (
  organization_id,
  site_id,
  planning_shift_id,
  starts_at,
  ends_at,
  label
)
select
  shift.organization_id,
  shift.site_id,
  shift.id,
  shift.starts_at
    + ((shift.ends_at - shift.starts_at)
      - make_interval(mins => shift.break_minutes)) / 2,
  shift.starts_at
    + ((shift.ends_at - shift.starts_at)
      - make_interval(mins => shift.break_minutes)) / 2
    + make_interval(mins => shift.break_minutes),
  'Pause reprise de l’historique'
from public.planning_shifts shift
where shift.break_minutes > 0;

create or replace function public.validate_planning_shift_break_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent_shift public.planning_shifts;
begin
  if tg_op = 'UPDATE' and (
    new.planning_shift_id <> old.planning_shift_id
    or new.organization_id <> old.organization_id
    or new.site_id <> old.site_id
  ) then
    raise exception using
      errcode = 'P2060',
      message = 'Le service et le périmètre d’une pause sont immuables.';
  end if;

  select shift.* into parent_shift
  from public.planning_shifts shift
  where shift.id = new.planning_shift_id;

  if parent_shift.id is null then
    raise exception using
      errcode = 'P2060',
      message = 'Service de la pause introuvable.';
  end if;

  if new.organization_id <> parent_shift.organization_id
    or new.site_id <> parent_shift.site_id then
    raise exception using
      errcode = 'P2060',
      message = 'La pause doit appartenir au périmètre du service.';
  end if;

  if new.starts_at < parent_shift.starts_at
    or new.ends_at > parent_shift.ends_at then
    raise exception using
      errcode = 'P2061',
      message = 'La pause doit rester entièrement dans le service.';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_planning_shift_break_row()
from public, anon, authenticated;

create trigger planning_shift_breaks_10_validate
before insert or update of
  organization_id,
  site_id,
  planning_shift_id,
  starts_at,
  ends_at
on public.planning_shift_breaks
for each row execute function public.validate_planning_shift_break_row();

-- Existing installations can contain overlapping legacy segments. They are
-- retained for lossless migration, but every new or changed segment is
-- serialized and rejected if it overlaps another position in the same shift.
-- Publication below also detects any untouched legacy overlap.
create or replace function public.validate_shift_assignment_segment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent_shift public.planning_shifts;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.planning_shift_id::text, 202608110035)
  );

  select shift.* into parent_shift
  from public.planning_shifts shift
  where shift.id = new.planning_shift_id;

  if parent_shift.id is null then
    raise exception using
      errcode = 'P2060',
      message = 'Service du segment introuvable.';
  end if;

  if new.organization_id <> parent_shift.organization_id
    or new.site_id <> parent_shift.site_id
    or new.starts_at < parent_shift.starts_at
    or new.ends_at > parent_shift.ends_at then
    raise exception using
      errcode = 'P2061',
      message = 'Le segment doit rester entièrement dans le service et son périmètre.';
  end if;

  if exists (
    select 1
    from public.shift_assignments assignment
    where assignment.planning_shift_id = new.planning_shift_id
      and assignment.id <> new.id
      and tstzrange(assignment.starts_at, assignment.ends_at, '[)')
        && tstzrange(new.starts_at, new.ends_at, '[)')
  ) then
    raise exception using
      errcode = 'P2062',
      message = 'Deux postes d’un même service ne peuvent pas se chevaucher.';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_shift_assignment_segment()
from public, anon, authenticated;

create trigger shift_assignments_10_validate_segment
before insert or update of
  organization_id,
  site_id,
  planning_shift_id,
  starts_at,
  ends_at
on public.shift_assignments
for each row execute function public.validate_shift_assignment_segment();

create or replace function public.sync_shift_break_minutes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_shift_id uuid;
  deleting_shift_id text;
  previous_sync_flag text;
  total_minutes integer;
begin
  target_shift_id := case
    when tg_op = 'DELETE' then old.planning_shift_id
    else new.planning_shift_id
  end;
  deleting_shift_id := nullif(
    current_setting('app.deleting_planning_shift_id', true),
    ''
  );

  if deleting_shift_id = target_shift_id::text then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if current_setting('app.syncing_planning_shift_breaks', true) = 'on' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  select coalesce(sum(
    extract(epoch from (pause.ends_at - pause.starts_at)) / 60
  ), 0)::integer
  into total_minutes
  from public.planning_shift_breaks pause
  where pause.planning_shift_id = target_shift_id;

  previous_sync_flag := current_setting(
    'app.syncing_planning_shift_breaks',
    true
  );
  perform set_config('app.syncing_planning_shift_breaks', 'on', true);

  update public.planning_shifts shift
  set break_minutes = total_minutes,
      updated_at = now()
  where shift.id = target_shift_id
    and shift.break_minutes <> total_minutes;

  perform set_config(
    'app.syncing_planning_shift_breaks',
    coalesce(previous_sync_flag, ''),
    true
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.sync_shift_break_minutes()
from public, anon, authenticated;

create trigger planning_shift_breaks_90_sync_duration
after insert or update of planning_shift_id, starts_at, ends_at or delete
on public.planning_shift_breaks
for each row execute function public.sync_shift_break_minutes();

-- Legacy/internal shift creation still supplies break_minutes. Materialize a
-- real interval automatically. Clones preserve the exact relative placement
-- whenever their duration is unchanged; moves translate existing intervals.
create or replace function public.materialize_planning_shift_breaks()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_sync_flag text;
  source_shift public.planning_shifts;
  current_break_minutes integer;
  start_delta interval;
begin
  if current_setting('app.syncing_planning_shift_breaks', true) = 'on' then
    return new;
  end if;

  previous_sync_flag := current_setting(
    'app.syncing_planning_shift_breaks',
    true
  );
  perform set_config('app.syncing_planning_shift_breaks', 'on', true);

  if tg_op = 'INSERT' then
    if new.break_minutes > 0 then
      if new.source_shift_id is not null then
        select shift.* into source_shift
        from public.planning_shifts shift
        where shift.id = new.source_shift_id;
      end if;

      if source_shift.id is not null
        and new.ends_at - new.starts_at
          = source_shift.ends_at - source_shift.starts_at
        and exists (
          select 1
          from public.planning_shift_breaks pause
          where pause.planning_shift_id = source_shift.id
        ) then
        start_delta := new.starts_at - source_shift.starts_at;

        insert into public.planning_shift_breaks (
          organization_id,
          site_id,
          planning_shift_id,
          starts_at,
          ends_at,
          label
        )
        select
          new.organization_id,
          new.site_id,
          new.id,
          pause.starts_at + start_delta,
          pause.ends_at + start_delta,
          pause.label
        from public.planning_shift_breaks pause
        where pause.planning_shift_id = source_shift.id
        order by pause.starts_at, pause.id;
      else
        insert into public.planning_shift_breaks (
          organization_id,
          site_id,
          planning_shift_id,
          starts_at,
          ends_at,
          label
        ) values (
          new.organization_id,
          new.site_id,
          new.id,
          new.starts_at
            + ((new.ends_at - new.starts_at)
              - make_interval(mins => new.break_minutes)) / 2,
          new.starts_at
            + ((new.ends_at - new.starts_at)
              - make_interval(mins => new.break_minutes)) / 2
            + make_interval(mins => new.break_minutes),
          'Pause'
        );
      end if;
    end if;
  else
    select coalesce(sum(
      extract(epoch from (pause.ends_at - pause.starts_at)) / 60
    ), 0)::integer
    into current_break_minutes
    from public.planning_shift_breaks pause
    where pause.planning_shift_id = new.id;

    if new.break_minutes is distinct from old.break_minutes
      and new.break_minutes <> current_break_minutes then
      delete from public.planning_shift_breaks pause
      where pause.planning_shift_id = new.id;

      if new.break_minutes > 0 then
        insert into public.planning_shift_breaks (
          organization_id,
          site_id,
          planning_shift_id,
          starts_at,
          ends_at,
          label
        ) values (
          new.organization_id,
          new.site_id,
          new.id,
          new.starts_at
            + ((new.ends_at - new.starts_at)
              - make_interval(mins => new.break_minutes)) / 2,
          new.starts_at
            + ((new.ends_at - new.starts_at)
              - make_interval(mins => new.break_minutes)) / 2
            + make_interval(mins => new.break_minutes),
          'Pause'
        );
      end if;
    elsif (new.starts_at, new.ends_at)
      is distinct from (old.starts_at, old.ends_at) then
      start_delta := new.starts_at - old.starts_at;

      if exists (
        select 1
        from public.planning_shift_breaks pause
        where pause.planning_shift_id = new.id
          and (
            pause.starts_at + start_delta < new.starts_at
            or pause.ends_at + start_delta > new.ends_at
          )
      ) then
        raise exception using
          errcode = 'P2061',
          message = 'Le nouveau service ne peut pas contenir ses pauses existantes.';
      end if;

      set constraints planning_shift_breaks_no_overlap deferred;

      update public.planning_shift_breaks pause
      set starts_at = pause.starts_at + start_delta,
          ends_at = pause.ends_at + start_delta,
          updated_at = now()
      where pause.planning_shift_id = new.id;

      set constraints planning_shift_breaks_no_overlap immediate;
    end if;
  end if;

  perform set_config(
    'app.syncing_planning_shift_breaks',
    coalesce(previous_sync_flag, ''),
    true
  );
  return new;
end;
$$;

revoke all on function public.materialize_planning_shift_breaks()
from public, anon, authenticated;

create trigger planning_shifts_90_materialize_breaks
after insert or update of starts_at, ends_at, break_minutes, source_shift_id
on public.planning_shifts
for each row execute function public.materialize_planning_shift_breaks();

-- Reuse the established draft/CAS guard and lock bump machinery for breaks.
create trigger planning_shift_breaks_00_protect_draft
before insert or update or delete on public.planning_shift_breaks
for each row execute function public.protect_schedule_content();

create trigger planning_shift_breaks_bump_schedule_lock
after insert or update or delete on public.planning_shift_breaks
for each row execute function public.bump_schedule_lock_from_content();

create trigger planning_shift_breaks_set_updated_at
before update on public.planning_shift_breaks
for each row execute function public.set_updated_at();

create trigger planning_shift_breaks_audit
after insert or update or delete on public.planning_shift_breaks
for each row execute function public.capture_table_audit();

-- Make parent deletion explicit so child protection can still resolve the
-- schedule before PostgreSQL removes the parent from the transaction snapshot.
create or replace function public.delete_shift_assignments_before_parent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_deleting_shift_id text;
begin
  previous_deleting_shift_id := current_setting(
    'app.deleting_planning_shift_id',
    true
  );
  perform set_config(
    'app.deleting_planning_shift_id',
    old.id::text,
    true
  );

  delete from public.planning_shift_breaks pause
  where pause.planning_shift_id = old.id;

  delete from public.shift_assignments assignment
  where assignment.planning_shift_id = old.id;

  perform set_config(
    'app.deleting_planning_shift_id',
    coalesce(previous_deleting_shift_id, ''),
    true
  );
  return old;
end;
$$;

revoke all on function public.delete_shift_assignments_before_parent()
from public, anon, authenticated;

drop trigger if exists planning_shifts_delete_assignments_before_parent
on public.planning_shifts;

create trigger planning_shifts_delete_assignments_before_parent
before delete on public.planning_shifts
for each row execute function public.delete_shift_assignments_before_parent();

create or replace function public.validate_planning_shift_timeline(
  target_planning_shift_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_shift public.planning_shifts;
  first_invalid record;
  stored_break_minutes integer;
begin
  select shift.* into target_shift
  from public.planning_shifts shift
  where shift.id = target_planning_shift_id;

  if target_shift.id is null then
    raise exception using
      errcode = 'P2060',
      message = 'Service introuvable.';
  end if;

  with ordered_segments as (
    select
      assignment.id,
      assignment.starts_at,
      assignment.ends_at,
      lag(assignment.ends_at) over (
        order by assignment.starts_at, assignment.ends_at, assignment.id
      ) as previous_ends_at,
      row_number() over (
        order by assignment.starts_at, assignment.ends_at, assignment.id
      ) as segment_number,
      count(*) over () as segment_count
    from public.shift_assignments assignment
    where assignment.planning_shift_id = target_shift.id
  )
  select segment.* into first_invalid
  from ordered_segments segment
  where (segment.segment_number = 1
      and segment.starts_at <> target_shift.starts_at)
    or (segment.previous_ends_at is not null
      and segment.starts_at <> segment.previous_ends_at)
    or (segment.segment_number = segment.segment_count
      and segment.ends_at <> target_shift.ends_at)
  order by segment.segment_number
  limit 1;

  if found then
    if first_invalid.previous_ends_at is not null
      and first_invalid.starts_at < first_invalid.previous_ends_at then
      raise exception using
        errcode = 'P2062',
        message = 'Deux postes d’un même service se chevauchent.';
    end if;

    raise exception using
      errcode = 'P2063',
      message = 'Les segments doivent couvrir le service sans intervalle vide.';
  end if;

  if not exists (
    select 1
    from public.shift_assignments assignment
    where assignment.planning_shift_id = target_shift.id
  ) then
    raise exception using
      errcode = 'P2063',
      message = 'Le service doit contenir au moins un segment de poste.';
  end if;

  if exists (
    select 1
    from public.planning_shift_breaks first_break
    join public.planning_shift_breaks second_break
      on second_break.planning_shift_id = first_break.planning_shift_id
      and second_break.id > first_break.id
      and tstzrange(second_break.starts_at, second_break.ends_at, '[)')
        && tstzrange(first_break.starts_at, first_break.ends_at, '[)')
    where first_break.planning_shift_id = target_shift.id
  ) then
    raise exception using
      errcode = 'P2064',
      message = 'Deux pauses d’un même service se chevauchent.';
  end if;

  select coalesce(sum(
    extract(epoch from (pause.ends_at - pause.starts_at)) / 60
  ), 0)::integer
  into stored_break_minutes
  from public.planning_shift_breaks pause
  where pause.planning_shift_id = target_shift.id;

  if stored_break_minutes <> target_shift.break_minutes then
    raise exception using
      errcode = 'P2065',
      message = 'La durée de pause du service est incohérente.';
  end if;
end;
$$;

revoke all on function public.validate_planning_shift_timeline(uuid)
from public, anon, authenticated;

create or replace function public.planning_shift_planned_minutes(
  target_planning_shift_id uuid
)
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select greatest(
    0,
    floor(extract(epoch from (shift.ends_at - shift.starts_at)) / 60)::integer
      - coalesce((
        select sum(
          extract(epoch from (pause.ends_at - pause.starts_at)) / 60
        )::integer
        from public.planning_shift_breaks pause
        where pause.planning_shift_id = shift.id
      ), 0)
  )
  from public.planning_shifts shift
  where shift.id = target_planning_shift_id;
$$;

revoke all on function public.planning_shift_planned_minutes(uuid)
from public, anon, authenticated;
grant execute on function public.planning_shift_planned_minutes(uuid)
to authenticated;

create or replace function public.validate_schedule_shift_timelines(
  target_schedule_version_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_shift_id uuid;
begin
  for target_shift_id in
    select shift.id
    from public.planning_shifts shift
    where shift.schedule_version_id = target_schedule_version_id
    order by shift.starts_at, shift.id
  loop
    perform public.validate_planning_shift_timeline(target_shift_id);
  end loop;
end;
$$;

revoke all on function public.validate_schedule_shift_timelines(uuid)
from public, anon, authenticated;

create or replace function public.validate_shift_timelines_on_publish()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'published' and old.status <> 'published' then
    perform public.validate_schedule_shift_timelines(new.id);
  end if;
  return new;
end;
$$;

revoke all on function public.validate_shift_timelines_on_publish()
from public, anon, authenticated;

drop trigger if exists schedule_versions_04_validate_shift_timelines
on public.schedule_versions;

create trigger schedule_versions_04_validate_shift_timelines
before update of status on public.schedule_versions
for each row execute function public.validate_shift_timelines_on_publish();

-- Break intervals split coverage at their exact boundaries. An assignment is
-- counted only if it covers the complete sub-interval and its agent is not on
-- a break at any point in that interval.
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
  with active_requirements as (
    select requirement.*
    from public.schedule_effective_requirements(
      target_schedule_version_id
    ) requirement
  ),
  matching_assignments as (
    select
      requirement.id as requirement_id,
      shift.id as shift_id,
      shift.agent_id,
      greatest(requirement.starts_at, assignment.starts_at) as covered_from,
      least(requirement.ends_at, assignment.ends_at) as covered_until
    from active_requirements requirement
    join public.planning_shifts shift
      on shift.schedule_version_id = target_schedule_version_id
    join public.shift_assignments assignment
      on assignment.planning_shift_id = shift.id
      and assignment.position_id = requirement.position_id
      and tstzrange(assignment.starts_at, assignment.ends_at, '[)')
        && tstzrange(requirement.starts_at, requirement.ends_at, '[)')
      and assignment.staffing_requirement_id = requirement.id
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
    union
    select
      assignment.requirement_id,
      greatest(pause.starts_at, requirement.starts_at)
    from matching_assignments assignment
    join active_requirements requirement
      on requirement.id = assignment.requirement_id
    join public.planning_shift_breaks pause
      on pause.planning_shift_id = assignment.shift_id
      and tstzrange(pause.starts_at, pause.ends_at, '[)')
        && tstzrange(requirement.starts_at, requirement.ends_at, '[)')
    union
    select
      assignment.requirement_id,
      least(pause.ends_at, requirement.ends_at)
    from matching_assignments assignment
    join active_requirements requirement
      on requirement.id = assignment.requirement_id
    join public.planning_shift_breaks pause
      on pause.planning_shift_id = assignment.shift_id
      and tstzrange(pause.starts_at, pause.ends_at, '[)')
        && tstzrange(requirement.starts_at, requirement.ends_at, '[)')
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
  ),
  segment_coverage as (
    select
      requirement.id as requirement_id,
      segment.segment_start,
      segment.segment_end,
      requirement.required_agents,
      count(distinct assignment.agent_id) filter (
        where assignment.covered_from <= segment.segment_start
          and assignment.covered_until >= segment.segment_end
          and not exists (
            select 1
            from public.planning_shift_breaks pause
            where pause.planning_shift_id = assignment.shift_id
              and tstzrange(pause.starts_at, pause.ends_at, '[)')
                && tstzrange(
                  segment.segment_start,
                  segment.segment_end,
                  '[)'
                )
          )
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
  )
  select
    coverage.requirement_id,
    coverage.segment_start,
    coverage.segment_end,
    coverage.required_agents::integer,
    coverage.assigned_agents
  from segment_coverage coverage
  where coverage.assigned_agents < coverage.required_agents;
$$;

revoke all on function public.schedule_version_coverage_gaps(uuid)
from public, anon, authenticated;

-- Full-service replacement is the unambiguous command for a multi-position
-- shift. target_shift_id = null creates a service; otherwise all segments and
-- breaks are replaced atomically after one optimistic-concurrency check.
create or replace function public.replace_planning_shift_service(
  target_schedule_version_id uuid,
  target_shift_id uuid,
  target_agent_id uuid,
  shift_starts_at timestamptz,
  shift_ends_at timestamptz,
  shift_segments jsonb,
  shift_breaks jsonb,
  shift_note text,
  expected_lock_version bigint
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
  previous_shift public.planning_shifts;
  saved_shift public.planning_shifts;
  segment_spec record;
  break_spec record;
  selected_requirement_id uuid;
  previous_expected_lock text;
  previous_verified_lock text;
begin
  if expected_lock_version is null or expected_lock_version < 0 then
    raise exception using
      errcode = 'P2030',
      message = 'A valid expected lock version is required.';
  end if;

  select schedule.* into target_schedule
  from public.schedule_versions schedule
  where schedule.id = target_schedule_version_id
  for update;

  if target_schedule.id is null then
    raise exception using errcode = 'P2020', message = 'Planning introuvable.';
  end if;

  if target_schedule.lock_version <> expected_lock_version then
    raise exception using
      errcode = 'P2031',
      message = format(
        'Schedule changed concurrently (expected version %s, current version %s).',
        expected_lock_version,
        target_schedule.lock_version
      );
  end if;

  previous_expected_lock := current_setting(
    'app.expected_schedule_lock_version',
    true
  );
  previous_verified_lock := current_setting(
    'app.expected_schedule_lock_verified',
    true
  );
  perform set_config('app.expected_schedule_lock_version', '', true);
  perform set_config('app.expected_schedule_lock_verified', '', true);

  if target_schedule.status <> 'draft'
    or target_schedule.superseded_at is not null then
    raise exception using
      errcode = 'P2021',
      message = 'Seul le brouillon courant peut être modifié.';
  end if;

  if not public.has_role(
    target_schedule.organization_id,
    target_schedule.site_id,
    array['platform_admin', 'planning_admin', 'planner']::public.app_role[]
  ) then
    raise exception 'Insufficient permissions';
  end if;

  if shift_ends_at <= shift_starts_at then
    raise exception using
      errcode = 'P2023',
      message = 'L’heure de fin doit suivre l’heure de début.';
  end if;

  if shift_note is not null and char_length(shift_note) > 500 then
    raise exception using
      errcode = 'P2023',
      message = 'La note est limitée à 500 caractères.';
  end if;

  if coalesce(jsonb_typeof(shift_segments), 'null') <> 'array'
    or jsonb_array_length(shift_segments) not between 1 and 100
    or exists (
      select 1 from jsonb_array_elements(shift_segments) item
      where jsonb_typeof(item) <> 'object'
        or nullif(item ->> 'positionId', '') is null
        or nullif(item ->> 'startsAt', '') is null
        or nullif(item ->> 'endsAt', '') is null
    ) then
    raise exception using
      errcode = 'P2066',
      message = 'Entre 1 et 100 segments de poste valides sont requis.';
  end if;

  if coalesce(jsonb_typeof(shift_breaks), 'null') <> 'array'
    or jsonb_array_length(shift_breaks) > 20
    or exists (
      select 1 from jsonb_array_elements(shift_breaks) item
      where jsonb_typeof(item) <> 'object'
        or nullif(item ->> 'startsAt', '') is null
        or nullif(item ->> 'endsAt', '') is null
    ) then
    raise exception using
      errcode = 'P2066',
      message = 'Les pauses doivent être un tableau de 20 intervalles au maximum.';
  end if;

  select period.* into target_period
  from public.planning_periods period
  where period.id = target_schedule.planning_period_id;

  if not public.shift_is_within_planning_period(
    target_period.id,
    shift_starts_at,
    shift_ends_at
  ) then
    raise exception using
      errcode = 'P2023',
      message = 'Le service doit rester dans cette période.';
  end if;

  select agent.* into target_agent
  from public.agents agent
  where agent.id = target_agent_id
    and agent.organization_id = target_schedule.organization_id
    and agent.primary_site_id = target_schedule.site_id
    and agent.active = true;

  if target_agent.id is null then
    raise exception using
      errcode = 'P2024',
      message = 'Cet agent actif n’appartient pas à cette zone.';
  end if;

  if (target_agent.hired_on is not null and target_agent.hired_on
      > (shift_starts_at at time zone target_period.timezone)::date)
    or (target_agent.left_on is not null and target_agent.left_on
      < ((shift_ends_at - interval '1 microsecond')
        at time zone target_period.timezone)::date) then
    raise exception using
      errcode = 'P2024',
      message = 'L’agent n’est pas employé pendant tout le service.';
  end if;

  if not exists (
    select 1
    from public.agent_contract_versions contract
    where contract.agent_id = target_agent.id
      and contract.organization_id = target_schedule.organization_id
      and contract.effective_from
        <= (shift_starts_at at time zone target_period.timezone)::date
      and (
        contract.effective_until is null
        or contract.effective_until >= (
          (shift_ends_at - interval '1 microsecond')
            at time zone target_period.timezone
        )::date
      )
  ) then
    raise exception using
      errcode = 'P2045',
      message = 'Le service doit être couvert par un contrat actif.';
  end if;

  if exists (
    select 1
    from public.agent_unavailability unavailable
    where unavailable.agent_id = target_agent.id
      and unavailable.organization_id = target_schedule.organization_id
      and tstzrange(unavailable.starts_at, unavailable.ends_at, '[)')
        && tstzrange(shift_starts_at, shift_ends_at, '[)')
  ) then
    raise exception using
      errcode = 'P2025',
      message = 'L’agent est indisponible pendant ce service.';
  end if;

  if target_shift_id is not null then
    select shift.* into previous_shift
    from public.planning_shifts shift
    where shift.id = target_shift_id
      and shift.schedule_version_id = target_schedule.id
    for update;

    if previous_shift.id is null then
      raise exception using errcode = 'P2020', message = 'Service introuvable.';
    end if;

    if exists (
      select 1
      from public.time_ledger_entries ledger
      where ledger.planning_shift_id = previous_shift.id
        and ledger.worked_minutes is not null
    ) then
      raise exception using
        errcode = 'P2028',
        message = 'Ce service contient déjà des heures réalisées.';
    end if;

    delete from public.shift_assignments assignment
    where assignment.planning_shift_id = previous_shift.id;

    delete from public.planning_shift_breaks pause
    where pause.planning_shift_id = previous_shift.id;

    update public.planning_shifts shift
    set agent_id = target_agent.id,
        starts_at = shift_starts_at,
        ends_at = shift_ends_at,
        break_minutes = 0,
        origin = 'manual',
        note = nullif(trim(shift_note), ''),
        updated_at = now()
    where shift.id = previous_shift.id
    returning shift.* into saved_shift;
  else
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
      0,
      'manual',
      nullif(trim(shift_note), ''),
      (select auth.uid())
    ) returning * into saved_shift;
  end if;

  for segment_spec in
    select
      item.ordinality,
      (item.value ->> 'positionId')::uuid as position_id,
      nullif(item.value ->> 'portCallId', '')::uuid as port_call_id,
      nullif(item.value ->> 'staffingRequirementId', '')::uuid
        as staffing_requirement_id,
      (item.value ->> 'startsAt')::timestamptz as starts_at,
      (item.value ->> 'endsAt')::timestamptz as ends_at
    from jsonb_array_elements(shift_segments)
      with ordinality as item(value, ordinality)
    order by item.ordinality
  loop
    if segment_spec.ends_at <= segment_spec.starts_at
      or segment_spec.starts_at < saved_shift.starts_at
      or segment_spec.ends_at > saved_shift.ends_at then
      raise exception using
        errcode = 'P2061',
        message = 'Chaque segment doit être positif et rester dans le service.';
    end if;

    if not exists (
      select 1
      from public.positions position
      where position.id = segment_spec.position_id
        and position.organization_id = target_schedule.organization_id
        and (position.site_id is null
          or position.site_id = target_schedule.site_id)
        and position.active = true
    ) then
      raise exception using
        errcode = 'P2024',
        message = 'Un poste n’est pas disponible dans cette zone.';
    end if;

    if segment_spec.port_call_id is not null and not exists (
      select 1
      from public.port_calls port_call
      where port_call.id = segment_spec.port_call_id
        and port_call.organization_id = target_schedule.organization_id
        and port_call.site_id = target_schedule.site_id
        and port_call.status <> 'cancelled'
    ) then
      raise exception using
        errcode = 'P2024',
        message = 'Une escale est absente, hors périmètre ou annulée.';
    end if;

    if exists (
      select 1
      from public.agent_position_restrictions restriction
      where restriction.agent_id = target_agent.id
        and restriction.position_id = segment_spec.position_id
        and restriction.organization_id = target_schedule.organization_id
        and restriction.valid_from <= (
          (segment_spec.ends_at - interval '1 microsecond')
            at time zone target_period.timezone
        )::date
        and (
          restriction.valid_until is null
          or restriction.valid_until >= (
            segment_spec.starts_at at time zone target_period.timezone
          )::date
        )
    ) then
      raise exception using
        errcode = 'P2026',
        message = 'Un poste est interdit pour cet agent.';
    end if;

    if exists (
      select 1
      from public.position_skill_requirements requirement
      where requirement.position_id = segment_spec.position_id
        and requirement.organization_id = target_schedule.organization_id
        and requirement.mandatory = true
        and not exists (
          select 1
          from public.agent_skills agent_skill
          where agent_skill.agent_id = target_agent.id
            and agent_skill.skill_id = requirement.skill_id
            and agent_skill.organization_id = target_schedule.organization_id
            and agent_skill.level >= requirement.minimum_level
            and agent_skill.valid_from <= (
              segment_spec.starts_at at time zone target_period.timezone
            )::date
            and (
              agent_skill.valid_until is null
              or agent_skill.valid_until >= (
                (segment_spec.ends_at - interval '1 microsecond')
                  at time zone target_period.timezone
              )::date
            )
        )
    ) then
      raise exception using
        errcode = 'P2027',
        message = 'L’agent ne possède pas les habilitations requises.';
    end if;

    selected_requirement_id := segment_spec.staffing_requirement_id;
    if selected_requirement_id is null then
      select requirement.id into selected_requirement_id
      from public.schedule_effective_requirements(target_schedule.id) requirement
      where requirement.position_id = segment_spec.position_id
        and requirement.port_call_id is not distinct
          from segment_spec.port_call_id
        and tstzrange(requirement.starts_at, requirement.ends_at, '[)')
          && tstzrange(segment_spec.starts_at, segment_spec.ends_at, '[)')
      order by
        abs(extract(epoch from requirement.starts_at - segment_spec.starts_at)),
        requirement.starts_at,
        requirement.id
      limit 1;
    elsif not exists (
      select 1
      from public.schedule_effective_requirements(target_schedule.id) requirement
      where requirement.id = selected_requirement_id
        and requirement.position_id = segment_spec.position_id
        and requirement.port_call_id is not distinct
          from segment_spec.port_call_id
        and tstzrange(requirement.starts_at, requirement.ends_at, '[)')
          && tstzrange(segment_spec.starts_at, segment_spec.ends_at, '[)')
    ) then
      raise exception using
        errcode = 'P2053',
        message = 'Un besoin référencé est incompatible avec son segment.';
    end if;

    insert into public.shift_assignments (
      organization_id,
      site_id,
      planning_shift_id,
      position_id,
      staffing_requirement_id,
      port_call_id,
      starts_at,
      ends_at
    ) values (
      target_schedule.organization_id,
      target_schedule.site_id,
      saved_shift.id,
      segment_spec.position_id,
      selected_requirement_id,
      segment_spec.port_call_id,
      segment_spec.starts_at,
      segment_spec.ends_at
    );
  end loop;

  for break_spec in
    select
      item.ordinality,
      (item.value ->> 'startsAt')::timestamptz as starts_at,
      (item.value ->> 'endsAt')::timestamptz as ends_at,
      nullif(trim(item.value ->> 'label'), '') as label
    from jsonb_array_elements(shift_breaks)
      with ordinality as item(value, ordinality)
    order by item.ordinality
  loop
    if break_spec.ends_at <= break_spec.starts_at
      or break_spec.starts_at < saved_shift.starts_at
      or break_spec.ends_at > saved_shift.ends_at
      or mod(
        extract(epoch from (break_spec.ends_at - break_spec.starts_at))::numeric,
        60
      ) <> 0 then
      raise exception using
        errcode = 'P2061',
        message = 'Chaque pause doit être positive, en minutes entières et rester dans le service.';
    end if;

    if break_spec.label is not null and char_length(break_spec.label) > 120 then
      raise exception using
        errcode = 'P2066',
        message = 'Le libellé d’une pause est limité à 120 caractères.';
    end if;

    insert into public.planning_shift_breaks (
      organization_id,
      site_id,
      planning_shift_id,
      starts_at,
      ends_at,
      label
    ) values (
      target_schedule.organization_id,
      target_schedule.site_id,
      saved_shift.id,
      break_spec.starts_at,
      break_spec.ends_at,
      break_spec.label
    );
  end loop;

  select shift.* into saved_shift
  from public.planning_shifts shift
  where shift.id = saved_shift.id;

  perform public.validate_planning_shift_timeline(saved_shift.id);

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
    'planning_shift',
    saved_shift.id,
    jsonb_build_object(
      'shiftId', saved_shift.id,
      'before', jsonb_build_object('agentId', previous_shift.agent_id),
      'after', jsonb_build_object('agentId', saved_shift.agent_id),
      'segmentCount', jsonb_array_length(shift_segments),
      'breakCount', jsonb_array_length(shift_breaks),
      'updatedBy', (select auth.uid())
    ),
    'shift-service-updated-' || saved_shift.id::text || '-'
      || extensions.gen_random_uuid()::text
  );

  perform set_config(
    'app.expected_schedule_lock_version',
    coalesce(previous_expected_lock, ''),
    true
  );
  perform set_config(
    'app.expected_schedule_lock_verified',
    coalesce(previous_verified_lock, ''),
    true
  );

  return jsonb_build_object(
    'shiftId', saved_shift.id,
    'scheduleVersionId', target_schedule.id,
    'agentId', saved_shift.agent_id,
    'startsAt', saved_shift.starts_at,
    'endsAt', saved_shift.ends_at,
    'breakMinutes', saved_shift.break_minutes,
    'plannedMinutes', public.planning_shift_planned_minutes(saved_shift.id),
    'segmentIds', (
      select coalesce(jsonb_agg(assignment.id order by assignment.starts_at), '[]'::jsonb)
      from public.shift_assignments assignment
      where assignment.planning_shift_id = saved_shift.id
    ),
    'breakIds', (
      select coalesce(jsonb_agg(pause.id order by pause.starts_at), '[]'::jsonb)
      from public.planning_shift_breaks pause
      where pause.planning_shift_id = saved_shift.id
    ),
    'lockVersion', (
      select schedule.lock_version
      from public.schedule_versions schedule
      where schedule.id = target_schedule.id
    )
  );
end;
$$;

revoke all on function public.replace_planning_shift_service(
  uuid, uuid, uuid, timestamptz, timestamptz, jsonb, jsonb, text, bigint
) from public, anon, authenticated;

create or replace function public.create_planning_shift_service(
  target_schedule_version_id uuid,
  target_agent_id uuid,
  shift_starts_at timestamptz,
  shift_ends_at timestamptz,
  shift_segments jsonb,
  shift_breaks jsonb,
  shift_note text,
  expected_lock_version bigint
)
returns jsonb
language sql
volatile
security definer
set search_path = ''
as $$
  select public.replace_planning_shift_service(
    target_schedule_version_id,
    null,
    target_agent_id,
    shift_starts_at,
    shift_ends_at,
    shift_segments,
    shift_breaks,
    shift_note,
    expected_lock_version
  );
$$;

create or replace function public.update_planning_shift_service(
  target_schedule_version_id uuid,
  target_shift_id uuid,
  target_agent_id uuid,
  shift_starts_at timestamptz,
  shift_ends_at timestamptz,
  shift_segments jsonb,
  shift_breaks jsonb,
  shift_note text,
  expected_lock_version bigint
)
returns jsonb
language sql
volatile
security definer
set search_path = ''
as $$
  select public.replace_planning_shift_service(
    target_schedule_version_id,
    target_shift_id,
    target_agent_id,
    shift_starts_at,
    shift_ends_at,
    shift_segments,
    shift_breaks,
    shift_note,
    expected_lock_version
  );
$$;

revoke all on function public.create_planning_shift_service(
  uuid, uuid, timestamptz, timestamptz, jsonb, jsonb, text, bigint
) from public, anon, authenticated;
revoke all on function public.update_planning_shift_service(
  uuid, uuid, uuid, timestamptz, timestamptz, jsonb, jsonb, text, bigint
) from public, anon, authenticated;
grant execute on function public.create_planning_shift_service(
  uuid, uuid, timestamptz, timestamptz, jsonb, jsonb, text, bigint
) to authenticated;
grant execute on function public.update_planning_shift_service(
  uuid, uuid, uuid, timestamptz, timestamptz, jsonb, jsonb, text, bigint
) to authenticated;

create or replace function public.delete_planning_shift_service(
  target_schedule_version_id uuid,
  target_shift_id uuid,
  expected_lock_version bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_schedule public.schedule_versions;
  target_shift public.planning_shifts;
  previous_expected_lock text;
  previous_verified_lock text;
begin
  if expected_lock_version is null or expected_lock_version < 0 then
    raise exception using
      errcode = 'P2030',
      message = 'A valid expected lock version is required.';
  end if;

  select schedule.* into target_schedule
  from public.schedule_versions schedule
  where schedule.id = target_schedule_version_id
  for update;

  if target_schedule.id is null then
    raise exception using errcode = 'P2020', message = 'Planning introuvable.';
  end if;

  if target_schedule.lock_version <> expected_lock_version then
    raise exception using
      errcode = 'P2031',
      message = format(
        'Schedule changed concurrently (expected version %s, current version %s).',
        expected_lock_version,
        target_schedule.lock_version
      );
  end if;

  previous_expected_lock := current_setting(
    'app.expected_schedule_lock_version',
    true
  );
  previous_verified_lock := current_setting(
    'app.expected_schedule_lock_verified',
    true
  );
  perform set_config('app.expected_schedule_lock_version', '', true);
  perform set_config('app.expected_schedule_lock_verified', '', true);

  if target_schedule.status <> 'draft'
    or target_schedule.superseded_at is not null then
    raise exception using
      errcode = 'P2021',
      message = 'Seul le brouillon courant peut être modifié.';
  end if;

  if not public.has_role(
    target_schedule.organization_id,
    target_schedule.site_id,
    array['platform_admin', 'planning_admin', 'planner']::public.app_role[]
  ) then
    raise exception 'Insufficient permissions';
  end if;

  select shift.* into target_shift
  from public.planning_shifts shift
  where shift.id = target_shift_id
    and shift.schedule_version_id = target_schedule.id
  for update;

  if target_shift.id is null then
    raise exception using errcode = 'P2020', message = 'Service introuvable.';
  end if;

  if exists (
    select 1
    from public.time_ledger_entries ledger
    where ledger.planning_shift_id = target_shift.id
      and ledger.worked_minutes is not null
  ) then
    raise exception using
      errcode = 'P2028',
      message = 'Ce service contient déjà des heures réalisées.';
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
    'planning_shift',
    target_shift.id,
    jsonb_build_object(
      'shiftId', target_shift.id,
      'agentId', target_shift.agent_id,
      'startsAt', target_shift.starts_at,
      'endsAt', target_shift.ends_at,
      'deletedBy', (select auth.uid())
    ),
    'shift-service-deleted-' || target_shift.id::text || '-'
      || extensions.gen_random_uuid()::text
  );

  perform set_config(
    'app.expected_schedule_lock_version',
    coalesce(previous_expected_lock, ''),
    true
  );
  perform set_config(
    'app.expected_schedule_lock_verified',
    coalesce(previous_verified_lock, ''),
    true
  );

  return jsonb_build_object(
    'shiftId', target_shift.id,
    'scheduleVersionId', target_schedule.id,
    'deleted', true,
    'lockVersion', (
      select schedule.lock_version
      from public.schedule_versions schedule
      where schedule.id = target_schedule.id
    )
  );
end;
$$;

revoke all on function public.delete_planning_shift_service(uuid, uuid, bigint)
from public, anon, authenticated;
grant execute on function public.delete_planning_shift_service(uuid, uuid, bigint)
to authenticated;

-- Expose breaks alongside the existing bounded schedule payload. Existing API
-- consumers ignore the additive key; newer clients can render exact pauses.
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
        select jsonb_agg(
          to_jsonb(shift) || jsonb_build_object(
            'planned_minutes',
            public.planning_shift_planned_minutes(shift.id)
          )
          order by shift.starts_at, shift.id
        )
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
    ),
    'breaks', coalesce(
      (
        select jsonb_agg(to_jsonb(pause) order by pause.starts_at, pause.id)
        from public.planning_shift_breaks pause
        join public.planning_shifts break_shift
          on break_shift.id = pause.planning_shift_id
        where break_shift.schedule_version_id = schedule.id
      ),
      '[]'::jsonb
    )
  )
  from public.schedule_versions schedule
  join public.planning_periods period
    on period.id = schedule.planning_period_id
  where schedule.id = target_schedule_version_id;
$$;

revoke all on function public.get_schedule_content(uuid)
from public, anon, authenticated;
grant execute on function public.get_schedule_content(uuid) to authenticated;

alter table public.planning_shift_breaks enable row level security;
alter table public.planning_shift_breaks force row level security;

create policy planning_shift_breaks_select_authorized
on public.planning_shift_breaks for select to authenticated
using (
  public.has_role(
    organization_id,
    site_id,
    array[
      'platform_admin',
      'planning_admin',
      'planner',
      'approver',
      'supervisor',
      'hr',
      'auditor'
    ]::public.app_role[]
  )
  or exists (
    select 1
    from public.planning_shifts shift
    join public.agents agent on agent.id = shift.agent_id
    where shift.id = planning_shift_breaks.planning_shift_id
      and agent.user_id = (select auth.uid())
  )
);

create policy planning_shift_breaks_service_role
on public.planning_shift_breaks for all to service_role
using (true)
with check (true);

revoke all on table public.planning_shift_breaks from public, anon;
revoke insert, update, delete on table public.planning_shift_breaks
from authenticated;
revoke insert, update, delete on table
  public.planning_shifts,
  public.shift_assignments
from authenticated;
grant select on table public.planning_shift_breaks to authenticated;
grant all on table public.planning_shift_breaks to service_role;

comment on table public.planning_shift_breaks is
  'Exact non-overlapping break intervals for a planning shift; excluded from coverage and planned minutes.';
comment on column public.planning_shifts.break_minutes is
  'Derived compatibility cache equal to the total duration of planning_shift_breaks.';
comment on function public.replace_planning_shift_service(
  uuid, uuid, uuid, timestamptz, timestamptz, jsonb, jsonb, text, bigint
) is
  'Internal CAS implementation that atomically creates or replaces every position segment and exact break of one shift.';
comment on function public.create_planning_shift_service(
  uuid, uuid, timestamptz, timestamptz, jsonb, jsonb, text, bigint
) is
  'CAS command that atomically creates a shift with all of its non-overlapping position segments and exact breaks.';
comment on function public.update_planning_shift_service(
  uuid, uuid, uuid, timestamptz, timestamptz, jsonb, jsonb, text, bigint
) is
  'CAS command that atomically replaces all position segments and exact breaks of an existing shift.';
comment on function public.delete_planning_shift_service(uuid, uuid, bigint) is
  'CAS command that atomically removes an entire multi-position shift unless worked time exists.';
