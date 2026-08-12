begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_temp;

select plan(14);

select has_column(
  'public',
  'outbox_requeue_audit',
  'requeued_actor',
  'every dead-letter recovery has an explicit actor label'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.get_planning_workforce_conflict_page(uuid,date,date,boolean,integer,integer)',
    'EXECUTE'
  ),
  'authenticated users can read a bounded conflict page'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.get_planning_workforce_conflict_page(uuid,date,date,boolean,integer,integer)',
    'EXECUTE'
  ),
  'anonymous users cannot read workforce conflicts'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.reconcile_expired_workforce_conflicts(integer)',
    'EXECUTE'
  ),
  'the private worker can reconcile elapsed conflicts'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.reconcile_expired_workforce_conflicts(integer)',
    'EXECUTE'
  ),
  'end users cannot run the maintenance command'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.requeue_outbox_dead_letter(uuid,text)',
    'EXECUTE'
  ) and not has_function_privilege(
    'authenticated',
    'public.requeue_outbox_dead_letter(uuid,text)',
    'EXECUTE'
  ),
  'dead-letter recovery remains a service-only command'
);
select throws_ok(
  $$select * from public.get_planning_workforce_conflict_page(
    '41000000-0000-4000-8000-000000000001',
    null,
    null,
    false,
    null,
    0
  )$$,
  '22023',
  'result_limit must be between 1 and 100',
  'a null page size cannot remove the read bound'
);

insert into auth.users (
  id,
  aud,
  role,
  email,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) values (
  '41000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'operational-reconciliation@example.invalid',
  '{}'::jsonb,
  '{"full_name":"Operational reconciliation"}'::jsonb,
  now(),
  now()
);

insert into public.organizations (id, slug, name)
values (
  '41000000-0000-4000-8000-000000000002',
  'operational-reconciliation-test',
  'Operational reconciliation test'
);

insert into public.sites (id, organization_id, code, name, timezone)
values (
  '41000000-0000-4000-8000-000000000003',
  '41000000-0000-4000-8000-000000000002',
  'ORT',
  'Operational reconciliation site',
  'Europe/Paris'
);

insert into public.user_role_assignments (
  user_id,
  organization_id,
  site_id,
  role
) values (
  '41000000-0000-4000-8000-000000000001',
  '41000000-0000-4000-8000-000000000002',
  '41000000-0000-4000-8000-000000000003',
  'planning_admin'
);

insert into public.agents (
  id,
  organization_id,
  primary_site_id,
  employee_number,
  display_name
) values
  (
    '41000000-0000-4000-8000-000000000004',
    '41000000-0000-4000-8000-000000000002',
    '41000000-0000-4000-8000-000000000003',
    'ORT-A',
    'Agent réconciliation A'
  ),
  (
    '41000000-0000-4000-8000-000000000005',
    '41000000-0000-4000-8000-000000000002',
    '41000000-0000-4000-8000-000000000003',
    'ORT-B',
    'Agent réconciliation B'
  );

insert into public.planning_periods (
  id,
  organization_id,
  site_id,
  name,
  starts_on,
  ends_on,
  timezone
) values (
  '41000000-0000-4000-8000-000000000006',
  '41000000-0000-4000-8000-000000000002',
  '41000000-0000-4000-8000-000000000003',
  'Past operational week',
  date '2020-01-06',
  date '2020-01-12',
  'Europe/Paris'
);

insert into public.schedule_versions (
  id,
  organization_id,
  site_id,
  planning_period_id,
  version_number,
  status,
  label,
  created_by
) values (
  '41000000-0000-4000-8000-000000000007',
  '41000000-0000-4000-8000-000000000002',
  '41000000-0000-4000-8000-000000000003',
  '41000000-0000-4000-8000-000000000006',
  1,
  'draft',
  'Past operational draft',
  '41000000-0000-4000-8000-000000000001'
);

insert into public.planning_shifts (
  id,
  organization_id,
  site_id,
  schedule_version_id,
  agent_id,
  starts_at,
  ends_at,
  created_by
) values
  (
    '41000000-0000-4000-8000-000000000008',
    '41000000-0000-4000-8000-000000000002',
    '41000000-0000-4000-8000-000000000003',
    '41000000-0000-4000-8000-000000000007',
    '41000000-0000-4000-8000-000000000004',
    timestamptz '2020-01-07 07:00:00+00',
    timestamptz '2020-01-07 15:00:00+00',
    '41000000-0000-4000-8000-000000000001'
  ),
  (
    '41000000-0000-4000-8000-000000000009',
    '41000000-0000-4000-8000-000000000002',
    '41000000-0000-4000-8000-000000000003',
    '41000000-0000-4000-8000-000000000007',
    '41000000-0000-4000-8000-000000000005',
    timestamptz '2020-01-08 07:00:00+00',
    timestamptz '2020-01-08 15:00:00+00',
    '41000000-0000-4000-8000-000000000001'
  );

