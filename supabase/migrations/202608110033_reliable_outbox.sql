-- Make outbox delivery safe across concurrent API replicas and expose only the
-- resulting in-app notifications to end users. Historical migrations remain
-- immutable; this migration upgrades the existing outbox in place.

alter table public.outbox_events
  add column lease_token uuid,
  add column leased_by uuid,
  add column leased_until timestamptz,
  add column max_attempts integer not null default 8,
  add column dead_lettered_at timestamptz,
  add column dead_letter_reason text,
  add constraint outbox_events_max_attempts_range
    check (max_attempts between 1 and 32),
  add constraint outbox_events_lease_consistent
    check (
      (lease_token is null and leased_by is null and leased_until is null)
      or (lease_token is not null and leased_by is not null and leased_until is not null)
    ),
  add constraint outbox_events_terminal_state_exclusive
    check (processed_at is null or dead_lettered_at is null),
  add constraint outbox_events_dead_letter_reason_length
    check (
      dead_letter_reason is null
      or char_length(dead_letter_reason) <= 500
    );

create index outbox_events_claimable
  on public.outbox_events (available_at, leased_until, created_at, id)
  where processed_at is null and dead_lettered_at is null;

create index outbox_events_dead_lettered
  on public.outbox_events (dead_lettered_at desc)
  where dead_lettered_at is not null;

create index outbox_events_processed
  on public.outbox_events (processed_at desc)
  where processed_at is not null;

create table public.outbox_delivery_attempts (
  id bigint generated always as identity primary key,
  event_id uuid not null
    references public.outbox_events(id) on delete restrict,
  attempt_number integer not null check (attempt_number > 0),
  worker_id uuid not null,
  lease_token uuid not null,
  status text not null
    check (status in ('claimed', 'succeeded', 'failed', 'dead_lettered')),
  claimed_at timestamptz not null default now(),
  finished_at timestamptz,
  error_message text
    check (error_message is null or char_length(error_message) <= 500),
  notification_count integer
    check (notification_count is null or notification_count >= 0),
  unique (event_id, attempt_number),
  check ((status = 'claimed') = (finished_at is null))
);

create index outbox_delivery_attempts_event_time
  on public.outbox_delivery_attempts (event_id, claimed_at desc);

create index outbox_delivery_attempts_failures
  on public.outbox_delivery_attempts (finished_at desc)
  where status in ('failed', 'dead_lettered');

create table public.outbox_dead_letters (
  event_id uuid primary key
    references public.outbox_events(id) on delete restrict,
  organization_id uuid not null
    references public.organizations(id) on delete restrict,
  site_id uuid references public.sites(id) on delete restrict,
  topic text not null,
  idempotency_key text not null,
  attempt_count integer not null check (attempt_count > 0),
  reason text not null check (char_length(reason) between 1 and 500),
  dead_lettered_at timestamptz not null default now()
);

create index outbox_dead_letters_time
  on public.outbox_dead_letters (dead_lettered_at desc);

-- Recipients are part of the committed business event. Resolving them only
-- when a worker eventually runs would make delivery depend on mutable agent
-- status/site data and could silently lose an already committed notification.
create table public.outbox_event_recipients (
  id bigint generated always as identity primary key,
  event_id uuid not null
    references public.outbox_events(id) on delete cascade,
  organization_id uuid not null
    references public.organizations(id) on delete restrict,
  site_id uuid not null
    references public.sites(id) on delete restrict,
  agent_id uuid not null
    references public.agents(id) on delete restrict,
  scenario_id uuid
    references public.replanning_scenarios(id) on delete set null,
  captured_at timestamptz not null default now()
);

create unique index outbox_event_recipients_identity
  on public.outbox_event_recipients (event_id, agent_id, scenario_id)
  nulls not distinct;
create index outbox_event_recipients_agent
  on public.outbox_event_recipients (agent_id, captured_at desc);

alter table public.outbox_delivery_attempts enable row level security;
alter table public.outbox_delivery_attempts force row level security;
alter table public.outbox_dead_letters enable row level security;
alter table public.outbox_dead_letters force row level security;
alter table public.outbox_event_recipients enable row level security;
alter table public.outbox_event_recipients force row level security;

