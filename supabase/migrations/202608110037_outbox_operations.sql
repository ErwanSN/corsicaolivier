-- Keep the durable worker operable over time: dead letters can be requeued only
-- through an audited service command and old successful history is pruned in
-- small, lock-friendly batches.

alter table public.outbox_dead_letters
  add column requeued_at timestamptz,
  add column requeue_reason text
    check (requeue_reason is null or char_length(requeue_reason) <= 500);

create table public.outbox_requeue_audit (
  id bigint generated always as identity primary key,
  event_id uuid not null,
  organization_id uuid not null
    references public.organizations(id) on delete restrict,
  previous_attempt_count integer not null check (previous_attempt_count > 0),
  reason text not null check (char_length(reason) between 3 and 500),
  requeued_by uuid references public.app_users(id) on delete set null,
  requeued_at timestamptz not null default now()
);

create index outbox_requeue_audit_event_time
  on public.outbox_requeue_audit (event_id, requeued_at desc);

alter table public.outbox_requeue_audit enable row level security;
alter table public.outbox_requeue_audit force row level security;
revoke all on table public.outbox_requeue_audit
from public, anon, authenticated;
revoke all on sequence public.outbox_requeue_audit_id_seq
from public, anon, authenticated;
grant all on table public.outbox_requeue_audit to service_role;
grant usage, select on sequence public.outbox_requeue_audit_id_seq
to service_role;

create policy outbox_requeue_audit_service_only
on public.outbox_requeue_audit for all to service_role
using (true)
with check (true);

create or replace function public.reset_dead_letter_requeue_marker()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.dead_lettered_at is distinct from old.dead_lettered_at then
    new.requeued_at := null;
    new.requeue_reason := null;
  end if;
  return new;
end;
$$;

revoke all on function public.reset_dead_letter_requeue_marker()
from public, anon, authenticated;
create trigger outbox_dead_letters_reset_requeue_marker
before update of dead_lettered_at on public.outbox_dead_letters
for each row execute function public.reset_dead_letter_requeue_marker();

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
begin
  clean_reason := pg_catalog.btrim(requeue_reason);
  if clean_reason is null or char_length(clean_reason) not between 3 and 500 then
    raise exception 'A requeue reason between 3 and 500 characters is required'
      using errcode = '22023';
  end if;

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
    requeued_by
  ) values (
    target_event.id,
    target_event.organization_id,
    target_event.attempt_count,
    clean_reason,
    (select auth.uid())
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
    'previousAttemptCount', target_event.attempt_count
  );
end;
$$;

revoke all on function public.requeue_outbox_dead_letter(uuid, text)
from public, anon, authenticated;
grant execute on function public.requeue_outbox_dead_letter(uuid, text)
to service_role;

create or replace function public.prune_processed_outbox_events(
  retain_before timestamptz,
  prune_batch_size integer default 1000
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count integer := 0;
begin
  if retain_before is null
    or retain_before > clock_timestamp() - interval '7 days' then
    raise exception 'Successful outbox history must be retained for at least 7 days'
      using errcode = '22023';
  end if;

  if prune_batch_size not between 1 and 5000 then
    raise exception 'Prune batch size must be between 1 and 5000'
      using errcode = '22023';
  end if;

  with candidates as materialized (
    select event.id
    from public.outbox_events event
    where event.processed_at is not null
      and event.processed_at < retain_before
      and event.dead_lettered_at is null
    order by event.processed_at, event.id
    for update skip locked
    limit prune_batch_size
  ), deleted_attempts as (
    delete from public.outbox_delivery_attempts attempt
    using candidates candidate
    where attempt.event_id = candidate.id
    returning attempt.event_id
  ), deleted_events as (
    delete from public.outbox_events event
    using candidates candidate
    where event.id = candidate.id
    returning event.id
  )
  select count(*)::integer into deleted_count
  from deleted_events;

  return jsonb_build_object(
    'deletedCount', deleted_count,
    'retainBefore', retain_before
  );
end;
$$;

revoke all on function public.prune_processed_outbox_events(
  timestamptz, integer
) from public, anon, authenticated;
grant execute on function public.prune_processed_outbox_events(
  timestamptz, integer
) to service_role;
