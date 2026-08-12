begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_temp;

select plan(32);

select ok(
  has_function_privilege(
    'service_role',
    'public.update_port_call_timing(uuid,timestamptz,timestamptz,public.port_call_status,text,text,bigint,text,timestamptz,bigint)',
    'EXECUTE'
  ),
  'the robust maritime feed overload is executable by service_role'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.update_port_call_timing(uuid,timestamptz,timestamptz,public.port_call_status,text,text,bigint,text,timestamptz,bigint)',
    'EXECUTE'
  ),
  'human sessions cannot invoke the machine feed overload'
);
select ok(
  not has_function_privilege(
    'service_role',
    'public.override_port_call_timing(uuid,timestamptz,timestamptz,public.port_call_status,text,text,text,bigint,text,timestamptz)',
    'EXECUTE'
  ),
  'service_role cannot invoke the human override command'
);
select ok(
  position(
    'pg_advisory' in pg_get_functiondef(
      'public.planning_agent_satisfies_fundamental_rules(uuid,uuid,timestamptz,timestamptz,uuid)'::regprocedure
    )
  ) = 0,
  'the recommendation eligibility probe contains no advisory lock'
);
select ok(
  position(
    'pg_advisory_xact_lock' in pg_get_functiondef(
      'public.assert_agent_planning_rules(uuid,uuid,timestamptz,timestamptz,uuid)'::regprocedure
    )
  ) > 0,
  'the authoritative mutation assertion retains serialization'
);
select col_has_check(
  'public',
  'planning_workforce_conflicts',
  'conflict_kind',
  'the conflict kind remains database constrained after adding position'
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
  '40000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'guardrail-manager@example.invalid',
  '{}'::jsonb,
  '{"full_name":"Guardrail manager"}'::jsonb,
  now(),
  now()
);

insert into public.organizations (id, slug, name)
values
  (
    '40000000-0000-4000-8000-000000000002',
    'engine-guardrails-040',
    'Engine guardrails 040'
  ),
  (
    '40000000-0000-4000-8000-000000000021',
    'engine-guardrails-040-other',
    'Engine guardrails 040 other organization'
  );

insert into public.sites (id, organization_id, code, name, timezone)
values
  (
    '40000000-0000-4000-8000-000000000003',
    '40000000-0000-4000-8000-000000000002',
    'GRD-A',
    'Guardrail site A',
    'Europe/Paris'
  ),
  (
    '40000000-0000-4000-8000-000000000004',
    '40000000-0000-4000-8000-000000000002',
    'GRD-B',
    'Guardrail site B',
    'Europe/Paris'
  ),
  (
    '40000000-0000-4000-8000-000000000022',
    '40000000-0000-4000-8000-000000000021',
    'GRD-C',
    'Guardrail other organization site',
    'Europe/Paris'
  );

insert into public.user_role_assignments (
  user_id,
  organization_id,
  site_id,
  role
) values
  (
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000003',
    'planning_admin'
  ),
  (
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000004',
    'planning_admin'
  );

insert into public.ports (id, organization_id, code, name)
values
  (
    '40000000-0000-4000-8000-000000000005',
    '40000000-0000-4000-8000-000000000002',
    'GRDA',
    'Guardrail origin'
  ),
  (
    '40000000-0000-4000-8000-000000000006',
    '40000000-0000-4000-8000-000000000002',
    'GRDB',
    'Guardrail destination'
  );

insert into public.vessels (id, organization_id, code, name)
values (
  '40000000-0000-4000-8000-000000000007',
  '40000000-0000-4000-8000-000000000002',
  'GRDV',
  'Guardrail vessel'
);

insert into public.routes (
  id,
  organization_id,
  site_id,
  code,
  name,
  origin_port_id,
  destination_port_id
) values (
  '40000000-0000-4000-8000-000000000008',
  '40000000-0000-4000-8000-000000000002',
  '40000000-0000-4000-8000-000000000003',
  'GRD-ROUTE',
  'Guardrail route',
  '40000000-0000-4000-8000-000000000005',
  '40000000-0000-4000-8000-000000000006'
);

