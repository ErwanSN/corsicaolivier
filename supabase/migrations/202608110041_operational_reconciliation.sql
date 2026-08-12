-- Complete the operational loop without widening the public command surface:
-- make dead-letter interventions attributable, expose an exact bounded conflict
-- count, and reconcile conflicts that become obsolete only because time passed.

alter table public.outbox_requeue_audit
  add column if not exists requeued_actor text not null default 'database-role:unknown'
    check (char_length(requeued_actor) between 3 and 160);

create or replace function public.requeue_outbox_dead_letter(
  target_event_id uuid,
  requeue_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_event public.outbox_events%rowtype;
  clean_reason text;
  actor_user_id uuid;
  actor_label text;
begin
  if target_event_id is null then
    raise exception 'target_event_id is required' using errcode = '22023';
  end if;

  clean_reason := pg_catalog.btrim(requeue_reason);
  if clean_reason is null or char_length(clean_reason) not between 3 and 500 then
    raise exception 'A requeue reason between 3 and 500 characters is required'
      using errcode = '22023';
  end if;

  actor_user_id := (select auth.uid());
  if actor_user_id is not null
    and not exists (
      select 1
      from public.app_users app_user
      where app_user.id = actor_user_id
    ) then
    actor_user_id := null;
  end if;
  actor_label := left(
    case
      when actor_user_id is not null then 'app-user:' || actor_user_id::text
      else 'database-role:' || coalesce(nullif((select auth.role()), ''), current_user)
    end,
    160
  );

  select event.* into target_event
  from public.outbox_events event
  where event.id = target_event_id
    and event.dead_lettered_at is not null
    and event.processed_at is null
  for update;

  if target_event.id is null then
    raise exception 'Dead-lettered outbox event not found'
      using errcode = 'P3302';
  end if;

  insert into public.outbox_requeue_audit (
    event_id,
    organization_id,
    previous_attempt_count,
    reason,
    requeued_by,
    requeued_actor
  ) values (
    target_event.id,
    target_event.organization_id,
    target_event.attempt_count,
    clean_reason,
    actor_user_id,
    actor_label
  );

  update public.outbox_dead_letters dead_letter
  set requeued_at = clock_timestamp(),
      requeue_reason = clean_reason
  where dead_letter.event_id = target_event.id;

  update public.outbox_events event
  set attempt_count = 0,
      available_at = clock_timestamp(),
      last_error = null,
      dead_lettered_at = null,
      dead_letter_reason = null,
      lease_token = null,
      leased_by = null,
      leased_until = null
  where event.id = target_event.id;

  return jsonb_build_object(
    'eventId', target_event.id,
    'requeued', true,
    'previousAttemptCount', target_event.attempt_count,
    'actor', actor_label
  );
end;
$$;

revoke all on function public.requeue_outbox_dead_letter(uuid, text)
from public, anon, authenticated, service_role;
grant execute on function public.requeue_outbox_dead_letter(uuid, text)
to service_role;

create or replace function public.get_planning_workforce_conflict_page(
  target_site_id uuid,
  range_starts_on date,
  range_ends_on date,
  include_resolved boolean,
  result_limit integer,
  result_offset integer
)
returns table (
  id uuid,
  organization_id uuid,
  site_id uuid,
  schedule_version_id uuid,
  planning_period_id uuid,
  planning_period_starts_on date,
  planning_shift_id uuid,
  shift_starts_at timestamptz,
  shift_ends_at timestamptz,
  agent_id uuid,
  agent_display_name text,
  conflict_kind text,
  summary text,
  details jsonb,
  status text,
  detected_at timestamptz,
  last_detected_at timestamptz,
  resolved_at timestamptz,
  resolution_note text,
  editable_schedule_version_id uuid,
  total_count bigint
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if target_site_id is null then
    raise exception 'target_site_id is required' using errcode = '22023';
  end if;
  if result_limit is null or result_limit not between 1 and 100 then
    raise exception 'result_limit must be between 1 and 100'
      using errcode = '22023';
  end if;
  if result_offset is null or result_offset not between 0 and 10000 then
    raise exception 'result_offset must be between 0 and 10000'
      using errcode = '22023';
  end if;

  return query
  with matching as materialized (
    select
      conflict.id,
      conflict.organization_id,
      conflict.site_id,
      conflict.schedule_version_id,
      schedule.planning_period_id,
      period.starts_on as planning_period_starts_on,
      conflict.planning_shift_id,
      shift.starts_at as shift_starts_at,
      shift.ends_at as shift_ends_at,
      conflict.agent_id,
      agent.display_name as agent_display_name,
      conflict.conflict_kind,
      conflict.summary,
      conflict.details,
      conflict.status,
      conflict.detected_at,
      conflict.last_detected_at,
      conflict.resolved_at,
      conflict.resolution_note,
      editable.id as editable_schedule_version_id
    from public.planning_workforce_conflicts conflict
    join public.planning_shifts shift on shift.id = conflict.planning_shift_id
    join public.schedule_versions schedule
      on schedule.id = conflict.schedule_version_id
    join public.planning_periods period
      on period.id = schedule.planning_period_id
    join public.agents agent on agent.id = conflict.agent_id
    left join lateral (
      select draft.id
      from public.schedule_versions draft
      where draft.planning_period_id = schedule.planning_period_id
        and draft.status in ('draft', 'validated')
        and draft.superseded_at is null
      order by draft.version_number desc
      limit 1
    ) editable on true
    where conflict.site_id = target_site_id
      and (include_resolved or conflict.status = 'open')
      and (range_starts_on is null or period.ends_on >= range_starts_on)
      and (range_ends_on is null or period.starts_on <= range_ends_on)
  )
  select
    matching.id,
    matching.organization_id,
    matching.site_id,
    matching.schedule_version_id,
    matching.planning_period_id,
    matching.planning_period_starts_on,
    matching.planning_shift_id,
    matching.shift_starts_at,
    matching.shift_ends_at,
    matching.agent_id,
    matching.agent_display_name,
    matching.conflict_kind,
    matching.summary,
    matching.details,
    matching.status,
    matching.detected_at,
    matching.last_detected_at,
    matching.resolved_at,
    matching.resolution_note,
    matching.editable_schedule_version_id,
    count(*) over () as total_count
  from matching
  order by
    case when matching.status = 'open' then 0 else 1 end,
    matching.shift_starts_at,
    matching.id
  limit result_limit
  offset result_offset;
end;
$$;

revoke all on function public.get_planning_workforce_conflict_page(
  uuid, date, date, boolean, integer, integer
) from public, anon, authenticated;
grant execute on function public.get_planning_workforce_conflict_page(
  uuid, date, date, boolean, integer, integer
) to authenticated;

create or replace function public.reconcile_expired_workforce_conflicts(
  reconcile_batch_size integer default 500
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate record;
  reconciled_count integer := 0;
  remaining_count integer := 0;
begin
  if reconcile_batch_size is null
    or reconcile_batch_size not between 1 and 1000 then
    raise exception 'reconcile_batch_size must be between 1 and 1000'
      using errcode = '22023';
  end if;

  for candidate in
    select
      conflict.agent_id,
      min(conflict.id::text)::uuid as first_conflict_id
    from public.planning_workforce_conflicts conflict
    join public.planning_shifts shift on shift.id = conflict.planning_shift_id
    where conflict.status = 'open'
      and shift.ends_at <= clock_timestamp()
    group by conflict.agent_id
    order by min(conflict.id::text)
    limit reconcile_batch_size
  loop
    perform public.recompute_planning_workforce_conflicts(candidate.agent_id);
    reconciled_count := reconciled_count + 1;
  end loop;

  select count(distinct conflict.agent_id)::integer
  into remaining_count
  from public.planning_workforce_conflicts conflict
  join public.planning_shifts shift on shift.id = conflict.planning_shift_id
  where conflict.status = 'open'
    and shift.ends_at <= clock_timestamp();

  return jsonb_build_object(
    'reconciledAgentCount', reconciled_count,
    'remainingAgentCount', remaining_count
  );
end;
$$;

revoke all on function public.reconcile_expired_workforce_conflicts(integer)
from public, anon, authenticated;
grant execute on function public.reconcile_expired_workforce_conflicts(integer)
to service_role;

comment on column public.outbox_requeue_audit.requeued_actor is
  'Authenticated application user or explicit database/system role that issued the recovery command.';
comment on function public.get_planning_workforce_conflict_page(
  uuid, date, date, boolean, integer, integer
) is 'RLS-scoped paginated conflict read model with the exact filtered total.';
comment on function public.reconcile_expired_workforce_conflicts(integer) is
  'Bounded service-only reconciliation for open conflicts made obsolete by elapsed shifts.';