revoke all on table public.outbox_delivery_attempts
from public, anon, authenticated;
revoke all on table public.outbox_dead_letters
from public, anon, authenticated;
revoke all on table public.outbox_event_recipients
from public, anon, authenticated;
revoke all on sequence public.outbox_delivery_attempts_id_seq
from public, anon, authenticated;
revoke all on sequence public.outbox_event_recipients_id_seq
from public, anon, authenticated;

grant all on table public.outbox_delivery_attempts to service_role;
grant all on table public.outbox_dead_letters to service_role;
grant all on table public.outbox_event_recipients to service_role;
grant usage, select on sequence public.outbox_delivery_attempts_id_seq
to service_role;
grant usage, select on sequence public.outbox_event_recipients_id_seq
to service_role;

create policy outbox_delivery_attempts_service_only
on public.outbox_delivery_attempts for all to service_role
using (true)
with check (true);

create policy outbox_dead_letters_service_only
on public.outbox_dead_letters for all to service_role
using (true)
with check (true);

create policy outbox_event_recipients_service_only
on public.outbox_event_recipients for all to service_role
using (true)
with check (true);

create or replace function public.capture_outbox_event_recipients(
  target_event_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_event public.outbox_events%rowtype;
  inserted_count integer := 0;
begin
  select event.* into target_event
  from public.outbox_events event
  where event.id = target_event_id;

  if target_event.id is null then
    return 0;
  end if;

  with event_scenarios as (
    select distinct scenario_id.value::uuid as scenario_id
    from jsonb_array_elements_text(
      case
        when jsonb_typeof(target_event.payload -> 'scenarioIds') = 'array'
          then target_event.payload -> 'scenarioIds'
        when nullif(target_event.payload ->> 'scenarioId', '') is not null
          then jsonb_build_array(target_event.payload ->> 'scenarioId')
        else '[]'::jsonb
      end
    ) scenario_id(value)
    where scenario_id.value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ), recipients as (
    select shift.agent_id, null::uuid as scenario_id
    from public.planning_shifts shift
    where target_event.topic = 'planning.schedule.published'
      and shift.schedule_version_id = target_event.aggregate_id

    union all

    select shift.agent_id, null::uuid
    from public.shift_assignments assignment
    join public.planning_shifts shift
      on shift.id = assignment.planning_shift_id
    where target_event.topic = 'planning.assignment.moved'
      and assignment.id = target_event.aggregate_id

    union all

    select
      nullif(target_event.payload #>> '{before,agentId}', '')::uuid,
      null::uuid
    where target_event.topic = 'planning.assignment.updated'

    union all

    select
      nullif(target_event.payload #>> '{after,agentId}', '')::uuid,
      null::uuid
    where target_event.topic = 'planning.assignment.updated'

    union all

    select
      nullif(target_event.payload ->> 'agentId', '')::uuid,
      null::uuid
    where target_event.topic in (
      'planning.assignment.deleted',
      'planning.workforce.conflict'
    )

    union all

    select impact.agent_id, impact.scenario_id
    from public.replanning_impacts impact
    join event_scenarios event_scenario
      on event_scenario.scenario_id = impact.scenario_id
    where target_event.topic in (
        'planning.port_call.disrupted',
        'planning.replanning.applied'
      )
      and impact.agent_id is not null
  )
  insert into public.outbox_event_recipients (
    event_id,
    organization_id,
    site_id,
    agent_id,
    scenario_id
  )
  select distinct
    target_event.id,
    target_event.organization_id,
    coalesce(target_event.site_id, agent.primary_site_id),
    agent.id,
    recipient.scenario_id
  from recipients recipient
  join public.agents agent on agent.id = recipient.agent_id
  where agent.organization_id = target_event.organization_id
  on conflict (event_id, agent_id, scenario_id) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function public.capture_outbox_event_recipients(uuid)
from public, anon, authenticated;

create or replace function public.capture_new_outbox_event_recipients()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.capture_outbox_event_recipients(new.id);
  return new;
end;
$$;

revoke all on function public.capture_new_outbox_event_recipients()
from public, anon, authenticated;

drop trigger if exists outbox_events_capture_recipients
on public.outbox_events;
create trigger outbox_events_capture_recipients
after insert on public.outbox_events
for each row execute function public.capture_new_outbox_event_recipients();

-- Freeze recipients for events that were waiting before this migration.
do $$
declare
  pending_event_id uuid;
begin
  for pending_event_id in
    select event.id
    from public.outbox_events event
    where event.processed_at is null
    order by event.created_at, event.id
  loop
    perform public.capture_outbox_event_recipients(pending_event_id);
  end loop;
end;
$$;

-- A claim increments the attempt counter, assigns a unique fencing token and
-- records the attempt in the same transaction. SKIP LOCKED allows any number of
-- workers to claim independent batches without waiting on one another.
create or replace function public.claim_outbox_events(
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
    raise exception using
      errcode = '22023',
      message = 'claim_worker_id is required';
  end if;

  if claim_batch_size not between 1 and 100 then
    raise exception using
      errcode = '22023',
      message = 'claim_batch_size must be between 1 and 100';
  end if;

  if claim_lease_seconds not between 15 and 600 then
    raise exception using
      errcode = '22023',
      message = 'claim_lease_seconds must be between 15 and 600';
  end if;

  -- Close the trace left by a crashed worker before issuing a replacement
  -- lease. The outbox event remains eligible until its bounded attempt limit.
  with expired_events as materialized (
    select event.id, event.lease_token
    from public.outbox_events event
    where event.processed_at is null
      and event.dead_lettered_at is null
      and event.leased_until <= clock_timestamp()
      and event.attempt_count < event.max_attempts
    order by event.leased_until, event.id
    for update skip locked
    limit greatest(claim_batch_size * 2, 25)
  )
  update public.outbox_delivery_attempts attempt
  set status = 'failed',
      finished_at = clock_timestamp(),
      error_message = 'Lease expirée avant confirmation du traitement'
  from expired_events event
  where attempt.event_id = event.id
    and attempt.lease_token = event.lease_token
    and attempt.status = 'claimed';

  -- A worker can disappear during its final attempt. Such an event must not
  -- remain invisible forever merely because no worker can claim it again.
  with terminal_candidates as materialized (
    select event.id
    from public.outbox_events event
    where event.processed_at is null
      and event.dead_lettered_at is null
      and event.attempt_count >= event.max_attempts
      and (
        event.leased_until is null
        or event.leased_until <= clock_timestamp()
      )
    order by event.leased_until nulls first, event.id
    for update skip locked
    limit greatest(claim_batch_size * 2, 25)
  ), terminal_events as (
    update public.outbox_events event
    set dead_lettered_at = clock_timestamp(),
        dead_letter_reason = 'Lease expirée après la dernière tentative',
        last_error = 'Lease expirée après la dernière tentative',
        lease_token = null,
        leased_by = null,
        leased_until = null
    from terminal_candidates candidate
    where event.id = candidate.id
    returning event.*
  ), closed_attempts as (
    update public.outbox_delivery_attempts attempt
    set status = 'dead_lettered',
        finished_at = clock_timestamp(),
        error_message = 'Lease expirée après la dernière tentative'
    from terminal_events event
    where attempt.event_id = event.id
      and attempt.status = 'claimed'
    returning attempt.event_id
  )
  insert into public.outbox_dead_letters (
    event_id,
    organization_id,
    site_id,
    topic,
    idempotency_key,
    attempt_count,
    reason,
    dead_lettered_at
  )
  select
    event.id,
    event.organization_id,
    event.site_id,
    event.topic,
    event.idempotency_key,
    event.attempt_count,
    event.dead_letter_reason,
    event.dead_lettered_at
  from terminal_events event
  left join closed_attempts closed on closed.event_id = event.id
  on conflict (event_id) do nothing;

  return query
  with candidates as (
    select event.id
    from public.outbox_events event
    where event.processed_at is null
      and event.dead_lettered_at is null
      and event.available_at <= clock_timestamp()
      and (
        event.leased_until is null
        or event.leased_until <= clock_timestamp()
      )
      and event.attempt_count < event.max_attempts
    order by event.available_at, event.created_at, event.id
    for update skip locked
    limit claim_batch_size
  ), claimed as (
    update public.outbox_events event
    set attempt_count = event.attempt_count + 1,
        lease_token = extensions.gen_random_uuid(),
        leased_by = claim_worker_id,
        leased_until = clock_timestamp()
          + make_interval(secs => claim_lease_seconds),
        last_error = null
    from candidates candidate
    where event.id = candidate.id
    returning event.*
  ), recorded_attempts as (
    insert into public.outbox_delivery_attempts (
      event_id,
      attempt_number,
      worker_id,
      lease_token,
      status,
      claimed_at
    )
    select
      event.id,
      event.attempt_count,
      claim_worker_id,
      event.lease_token,
      'claimed',
      clock_timestamp()
    from claimed event
    returning event_id, attempt_number
  )
  select
    event.id,
    event.organization_id,
    event.site_id,
    event.topic,
    event.aggregate_type,
    event.aggregate_id,
    event.payload,
    event.idempotency_key,
    event.attempt_count,
    event.max_attempts,
    event.lease_token,
    event.leased_until
  from claimed event
  join recorded_attempts attempt
    on attempt.event_id = event.id
    and attempt.attempt_number = event.attempt_count
  order by event.available_at, event.created_at, event.id;
end;
$$;

-- Materialization and acknowledgement of the outbox event deliberately share
-- one database transaction. Retrying after a network failure therefore cannot
-- create a duplicate notification or lose the event completion marker.
create or replace function public.materialize_outbox_event(
  target_event_id uuid,
  target_lease_token uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_event public.outbox_events%rowtype;
  inserted_notification_count integer := 0;
begin
  select event.*
  into target_event
  from public.outbox_events event
  where event.id = target_event_id
    and event.lease_token = target_lease_token
    and event.processed_at is null
    and event.dead_lettered_at is null
  for update;

  if target_event.id is null then
    return jsonb_build_object(
      'processed', false,
      'reason', 'stale_or_terminal_lease'
    );
  end if;

  -- Never acknowledge a newly introduced topic silently. Topics with no agent
  -- recipient are listed explicitly because their durable audit trail is their
  -- intended local outcome; an unknown topic retries and eventually reaches
  -- the dead-letter queue until a handler is deployed.
  if target_event.topic <> all(array[
    'planning.schedule.published',
    'planning.port_call.disrupted',
    'planning.replanning.approved',
    'planning.replanning.applied',
    'planning.requirements.generated',
    'planning.assignment.moved',
    'planning.assignment.updated',
    'planning.assignment.deleted',
    'planning.workforce.conflict'
  ]::text[]) then
    raise exception using
      errcode = 'P3301',
      message = 'Unsupported outbox topic';
  end if;

  with valid_recipients as (
    select
      recipient.agent_id,
      recipient.scenario_id,
      recipient.site_id
    from public.outbox_event_recipients recipient
    where recipient.event_id = target_event.id
  )
  insert into public.agent_notifications (
    organization_id,
    site_id,
    agent_id,
    scenario_id,
    status,
    channel,
    subject,
    body,
    idempotency_key,
    sent_at
  )
  select
    target_event.organization_id,
    coalesce(target_event.site_id, recipient.site_id),
    recipient.agent_id,
    recipient.scenario_id,
    'sent'::public.notification_status,
    'in_app',
    case target_event.topic
      when 'planning.schedule.published' then 'Planning publié'
      when 'planning.port_call.disrupted' then 'Changement d’escale'
      when 'planning.replanning.applied' then 'Planning ajusté'
      when 'planning.workforce.conflict' then 'Planning à régulariser'
      else 'Affectation modifiée'
    end,
    case target_event.topic
      when 'planning.schedule.published'
        then 'Votre planning a été publié. Consultez-le pour vérifier vos affectations.'
      when 'planning.port_call.disrupted'
        then 'Une escale liée à votre planning a changé. Consultez le planning actualisé.'
      when 'planning.replanning.applied'
        then 'Un ajustement de planning vous concerne. Consultez vos nouvelles affectations.'
      when 'planning.assignment.deleted'
        then 'Une de vos affectations a été supprimée. Consultez votre planning actualisé.'
      when 'planning.workforce.conflict'
        then 'Une nouvelle contrainte RH concerne une affectation publiée. Consultez le planning actualisé.'
      else 'Une de vos affectations a changé. Consultez votre planning actualisé.'
    end,
    case
      when target_event.topic = 'planning.replanning.applied'
        and recipient.scenario_id is not null
        then 'replanning-applied-'
          || recipient.scenario_id::text
          || '-agent-'
          || recipient.agent_id::text
      when target_event.topic = 'planning.port_call.disrupted'
        and recipient.scenario_id is not null
        then 'planning.port_call.disrupted-'
          || recipient.scenario_id::text
          || '-agent-'
          || recipient.agent_id::text
      else 'outbox-'
        || target_event.id::text
        || '-agent-'
        || recipient.agent_id::text
    end,
    clock_timestamp()
  from valid_recipients recipient
  on conflict (organization_id, idempotency_key) do nothing;

  get diagnostics inserted_notification_count = row_count;

  update public.outbox_events event
  set processed_at = clock_timestamp(),
      lease_token = null,
      leased_by = null,
      leased_until = null,
      last_error = null
  where event.id = target_event.id
    and event.lease_token = target_lease_token;

  update public.outbox_delivery_attempts attempt
  set status = 'succeeded',
      finished_at = clock_timestamp(),
      notification_count = inserted_notification_count,
      error_message = null
  where attempt.event_id = target_event.id
    and attempt.attempt_number = target_event.attempt_count
    and attempt.lease_token = target_lease_token
    and attempt.status in ('claimed', 'failed');

  return jsonb_build_object(
    'processed', true,
    'notificationCount', inserted_notification_count
  );
end;
$$;

create or replace function public.fail_outbox_event(
  target_event_id uuid,
  target_lease_token uuid,
  failure_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_event public.outbox_events%rowtype;
  clean_reason text;
  terminal_failure boolean;
  retry_delay_seconds integer;
  retry_at timestamptz;
begin
  clean_reason := left(
    coalesce(nullif(trim(failure_reason), ''), 'Erreur de traitement'),
    500
  );

  select event.*
  into target_event
  from public.outbox_events event
  where event.id = target_event_id
    and event.lease_token = target_lease_token
    and event.processed_at is null
    and event.dead_lettered_at is null
  for update;

  if target_event.id is null then
    return jsonb_build_object(
      'failed', false,
      'reason', 'stale_or_terminal_lease'
    );
  end if;

  terminal_failure := target_event.attempt_count >= target_event.max_attempts;
  retry_delay_seconds := least(
    3600::numeric,
    5::numeric * power(
      2::numeric,
      greatest(target_event.attempt_count - 1, 0)::numeric
    )
  )::integer;
  retry_at := clock_timestamp()
    + make_interval(secs => retry_delay_seconds);

  update public.outbox_events event
  set available_at = case
        when terminal_failure then event.available_at
        else retry_at
      end,
      last_error = clean_reason,
      dead_lettered_at = case
        when terminal_failure then clock_timestamp()
        else null
      end,
      dead_letter_reason = case
        when terminal_failure then clean_reason
        else null
      end,
      lease_token = null,
      leased_by = null,
      leased_until = null
  where event.id = target_event.id
    and event.lease_token = target_lease_token;

  update public.outbox_delivery_attempts attempt
  set status = case
        when terminal_failure then 'dead_lettered'
        else 'failed'
      end,
      finished_at = clock_timestamp(),
      error_message = clean_reason
  where attempt.event_id = target_event.id
    and attempt.attempt_number = target_event.attempt_count
    and attempt.lease_token = target_lease_token
    and attempt.status = 'claimed';

  if terminal_failure then
    insert into public.outbox_dead_letters (
      event_id,
      organization_id,
      site_id,
      topic,
      idempotency_key,
      attempt_count,
      reason,
      dead_lettered_at
    ) values (
      target_event.id,
      target_event.organization_id,
      target_event.site_id,
      target_event.topic,
      target_event.idempotency_key,
      target_event.attempt_count,
      clean_reason,
      clock_timestamp()
    )
    on conflict (event_id) do update
      set attempt_count = excluded.attempt_count,
          reason = excluded.reason,
          dead_lettered_at = excluded.dead_lettered_at;
  end if;

  return jsonb_build_object(
    'failed', true,
    'deadLettered', terminal_failure,
    'attemptCount', target_event.attempt_count,
    'retryAt', case
      when terminal_failure then null
      else to_jsonb(retry_at)
    end
  );
end;
$$;

create or replace function public.get_outbox_health()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'pendingCount', count(*) filter (
      where event.processed_at is null
        and event.dead_lettered_at is null
    ),
    'readyCount', count(*) filter (
      where event.processed_at is null
        and event.dead_lettered_at is null
        and event.available_at <= now()
        and (event.leased_until is null or event.leased_until <= now())
    ),
    'activeLeaseCount', count(*) filter (
      where event.processed_at is null
        and event.dead_lettered_at is null
        and event.leased_until > now()
    ),
    'deadLetterCount', count(*) filter (
      where event.dead_lettered_at is not null
    ),
    'processedLastHourCount', count(*) filter (
      where event.processed_at >= now() - interval '1 hour'
    ),
    'oldestReadyAt', min(event.available_at) filter (
      where event.processed_at is null
        and event.dead_lettered_at is null
        and event.available_at <= now()
        and (event.leased_until is null or event.leased_until <= now())
    )
  )
  from public.outbox_events event;
$$;

-- User-facing RPCs are deliberately narrow. The authenticated role receives no
-- direct UPDATE privilege on notification contents, only this acknowledgement
-- command and a self-scoped read model.
create or replace function public.get_my_notifications(
  notification_limit integer default 30,
  unread_only boolean default false
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(notification.payload order by notification.created_at desc),
    '[]'::jsonb
  )
  from (
    select
      jsonb_build_object(
        'id', item.id,
        'organizationId', item.organization_id,
        'siteId', item.site_id,
        'agentId', item.agent_id,
        'scenarioId', item.scenario_id,
        'status', item.status,
        'channel', item.channel,
        'subject', item.subject,
        'body', item.body,
        'sentAt', item.sent_at,
        'acknowledgedAt', item.acknowledged_at,
        'createdAt', item.created_at
      ) as payload,
      item.created_at
    from public.agent_notifications item
    join public.agents agent on agent.id = item.agent_id
    join public.app_users app_user on app_user.id = agent.user_id
    where agent.user_id = (select auth.uid())
      and agent.active
      and app_user.status = 'active'
      and item.channel = 'in_app'
      and (
        not unread_only
        or item.status not in (
          'acknowledged'::public.notification_status,
          'cancelled'::public.notification_status
        )
      )
    order by item.created_at desc, item.id desc
    limit least(greatest(coalesce(notification_limit, 30), 1), 100)
  ) notification;
$$;

create or replace function public.acknowledge_my_notification(
  target_notification_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_notification public.agent_notifications%rowtype;
begin
  select item.*
  into target_notification
  from public.agent_notifications item
  join public.agents agent on agent.id = item.agent_id
  join public.app_users app_user on app_user.id = agent.user_id
  where item.id = target_notification_id
    and agent.user_id = (select auth.uid())
    and agent.active
    and app_user.status = 'active'
    and item.channel = 'in_app'
    and item.status <> 'cancelled'::public.notification_status
  for update of item;

  if target_notification.id is null then
    return null;
  end if;

  if target_notification.status <> 'acknowledged'::public.notification_status then
    update public.agent_notifications item
    set status = 'acknowledged'::public.notification_status,
        acknowledged_at = clock_timestamp(),
        updated_at = clock_timestamp()
    where item.id = target_notification.id
    returning item.* into target_notification;
  end if;

  return jsonb_build_object(
    'id', target_notification.id,
    'status', target_notification.status,
    'acknowledgedAt', target_notification.acknowledged_at
  );
end;
$$;

revoke all on function public.claim_outbox_events(uuid, integer, integer)
from public, anon, authenticated;
revoke all on function public.materialize_outbox_event(uuid, uuid)
from public, anon, authenticated;
revoke all on function public.fail_outbox_event(uuid, uuid, text)
from public, anon, authenticated;
revoke all on function public.get_outbox_health()
from public, anon, authenticated;
revoke all on function public.get_my_notifications(integer, boolean)
from public, anon, authenticated;
revoke all on function public.acknowledge_my_notification(uuid)
from public, anon, authenticated;

grant execute on function public.claim_outbox_events(uuid, integer, integer)
to service_role;
grant execute on function public.materialize_outbox_event(uuid, uuid)
to service_role;
grant execute on function public.fail_outbox_event(uuid, uuid, text)
to service_role;
grant execute on function public.get_outbox_health()
to service_role;
grant execute on function public.get_my_notifications(integer, boolean)
to authenticated;
grant execute on function public.acknowledge_my_notification(uuid)
to authenticated;