insert into public.port_call_source_policies (
  organization_id,
  source,
  priority,
  ordered_updates_required
) values (
  '40000000-0000-4000-8000-000000000002',
  'guard-feed',
  100,
  true
);

alter table public.port_calls disable trigger port_calls_sync_planning;
alter table public.port_calls disable trigger port_calls_zz_ensure_editable_schedule;
insert into public.port_calls (
  id,
  organization_id,
  site_id,
  vessel_id,
  route_id,
  external_reference,
  status,
  scheduled_arrival_at,
  scheduled_departure_at,
  estimated_arrival_at,
  estimated_departure_at,
  source
) values (
  '40000000-0000-4000-8000-000000000009',
  '40000000-0000-4000-8000-000000000002',
  '40000000-0000-4000-8000-000000000003',
  '40000000-0000-4000-8000-000000000007',
  '40000000-0000-4000-8000-000000000008',
  'GRD-CALL',
  'scheduled',
  timestamptz '2050-01-05 08:00:00+00',
  timestamptz '2050-01-05 10:00:00+00',
  timestamptz '2050-01-05 08:00:00+00',
  timestamptz '2050-01-05 10:00:00+00',
  'manual'
);
alter table public.port_calls enable trigger port_calls_sync_planning;
alter table public.port_calls enable trigger port_calls_zz_ensure_editable_schedule;

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('request.jwt.claim.sub', '', true);

select lives_ok(
  $$select public.update_port_call_timing(
    '40000000-0000-4000-8000-000000000009',
    timestamptz '2050-01-05 08:00:00+00',
    timestamptz '2050-01-05 10:00:00+00',
    'scheduled',
    'guard-feed',
    '1',
    1,
    null,
    clock_timestamp(),
    0
  )$$,
  'service_role ingests a robust feed event without an app_user'
);
select is(
  (
    select call.source_sequence
    from public.port_calls call
    where call.id = '40000000-0000-4000-8000-000000000009'
  ),
  1::bigint,
  'the machine event advances the source cursor and call sequence'
);
select throws_ok(
  $$select public.override_port_call_timing(
    '40000000-0000-4000-8000-000000000009',
    timestamptz '2050-01-05 08:05:00+00',
    timestamptz '2050-01-05 10:05:00+00',
    'delayed',
    'human-override',
    'manual-1',
    '1',
    1,
    'Machine principals must not create human overrides',
    clock_timestamp() + interval '30 minutes'
  )$$,
  '42501',
  'permission denied for function override_port_call_timing',
  'service_role is rejected by the human override command at execution time'
);

reset role;
select set_config('request.jwt.claim.role', '', true);

update public.port_calls call
set source_override_until = clock_timestamp() + interval '1 hour'
where call.id = '40000000-0000-4000-8000-000000000009';

insert into public.port_call_source_overrides (
  organization_id,
  site_id,
  port_call_id,
  previous_state,
  override_state,
  reason,
  valid_until,
  created_by,
  created_at
) values (
  '40000000-0000-4000-8000-000000000002',
  '40000000-0000-4000-8000-000000000003',
  '40000000-0000-4000-8000-000000000009',
  '{}'::jsonb,
  '{}'::jsonb,
  'Manual operational decision',
  clock_timestamp() + interval '1 hour',
  '40000000-0000-4000-8000-000000000001',
  clock_timestamp() - interval '2 hours'
);

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

select throws_ok(
  $$select public.update_port_call_timing(
    '40000000-0000-4000-8000-000000000009',
    timestamptz '2050-01-05 08:00:00+00',
    timestamptz '2050-01-05 10:00:00+00',
    'scheduled',
    'guard-feed',
    '2',
    2,
    '1',
    clock_timestamp(),
    1
  )$$,
  'P2066',
  'A manual maritime override is still active; the feed update must be retried after its expiry.',
  'a live manual override blocks a normal machine feed'
);
select is(
  (
    select call.source_sequence
    from public.port_calls call
    where call.id = '40000000-0000-4000-8000-000000000009'
  ),
  1::bigint,
  'a blocked feed does not advance source state'
);

