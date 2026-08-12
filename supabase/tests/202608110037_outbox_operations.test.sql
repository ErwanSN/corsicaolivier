begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_temp;

select plan(11);

select has_table(
  'public',
  'outbox_requeue_audit',
  'dead-letter requeues have an immutable audit trail'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.requeue_outbox_dead_letter(uuid,text)',
    'EXECUTE'
  ),
  'the service role can requeue a dead letter'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.requeue_outbox_dead_letter(uuid,text)',
    'EXECUTE'
  ),
  'an end user cannot requeue a dead letter'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.prune_processed_outbox_events(timestamptz,integer)',
    'EXECUTE'
  ),
  'the service role can run bounded retention'
);

insert into public.organizations (id, slug, name)
values (
  '37000000-0000-4000-8000-000000000001',
  'outbox-operations-test',
  'Outbox operations test'
);

insert into public.outbox_events (
  id,
  organization_id,
  topic,
  aggregate_type,
  aggregate_id,
  payload,
  idempotency_key,
  attempt_count,
  max_attempts,
  dead_lettered_at,
  dead_letter_reason
) values (
  '37000000-0000-4000-8000-000000000002',
  '37000000-0000-4000-8000-000000000001',
  'planning.requirements.generated',
  'planning_period',
  '37000000-0000-4000-8000-000000000003',
  '{}'::jsonb,
  'outbox-operations-requeue',
  8,
  8,
  clock_timestamp(),
  'controlled failure'
);

insert into public.outbox_dead_letters (
  event_id,
  organization_id,
  topic,
  idempotency_key,
  attempt_count,
  reason,
  dead_lettered_at
) values (
  '37000000-0000-4000-8000-000000000002',
  '37000000-0000-4000-8000-000000000001',
  'planning.requirements.generated',
  'outbox-operations-requeue',
  8,
  'controlled failure',
  clock_timestamp()
);

select is(
  (
    public.requeue_outbox_dead_letter(
      '37000000-0000-4000-8000-000000000002',
      'Incident corrigé et vérifié'
    ) ->> 'requeued'
  )::boolean,
  true,
  'a dead letter is requeued explicitly'
);
select ok(
  (
    select event.dead_lettered_at is null
      and event.dead_letter_reason is null
      and event.attempt_count = 0
      and event.available_at <= clock_timestamp()
    from public.outbox_events event
    where event.id = '37000000-0000-4000-8000-000000000002'
  ),
  'requeue resets only the retry state'
);
select is(
  (
    select count(*)::integer
    from public.outbox_requeue_audit audit
    where audit.event_id = '37000000-0000-4000-8000-000000000002'
      and audit.previous_attempt_count = 8
  ),
  1,
  'the previous terminal state remains audited'
);
select ok(
  (
    select dead_letter.requeued_at is not null
      and dead_letter.requeue_reason = 'Incident corrigé et vérifié'
    from public.outbox_dead_letters dead_letter
    where dead_letter.event_id = '37000000-0000-4000-8000-000000000002'
  ),
  'the dead-letter history records its recovery'
);

insert into public.outbox_events (
  id,
  organization_id,
  topic,
  aggregate_type,
  aggregate_id,
  payload,
  idempotency_key,
  processed_at,
  created_at
) values (
  '37000000-0000-4000-8000-000000000004',
  '37000000-0000-4000-8000-000000000001',
  'planning.requirements.generated',
  'planning_period',
  '37000000-0000-4000-8000-000000000005',
  '{}'::jsonb,
  'outbox-operations-retention',
  clock_timestamp() - interval '100 days',
  clock_timestamp() - interval '100 days'
);

select is(
  (
    public.prune_processed_outbox_events(
      clock_timestamp() - interval '90 days',
      100
    ) ->> 'deletedCount'
  )::integer,
  1,
  'retention deletes one bounded batch of old successful events'
);
select is(
  (
    select count(*)::integer
    from public.outbox_events event
    where event.id = '37000000-0000-4000-8000-000000000004'
  ),
  0,
  'the old successful event is gone'
);
select throws_ok(
  $$select public.prune_processed_outbox_events(
    clock_timestamp() - interval '1 day',
    100
  )$$,
  '22023',
  'Successful outbox history must be retained for at least 7 days',
  'recent delivery history cannot be pruned accidentally'
);

select * from finish();
rollback;
