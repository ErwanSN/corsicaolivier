-- Close the final engine guardrails found during the resilience review.
-- The public RPC signatures stay unchanged: additive private helpers isolate
-- trusted ingestion from human overrides and keep outbox validation explicit.

-- A service-role maritime feed is an authenticated machine principal, not an
-- application user. Treat it as trusted for internal role checks; executable
-- grants below still define the exact machine command surface.
create or replace function public.has_role(
  target_organization_id uuid,
  target_site_id uuid,
  allowed_roles public.app_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
      (select auth.role()) = 'service_role'
        and current_setting('app.maritime_machine_feed', true) = 'true',
      false
    )
    or exists (
      select 1
      from public.user_role_assignments assignment
      join public.app_users app_user on app_user.id = assignment.user_id
      where assignment.user_id = (select auth.uid())
        and app_user.status = 'active'
        and assignment.valid_from <= now()
        and (assignment.valid_until is null or assignment.valid_until > now())
        and assignment.role = any(allowed_roles)
        and (
          assignment.role = 'platform_admin'
          or (
            assignment.organization_id = target_organization_id
            and (
              target_site_id is null
              or assignment.site_id is null
              or assignment.site_id = target_site_id
            )
          )
        )
    );
$$;

-- Mark only the robust machine-feed overload. A port-call trigger can then
-- distinguish a normal feed from the separately authorized human override.
create or replace function public.update_port_call_timing(
  target_port_call_id uuid,
  new_estimated_arrival_at timestamptz,
  new_estimated_departure_at timestamptz,
  new_status public.port_call_status,
  update_source text,
  update_source_revision text,
  update_source_sequence bigint,
  expected_current_source_revision text,
  update_received_at timestamptz,
  expected_timing_lock_version bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  update_result jsonb;
begin
  perform set_config('app.maritime_machine_feed', 'true', true);

  update_result := public.apply_ordered_port_call_timing_update(
    target_port_call_id,
    new_estimated_arrival_at,
    new_estimated_departure_at,
    new_status,
    update_source,
    update_source_revision,
    update_source_sequence,
    expected_current_source_revision,
    update_received_at,
    expected_timing_lock_version,
    true,
    false
  );

  perform set_config('app.maritime_machine_feed', '', true);
  return update_result;
exception
  when others then
    perform set_config('app.maritime_machine_feed', '', true);
    raise;
end;
$$;

create or replace function public.protect_active_port_call_source_override()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.source_override_until > clock_timestamp()
    and current_setting('app.maritime_machine_feed', true) = 'true' then
    raise exception using
      errcode = 'P2066',
      message = 'A manual maritime override is still active; the feed update must be retried after its expiry.';
  end if;

  return new;
end;
$$;

revoke all on function public.protect_active_port_call_source_override()
from public, anon, authenticated, service_role;

drop trigger if exists port_calls_05_protect_active_source_override
on public.port_calls;
create trigger port_calls_05_protect_active_source_override
before update of
  estimated_arrival_at,
  estimated_departure_at,
  status,
  source,
  source_revision,
  source_sequence,
  source_received_at,
  timing_lock_version
on public.port_calls
for each row execute function public.protect_active_port_call_source_override();

revoke all on function public.update_port_call_timing(
  uuid,
  timestamptz,
  timestamptz,
  public.port_call_status,
  text,
  text,
  bigint,
  text,
  timestamptz,
  bigint
) from public, anon, authenticated, service_role;
grant execute on function public.update_port_call_timing(
  uuid,
  timestamptz,
  timestamptz,
  public.port_call_status,
  text,
  text,
  bigint,
  text,
  timestamptz,
  bigint
) to service_role;

-- Human override entry points stay human-only even though has_role now knows
-- about machine principals. Their private implementation is also inaccessible.
revoke all on function public.apply_port_call_timing_override(
  uuid,
  timestamptz,
  timestamptz,
  public.port_call_status,
  text,
  text,
  text,
  bigint,
  text,
  timestamptz
) from public, anon, service_role;
revoke all on function public.override_port_call_timing(
  uuid,
  timestamptz,
  timestamptz,
  public.port_call_status,
  text,
  text,
  text,
  bigint,
  text,
  timestamptz
) from public, anon, service_role;

-- Candidate ranking needs the same business decisions as mutation commands,
-- but a read must never acquire the mutation path's advisory lock.
create or replace function public.planning_agent_satisfies_fundamental_rules(
  target_schedule_version_id uuid,
  target_agent_id uuid,
  candidate_starts_at timestamptz,
  candidate_ends_at timestamptz,
  excluded_shift_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with target as materialized (
    select schedule.id,
      schedule.organization_id,
      schedule.site_id,
      schedule.planning_period_id,
      period.timezone
    from public.schedule_versions schedule
    join public.planning_periods period
      on period.id = schedule.planning_period_id
    where schedule.id = target_schedule_version_id
  ),
  effective_versions as materialized (
    select version.id
    from public.schedule_versions version
    join target on true
    where version.id = target.id
      or (
        version.organization_id = target.organization_id
        and version.site_id = target.site_id
        and version.status = 'published'
        and version.planning_period_id <> target.planning_period_id
      )
  ),
  effective_shifts as materialized (
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
  ordered_shifts as materialized (
    select shift.*,
      lag(shift.starts_at) over (
        order by shift.starts_at, shift.ends_at, shift.id nulls last
      ) as previous_starts_at,
      lag(shift.ends_at) over (
        order by shift.starts_at, shift.ends_at, shift.id nulls last
      ) as previous_ends_at
    from effective_shifts shift
  ),
  local_shifts as materialized (
    select
      (shift.starts_at at time zone target.timezone)::date as work_date,
      (shift.starts_at at time zone target.timezone)::time as start_time
    from effective_shifts shift
    cross join target
  ),
  work_dates as materialized (
    select distinct local_shift.work_date
    from local_shifts local_shift
  )
  select exists (select 1 from target)
    and not exists (
      select 1
      from ordered_shifts shift
      where shift.previous_ends_at is not null
        and shift.starts_at < shift.previous_ends_at
    )
    and not exists (
      select 1
      from ordered_shifts shift
      cross join target
      where shift.previous_ends_at is not null
        and (shift.starts_at at time zone target.timezone)::date
          > (shift.previous_starts_at at time zone target.timezone)::date
        and shift.starts_at - shift.previous_ends_at < interval '11 hours'
    )
    and not exists (
      select 1
      from local_shifts early_shift
      join local_shifts next_day_shift
        on next_day_shift.work_date = early_shift.work_date + 1
      where early_shift.start_time <= time '06:00'
        and next_day_shift.start_time < time '12:00'
    )
    and not exists (
      select 1
      from work_dates first_day
      where (
        select count(*)
        from generate_series(0, 6) offset_days
        where exists (
          select 1
          from work_dates present_day
          where present_day.work_date = first_day.work_date + offset_days
        )
      ) = 7
    );
$$;

revoke all on function public.planning_agent_satisfies_fundamental_rules(
  uuid, uuid, timestamptz, timestamptz, uuid
) from public, anon, authenticated, service_role;

comment on function public.planning_agent_satisfies_fundamental_rules(
  uuid, uuid, timestamptz, timestamptz, uuid
) is
  'Pure read-only eligibility probe. Mutation commands retain serialization and authoritative revalidation through assert_agent_planning_rules.';

-- Published assignments must remain observable when a position is disabled or
-- moved out of scope. Extend the durable conflict vocabulary and layer the new
-- violation onto the existing private workforce read model.
alter table public.planning_workforce_conflicts
  drop constraint planning_workforce_conflicts_conflict_kind_check;
alter table public.planning_workforce_conflicts
  add constraint planning_workforce_conflicts_conflict_kind_check check (
    conflict_kind in (
      'scope',
      'inactive',
      'employment',
      'contract',
      'unavailability',
      'restriction',
      'skill',
      'position'
    )
  );

alter function public.get_agent_planning_workforce_violations(uuid)
rename to get_agent_planning_workforce_violations_pre_040;

revoke all on function
  public.get_agent_planning_workforce_violations_pre_040(uuid)
from public, anon, authenticated, service_role;

create function public.get_agent_planning_workforce_violations(
  target_agent_id uuid
)
returns table (
  organization_id uuid,
  site_id uuid,
  schedule_version_id uuid,
  planning_shift_id uuid,
  agent_id uuid,
  conflict_kind text,
  summary text,
  details jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select violation.*
  from public.get_agent_planning_workforce_violations_pre_040(
    target_agent_id
  ) violation

  union all

  select
    shift.organization_id,
    shift.site_id,
    shift.schedule_version_id,
    shift.id,
    shift.agent_id,
    'position'::text,
    'Un poste affecté est inactif ou hors du périmètre publié'::text,
    jsonb_build_object(
      'invalidPositionIds',
      jsonb_agg(distinct assignment.position_id order by assignment.position_id)
    )
  from public.planning_shifts shift
  join public.schedule_versions schedule
    on schedule.id = shift.schedule_version_id
  join public.shift_assignments assignment
    on assignment.planning_shift_id = shift.id
  join public.positions position on position.id = assignment.position_id
  where shift.agent_id = target_agent_id
    and shift.ends_at > now()
    and schedule.status = 'published'
    and (
      not position.active
      or position.organization_id <> shift.organization_id
      or (
        position.site_id is not null
        and position.site_id <> shift.site_id
      )
    )
  group by
    shift.organization_id,
    shift.site_id,
    shift.schedule_version_id,
    shift.id,
    shift.agent_id;
$$;

revoke all on function public.get_agent_planning_workforce_violations(uuid)
from public, anon, authenticated, service_role;

-- A changed position requirement affects every agent occupying that position
-- in a future/ongoing published service. Deferred execution observes the final
-- transaction state and avoids transient conflicts during atomic replacement.
create or replace function
public.recompute_workforce_conflicts_from_position_requirement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_agent_id uuid;
begin
  for affected_agent_id in
    select distinct shift.agent_id
    from public.shift_assignments assignment
    join public.planning_shifts shift
      on shift.id = assignment.planning_shift_id
    join public.schedule_versions schedule
      on schedule.id = shift.schedule_version_id
    where assignment.position_id in (
        case when tg_op = 'INSERT' then new.position_id else old.position_id end,
        case when tg_op = 'DELETE' then old.position_id else new.position_id end
      )
      and shift.ends_at > now()
      and schedule.status = 'published'
    order by shift.agent_id
  loop
    perform public.recompute_planning_workforce_conflicts(affected_agent_id);
  end loop;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function
  public.recompute_workforce_conflicts_from_position_requirement()
from public, anon, authenticated, service_role;

create constraint trigger position_requirements_recompute_workforce_conflicts
after insert or update or delete on public.position_skill_requirements
deferrable initially deferred
for each row execute function
  public.recompute_workforce_conflicts_from_position_requirement();

create or replace function public.recompute_workforce_conflicts_from_position()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_agent_id uuid;
begin
  if tg_op = 'UPDATE'
    and new.active is not distinct from old.active
    and new.site_id is not distinct from old.site_id
    and new.organization_id is not distinct from old.organization_id then
    return new;
  end if;

  for affected_agent_id in
    select distinct shift.agent_id
    from public.shift_assignments assignment
    join public.planning_shifts shift
      on shift.id = assignment.planning_shift_id
    join public.schedule_versions schedule
      on schedule.id = shift.schedule_version_id
    where assignment.position_id in (
        case when tg_op = 'INSERT' then new.id else old.id end,
        case when tg_op = 'DELETE' then old.id else new.id end
      )
      and shift.ends_at > now()
      and schedule.status = 'published'
    order by shift.agent_id
  loop
    perform public.recompute_planning_workforce_conflicts(affected_agent_id);
  end loop;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.recompute_workforce_conflicts_from_position()
from public, anon, authenticated, service_role;

create constraint trigger positions_recompute_workforce_conflicts
after insert or update or delete on public.positions
deferrable initially deferred
for each row execute function
  public.recompute_workforce_conflicts_from_position();

-- Moving an agent while a current site-scoped group membership remains active
-- would apply the former site's workforce rules to the new site. Refuse that
-- state regardless of whether the write comes from the RPC or direct SQL.
create or replace function public.guard_agent_primary_site_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.primary_site_id is distinct from old.primary_site_id
    and exists (
      select 1
      from public.agent_group_memberships membership
      join public.agent_groups agent_group
        on agent_group.id = membership.group_id
      where membership.agent_id = old.id
        and membership.organization_id = old.organization_id
        and membership.effective_from <= current_date
        and (
          membership.effective_until is null
          or membership.effective_until >= current_date
        )
        and agent_group.site_id <> new.primary_site_id
    ) then
    raise exception using
      errcode = 'P2086',
      message = 'End active cross-site group memberships before moving this agent.';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_agent_primary_site_change()
from public, anon, authenticated, service_role;

create trigger agents_05_guard_primary_site_change
before update of primary_site_id on public.agents
for each row execute function public.guard_agent_primary_site_change();

-- Preserve the external outbox signatures while moving the existing workers
-- behind strict argument-validation wrappers. SQL NULL must never turn a
-- bounded maintenance command into an accidental no-op or unbounded query.
alter function public.claim_outbox_events(uuid, integer, integer)
rename to claim_outbox_events_unchecked_040;

revoke all on function
  public.claim_outbox_events_unchecked_040(uuid, integer, integer)
from public, anon, authenticated, service_role;

create function public.claim_outbox_events(
  claim_worker_id uuid,
  claim_batch_size integer default 25,
  claim_lease_seconds integer default 120
)
returns table (
  id uuid,
  organization_id uuid,
  site_id uuid,
  topic text,
  aggregate_type text,
  aggregate_id uuid,
  payload jsonb,
  idempotency_key text,
  attempt_count integer,
  max_attempts integer,
  lease_token uuid,
  leased_until timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if claim_worker_id is null then
    raise exception 'claim_worker_id is required' using errcode = '22023';
  end if;
  if claim_batch_size is null or claim_batch_size not between 1 and 100 then
    raise exception 'claim_batch_size must be between 1 and 100'
      using errcode = '22023';
  end if;
  if claim_lease_seconds is null
    or claim_lease_seconds not between 15 and 600 then
    raise exception 'claim_lease_seconds must be between 15 and 600'
      using errcode = '22023';
  end if;

  return query
  select claimed.*
  from public.claim_outbox_events_unchecked_040(
    claim_worker_id,
    claim_batch_size,
    claim_lease_seconds
  ) claimed;
end;
$$;

revoke all on function public.claim_outbox_events(uuid, integer, integer)
from public, anon, authenticated, service_role;
grant execute on function public.claim_outbox_events(uuid, integer, integer)
to service_role;

alter function public.materialize_outbox_event(uuid, uuid)
rename to materialize_outbox_event_unchecked_040;
revoke all on function public.materialize_outbox_event_unchecked_040(uuid, uuid)
from public, anon, authenticated, service_role;

create function public.materialize_outbox_event(
  target_event_id uuid,
  target_lease_token uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if target_event_id is null or target_lease_token is null then
    raise exception 'event id and lease token are required'
      using errcode = '22023';
  end if;

  return public.materialize_outbox_event_unchecked_040(
    target_event_id,
    target_lease_token
  );
end;
$$;

revoke all on function public.materialize_outbox_event(uuid, uuid)
from public, anon, authenticated, service_role;
grant execute on function public.materialize_outbox_event(uuid, uuid)
to service_role;

alter function public.fail_outbox_event(uuid, uuid, text)
rename to fail_outbox_event_unchecked_040;
revoke all on function public.fail_outbox_event_unchecked_040(uuid, uuid, text)
from public, anon, authenticated, service_role;

create function public.fail_outbox_event(
  target_event_id uuid,
  target_lease_token uuid,
  failure_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if target_event_id is null
    or target_lease_token is null
    or nullif(pg_catalog.btrim(failure_reason), '') is null then
    raise exception 'event id, lease token and failure reason are required'
      using errcode = '22023';
  end if;

  return public.fail_outbox_event_unchecked_040(
    target_event_id,
    target_lease_token,
    failure_reason
  );
end;
$$;

revoke all on function public.fail_outbox_event(uuid, uuid, text)
from public, anon, authenticated, service_role;
grant execute on function public.fail_outbox_event(uuid, uuid, text)
to service_role;

alter function public.requeue_outbox_dead_letter(uuid, text)
rename to requeue_outbox_dead_letter_unchecked_040;
revoke all on function public.requeue_outbox_dead_letter_unchecked_040(uuid, text)
from public, anon, authenticated, service_role;

create function public.requeue_outbox_dead_letter(
  target_event_id uuid,
  requeue_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if target_event_id is null then
    raise exception 'target_event_id is required'
      using errcode = '22023';
  end if;
  if nullif(pg_catalog.btrim(requeue_reason), '') is null then
    raise exception 'requeue reason is required'
      using errcode = '22023';
  end if;

  return public.requeue_outbox_dead_letter_unchecked_040(
    target_event_id,
    requeue_reason
  );
end;
$$;

revoke all on function public.requeue_outbox_dead_letter(uuid, text)
from public, anon, authenticated, service_role;
grant execute on function public.requeue_outbox_dead_letter(uuid, text)
to service_role;

alter function public.prune_processed_outbox_events(timestamptz, integer)
rename to prune_processed_outbox_events_unchecked_040;
revoke all on function
  public.prune_processed_outbox_events_unchecked_040(timestamptz, integer)
from public, anon, authenticated, service_role;

create function public.prune_processed_outbox_events(
  retain_before timestamptz,
  prune_batch_size integer default 1000
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if retain_before is null then
    raise exception 'retain_before is required' using errcode = '22023';
  end if;
  if prune_batch_size is null
    or prune_batch_size not between 1 and 5000 then
    raise exception 'prune_batch_size must be between 1 and 5000'
      using errcode = '22023';
  end if;

  return public.prune_processed_outbox_events_unchecked_040(
    retain_before,
    prune_batch_size
  );
end;
$$;

revoke all on function public.prune_processed_outbox_events(
  timestamptz, integer
) from public, anon, authenticated, service_role;
grant execute on function public.prune_processed_outbox_events(
  timestamptz, integer
) to service_role;

comment on function public.claim_outbox_events(uuid, integer, integer) is
  'Strict bounded claim API; worker, batch and lease arguments reject NULL.';
comment on trigger positions_recompute_workforce_conflicts
on public.positions is
  'A disabled or moved position is surfaced as a typed conflict on every future published assignment.';