reset role;
select set_config('request.jwt.claim.role', '', true);
update public.port_calls call
set source_override_until = clock_timestamp() - interval '30 minutes'
where call.id = '40000000-0000-4000-8000-000000000009';
update public.port_call_source_overrides override_row
set valid_until = clock_timestamp() - interval '30 minutes'
where override_row.port_call_id = '40000000-0000-4000-8000-000000000009';

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select lives_ok(
  $$select public.update_port_call_timing(
    '40000000-0000-4000-8000-000000000009',
    timestamptz '2050-01-05 08:00:00+00',
    timestamptz '2050-01-05 10:00:00+00',
    'scheduled',
    'guard-feed',
    '2',
    2,
    '1',
    clock_timestamp(),
    1
  )$$,
  'the machine feed resumes after override expiry'
);
select ok(
  (
    select call.source_override_until is null
    from public.port_calls call
    where call.id = '40000000-0000-4000-8000-000000000009'
  ),
  'the expired override marker is cleared by the accepted feed'
);
select ok(
  (
    select override_row.resumed_at is not null
      and override_row.resumed_by_source = 'guard-feed'
    from public.port_call_source_overrides override_row
    where override_row.port_call_id = '40000000-0000-4000-8000-000000000009'
  ),
  'override history records automatic feed resumption'
);

select throws_ok(
  $$select * from public.claim_outbox_events(null, 10, 120)$$,
  '22023',
  'claim_worker_id is required',
  'claim rejects a NULL worker'
);
select throws_ok(
  $$select * from public.claim_outbox_events(
    '40000000-0000-4000-8000-000000000010', null, 120
  )$$,
  '22023',
  'claim_batch_size must be between 1 and 100',
  'claim rejects a NULL batch size'
);
select throws_ok(
  $$select * from public.claim_outbox_events(
    '40000000-0000-4000-8000-000000000010', 10, null
  )$$,
  '22023',
  'claim_lease_seconds must be between 15 and 600',
  'claim rejects a NULL lease duration'
);
select throws_ok(
  $$select public.materialize_outbox_event(null, null)$$,
  '22023',
  'event id and lease token are required',
  'materialization rejects NULL lease identity'
);
select throws_ok(
  $$select public.fail_outbox_event(null, null, null)$$,
  '22023',
  'event id, lease token and failure reason are required',
  'failure acknowledgement rejects NULL lease arguments'
);
select throws_ok(
  $$select public.requeue_outbox_dead_letter(null, 'Incident fixed')$$,
  '22023',
  'target_event_id is required',
  'dead-letter requeue rejects a NULL event id'
);
select throws_ok(
  $$select public.prune_processed_outbox_events(
    clock_timestamp() - interval '30 days', null
  )$$,
  '22023',
  'prune_batch_size must be between 1 and 5000',
  'outbox pruning rejects a NULL batch size'
);

reset role;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub',
  '40000000-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.aal', 'aal2', true);
select set_config('request.jwt.claim.is_anonymous', 'false', true);

insert into public.agents (
  id,
  organization_id,
  primary_site_id,
  employee_number,
  display_name,
  active,
  hired_on
) values (
  '40000000-0000-4000-8000-000000000011',
  '40000000-0000-4000-8000-000000000002',
  '40000000-0000-4000-8000-000000000003',
  'GRD-AGENT',
  'Guardrail agent',
  true,
  date '2049-01-01'
);

insert into public.agent_groups (
  id, organization_id, site_id, code, name
) values (
  '40000000-0000-4000-8000-000000000012',
  '40000000-0000-4000-8000-000000000002',
  '40000000-0000-4000-8000-000000000003',
  'GRD-GROUP',
  'Guardrail group'
);
insert into public.agent_group_memberships (
  organization_id, group_id, agent_id, effective_from
) values (
  '40000000-0000-4000-8000-000000000002',
  '40000000-0000-4000-8000-000000000012',
  '40000000-0000-4000-8000-000000000011',
  current_date - 1
);