insert into public.planning_workforce_conflicts (
  id,
  organization_id,
  site_id,
  schedule_version_id,
  planning_shift_id,
  agent_id,
  conflict_kind,
  summary
) values
  (
    '41000000-0000-4000-8000-000000000010',
    '41000000-0000-4000-8000-000000000002',
    '41000000-0000-4000-8000-000000000003',
    '41000000-0000-4000-8000-000000000007',
    '41000000-0000-4000-8000-000000000008',
    '41000000-0000-4000-8000-000000000004',
    'inactive',
    'Conflit historique A'
  ),
  (
    '41000000-0000-4000-8000-000000000011',
    '41000000-0000-4000-8000-000000000002',
    '41000000-0000-4000-8000-000000000003',
    '41000000-0000-4000-8000-000000000007',
    '41000000-0000-4000-8000-000000000009',
    '41000000-0000-4000-8000-000000000005',
    'inactive',
    'Conflit historique B'
  );

select set_config(
  'request.jwt.claim.sub',
  '41000000-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.aal', 'aal2', true);
select set_config('request.jwt.claim.is_anonymous', 'false', true);
set local role authenticated;

select is(
  (
    select count(*)::integer
    from public.get_planning_workforce_conflict_page(
      '41000000-0000-4000-8000-000000000003',
      date '2020-01-06',
      date '2020-01-12',
      false,
      1,
      0
    )
  ),
  1,
  'the conflict page obeys its requested limit'
);
select is(
  (
    select page.total_count::integer
    from public.get_planning_workforce_conflict_page(
      '41000000-0000-4000-8000-000000000003',
      date '2020-01-06',
      date '2020-01-12',
      false,
      1,
      0
    ) page
  ),
  2,
  'the first page exposes the exact filtered total'
);

reset role;
select set_config('request.jwt.claim.role', 'service_role', true);
select is(
  (
    public.reconcile_expired_workforce_conflicts(10)
      ->> 'reconciledAgentCount'
  )::integer,
  2,
  'elapsed conflicts are reconciled in a bounded service batch'
);
select is(
  (
    select count(*)::integer
    from public.planning_workforce_conflicts conflict
    where conflict.id in (
      '41000000-0000-4000-8000-000000000010',
      '41000000-0000-4000-8000-000000000011'
    )
      and conflict.status = 'resolved'
  ),
  2,
  'time-only reconciliation closes obsolete alerts'
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
  '41000000-0000-4000-8000-000000000012',
  '41000000-0000-4000-8000-000000000002',
  'planning.requirements.generated',
  'planning_period',
  '41000000-0000-4000-8000-000000000006',
  '{}'::jsonb,
  'operational-reconciliation-requeue',
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
  '41000000-0000-4000-8000-000000000012',
  '41000000-0000-4000-8000-000000000002',
  'planning.requirements.generated',
  'operational-reconciliation-requeue',
  8,
  'controlled failure',
  clock_timestamp()
);

select set_config('request.jwt.claim.sub', '', true);
select public.requeue_outbox_dead_letter(
  '41000000-0000-4000-8000-000000000012',
  'Incident corrigé par exploitation'
);
select is(
  (
    select audit.requeued_actor
    from public.outbox_requeue_audit audit
    where audit.event_id = '41000000-0000-4000-8000-000000000012'
  ),
  'database-role:service_role',
  'a service recovery is explicitly attributed to its system role'
);

select throws_ok(
  $$select public.reconcile_expired_workforce_conflicts(null)$$,
  '22023',
  'reconcile_batch_size must be between 1 and 1000',
  'a null maintenance size cannot remove the batch bound'
);
select throws_ok(
  $$select public.requeue_outbox_dead_letter(
    null,
    'Incident corrigé par exploitation'
  )$$,
  '22023',
  'target_event_id is required',
  'a null event id is rejected before lookup'
);

select * from finish();
rollback;