select throws_ok(
  $$update public.agents
    set primary_site_id = '40000000-0000-4000-8000-000000000004'
    where id = '40000000-0000-4000-8000-000000000011'$$,
  'P2086',
  'End active cross-site group memberships before moving this agent.',
  'an active site membership prevents moving an agent across sites'
);

insert into public.skills (id, organization_id, code, name)
values (
  '40000000-0000-4000-8000-000000000013',
  '40000000-0000-4000-8000-000000000002',
  'GRD-SKILL',
  'Guardrail skill'
);
insert into public.positions (
  id, organization_id, site_id, code, name
) values (
  '40000000-0000-4000-8000-000000000014',
  '40000000-0000-4000-8000-000000000002',
  '40000000-0000-4000-8000-000000000003',
  'GRD-POS',
  'Guardrail position'
);
insert into public.position_skill_requirements (
  id, organization_id, position_id, skill_id, minimum_level, mandatory
) values (
  '40000000-0000-4000-8000-000000000015',
  '40000000-0000-4000-8000-000000000002',
  '40000000-0000-4000-8000-000000000014',
  '40000000-0000-4000-8000-000000000013',
  1,
  true
);
insert into public.agent_contract_versions (
  organization_id, agent_id, effective_from, weekly_target_minutes
) values (
  '40000000-0000-4000-8000-000000000002',
  '40000000-0000-4000-8000-000000000011',
  date '2049-01-01',
  2100
);
insert into public.agent_skills (
  organization_id, agent_id, skill_id, level, valid_from
) values (
  '40000000-0000-4000-8000-000000000002',
  '40000000-0000-4000-8000-000000000011',
  '40000000-0000-4000-8000-000000000013',
  1,
  date '2049-01-01'
);

insert into public.planning_periods (
  id, organization_id, site_id, name, starts_on, ends_on, timezone
) values (
  '40000000-0000-4000-8000-000000000016',
  '40000000-0000-4000-8000-000000000002',
  '40000000-0000-4000-8000-000000000003',
  'Guardrail future week',
  date '2050-01-03',
  date '2050-01-09',
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
    '40000000-0000-4000-8000-000000000017',
    '40000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000003',
    '40000000-0000-4000-8000-000000000016',
    1,
    'draft',
    'Guardrail published base',
    '40000000-0000-4000-8000-000000000001'
  );

insert into public.planning_shifts (
  id,
  organization_id,
  site_id,
  schedule_version_id,
  agent_id,
  starts_at,
  ends_at,
  break_minutes,
  created_by
) values (
  '40000000-0000-4000-8000-000000000019',
  '40000000-0000-4000-8000-000000000002',
  '40000000-0000-4000-8000-000000000003',
  '40000000-0000-4000-8000-000000000017',
  '40000000-0000-4000-8000-000000000011',
  timestamptz '2050-01-05 07:00:00+00',
  timestamptz '2050-01-05 15:00:00+00',
  0,
  '40000000-0000-4000-8000-000000000001'
);
insert into public.shift_assignments (
  id,
  organization_id,
  site_id,
  planning_shift_id,
  position_id,
  starts_at,
  ends_at
) values (
  '40000000-0000-4000-8000-000000000020',
  '40000000-0000-4000-8000-000000000002',
  '40000000-0000-4000-8000-000000000003',
  '40000000-0000-4000-8000-000000000019',
  '40000000-0000-4000-8000-000000000014',
  timestamptz '2050-01-05 07:00:00+00',
  timestamptz '2050-01-05 15:00:00+00'
);

select lives_ok(
  $$select public.publish_schedule_version(
    '40000000-0000-4000-8000-000000000017',
    'Valid publication before referential changes',
    (
      select schedule.lock_version
      from public.schedule_versions schedule
      where schedule.id = '40000000-0000-4000-8000-000000000017'
    )
  )$$,
  'the baseline compatible schedule publishes successfully'
);

set constraints all immediate;
set constraints all deferred;
update public.position_skill_requirements requirement
set minimum_level = 2
where requirement.id = '40000000-0000-4000-8000-000000000015';
set constraints all immediate;
select is(
  (
    select count(*)::integer
    from public.planning_workforce_conflicts conflict
    where conflict.planning_shift_id = '40000000-0000-4000-8000-000000000019'
      and conflict.conflict_kind = 'skill'
      and conflict.status = 'open'
  ),
  1,
  'a stricter position requirement recomputes assigned-agent conflicts'
);

set constraints all deferred;
update public.position_skill_requirements requirement
set minimum_level = 1
where requirement.id = '40000000-0000-4000-8000-000000000015';
set constraints all immediate;
select is(
  (
    select conflict.status
    from public.planning_workforce_conflicts conflict
    where conflict.planning_shift_id = '40000000-0000-4000-8000-000000000019'
      and conflict.conflict_kind = 'skill'
  ),
  'resolved',
  'restoring the position requirement resolves the durable conflict'
);

set constraints all deferred;
update public.positions position
set active = false
where position.id = '40000000-0000-4000-8000-000000000014';
set constraints all immediate;
select is(
  (
    select count(*)::integer
    from public.planning_workforce_conflicts conflict
    where conflict.planning_shift_id = '40000000-0000-4000-8000-000000000019'
      and conflict.conflict_kind = 'position'
      and conflict.status = 'open'
  ),
  1,
  'deactivating a used position opens a typed published conflict'
);

set constraints all deferred;
update public.positions position
set active = true,
    site_id = '40000000-0000-4000-8000-000000000004'
where position.id = '40000000-0000-4000-8000-000000000014';
set constraints all immediate;
select is(
  (
    select count(*)::integer
    from public.planning_workforce_conflicts conflict
    where conflict.planning_shift_id = '40000000-0000-4000-8000-000000000019'
      and conflict.conflict_kind = 'position'
      and conflict.status = 'open'
  ),
  1,
  'moving a used position out of site remains an explicit conflict'
);

set constraints all deferred;
update public.positions position
set site_id = '40000000-0000-4000-8000-000000000003'
where position.id = '40000000-0000-4000-8000-000000000014';
set constraints all immediate;
select is(
  (
    select conflict.status
    from public.planning_workforce_conflicts conflict
    where conflict.planning_shift_id = '40000000-0000-4000-8000-000000000019'
      and conflict.conflict_kind = 'position'
  ),
  'resolved',
  'restoring the position scope resolves its published conflict'
);

select throws_ok(
  $$update public.positions position
    set organization_id = '40000000-0000-4000-8000-000000000021',
        site_id = '40000000-0000-4000-8000-000000000022'
    where position.id = '40000000-0000-4000-8000-000000000014'$$,
  '23503',
  'update or delete on table "positions" violates foreign key constraint "position_requirements_position_same_organization" on table "position_skill_requirements"',
  'a used published position cannot move to another organization'
);

set local role authenticated;
select lives_ok(
  $$select *
    from public.get_planning_agent_candidates(
      (
        select schedule.id
        from public.schedule_versions schedule
        where schedule.planning_period_id =
          '40000000-0000-4000-8000-000000000016'
          and schedule.status = 'draft'
          and schedule.superseded_at is null
        order by schedule.version_number desc
        limit 1
      ),
      timestamptz '2050-01-08 07:00:00+00',
      timestamptz '2050-01-08 15:00:00+00',
      jsonb_build_array(jsonb_build_object(
        'positionId', '40000000-0000-4000-8000-000000000014',
        'startsAt', '2050-01-08T07:00:00+00:00',
        'endsAt', '2050-01-08T15:00:00+00:00'
      )),
      '[]'::jsonb,
      null,
      null,
      20,
      0
    )$$,
  'candidate ranking uses the pure read-only eligibility path'
);
reset role;

select ok(
  not has_function_privilege(
    'service_role',
    'public.claim_outbox_events_unchecked_040(uuid,integer,integer)',
    'EXECUTE'
  ),
  'the unchecked claim implementation is private'
);
select ok(
  not has_function_privilege(
    'service_role',
    'public.requeue_outbox_dead_letter_unchecked_040(uuid,text)',
    'EXECUTE'
  ),
  'the unchecked requeue implementation is private'
);

select * from finish();
rollback;
