begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_temp;

select plan(35);

select has_column(
  'public',
  'outbox_events',
  'lease_token',
  'outbox events carry a fencing token'
);
select has_table(
  'public',
  'outbox_delivery_attempts',
  'delivery attempts are observable'
);
select has_table(
  'public',
  'outbox_dead_letters',
  'terminal failures have a dead-letter queue'
);
select has_table(
  'public',
  'outbox_event_recipients',
  'notification recipients are frozen with the business event'
);
select ok(
  (
    select relforcerowsecurity
    from pg_catalog.pg_class
    where oid = 'public.outbox_delivery_attempts'::regclass
  ),
  'delivery attempts force row-level security'
);
select ok(
  (
    select relforcerowsecurity
    from pg_catalog.pg_class
    where oid = 'public.outbox_dead_letters'::regclass
  ),
  'dead letters force row-level security'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.claim_outbox_events(uuid,integer,integer)',
    'EXECUTE'
  ),
  'the service role can claim events'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.claim_outbox_events(uuid,integer,integer)',
    'EXECUTE'
  ),
  'an end user cannot claim events'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.get_my_notifications(integer,boolean)',
    'EXECUTE'
  ),
  'an end user can list personal notifications'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.acknowledge_my_notification(uuid)',
    'EXECUTE'
  ),
  'an end user can acknowledge a personal notification'
);

-- Keep the fixture isolated from seed events that may legitimately still be
-- pending when this test starts.
update public.outbox_events
set processed_at = coalesce(processed_at, clock_timestamp()),
    lease_token = null,
    leased_by = null,
    leased_until = null
where dead_lettered_at is null;

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  confirmation_token,
  recovery_token,
  email_change
)
values (
  '00000000-0000-0000-0000-000000000000',
  '33000000-0000-4000-8000-0000000000a1',
  'authenticated',
  'authenticated',
  'outbox-agent@example.invalid',
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Outbox Agent"}'::jsonb,
  '',
  '',
  ''
);

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  confirmation_token,
  recovery_token,
  email_change
)
values (
  '00000000-0000-0000-0000-000000000000',
  '33000000-0000-4000-8000-0000000000a2',
  'authenticated',
  'authenticated',
  'outbox-manager@example.invalid',
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Outbox Manager"}'::jsonb,
  '',
  '',
  ''
);

insert into public.organizations (id, slug, name)
values (
  '33000000-0000-4000-8000-000000000001',
  'outbox-tests',
  'Outbox Tests'
);

insert into public.sites (id, organization_id, code, name, timezone)
values (
  '33000000-0000-4000-8000-000000000002',
  '33000000-0000-4000-8000-000000000001',
  'OBX',
  'Outbox Site',
  'Europe/Paris'
);

insert into public.user_role_assignments (
  user_id,
  organization_id,
  site_id,
  role,
  granted_by
) values (
  '33000000-0000-4000-8000-0000000000a1',
  '33000000-0000-4000-8000-000000000001',
  '33000000-0000-4000-8000-000000000002',
  'planning_admin',
  '33000000-0000-4000-8000-0000000000a1'
);

insert into public.user_role_assignments (
  user_id,
  organization_id,
  site_id,
  role,
  granted_by
) values (
  '33000000-0000-4000-8000-0000000000a2',
  '33000000-0000-4000-8000-000000000001',
  '33000000-0000-4000-8000-000000000002',
  'planning_admin',
  '33000000-0000-4000-8000-0000000000a1'
);

select set_config(
  'request.jwt.claim.sub',
  '33000000-0000-4000-8000-0000000000a1',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.aal', 'aal2', true);
select set_config('request.jwt.claim.is_anonymous', 'false', true);

insert into public.agents (
  id,
  organization_id,
  primary_site_id,
  user_id,
  employee_number,
  display_name
)
values (
  '33000000-0000-4000-8000-000000000003',
  '33000000-0000-4000-8000-000000000001',
  '33000000-0000-4000-8000-000000000002',
  '33000000-0000-4000-8000-0000000000a1',
  'OBX-AGENT',
  'Outbox Agent'
);

insert into public.outbox_events (
  id,
  organization_id,
  site_id,
  topic,
  aggregate_type,
  aggregate_id,
  payload,
  idempotency_key
)
values (
  '33000000-0000-4000-8000-000000000010',
  '33000000-0000-4000-8000-000000000001',
  '33000000-0000-4000-8000-000000000002',
  'planning.assignment.deleted',
  'shift_assignment',
  '33000000-0000-4000-8000-000000000020',
  jsonb_build_object(
    'agentId',
    '33000000-0000-4000-8000-000000000003'
  ),
  'outbox-test-materialization'
);

select is(
  (
    select count(*)::integer
    from public.outbox_event_recipients recipient
    where recipient.event_id = '33000000-0000-4000-8000-000000000010'
      and recipient.agent_id = '33000000-0000-4000-8000-000000000003'
  ),
  1,
  'the recipient is captured before asynchronous processing'
);

update public.agents
set active = false
where id = '33000000-0000-4000-8000-000000000003';

create temporary table first_claim as
select *
from public.claim_outbox_events(
  '33000000-0000-4000-8000-000000000101',
  1,
  120
);

select is(
  (select count(*)::integer from first_claim),
  1,
  'the ready event is claimed once'
);
select is(
  (select attempt_count from first_claim),
  1,
  'claiming atomically increments the attempt counter'
);
select is(
  (
    select count(*)::integer
    from public.claim_outbox_events(
      '33000000-0000-4000-8000-000000000102',
      1,
      120
    )
  ),
  0,
  'a live lease prevents a second worker from claiming the same event'
);
select is(
  (
    select (
      public.materialize_outbox_event(
        id,
        lease_token
      ) ->> 'processed'
    )::boolean
    from first_claim
  ),
  true,
  'materialization completes the leased event'
);
select ok(
  (
    select processed_at is not null and lease_token is null
    from public.outbox_events
    where id = '33000000-0000-4000-8000-000000000010'
  ),
  'completion clears the lease and records processing time'
);
select is(
  (
    select status
    from public.outbox_delivery_attempts
    where event_id = '33000000-0000-4000-8000-000000000010'
  ),
  'succeeded',
  'the successful attempt is recorded'
);
select is(
  (
    select count(*)::integer
    from public.agent_notifications
    where idempotency_key =
      'outbox-33000000-0000-4000-8000-000000000010-agent-33000000-0000-4000-8000-000000000003'
  ),
  1,
  'one in-app notification is materialized'
);
select is(
  (
    select (
      public.materialize_outbox_event(
        id,
        lease_token
      ) ->> 'processed'
    )::boolean
    from first_claim
  ),
  false,
  'a stale completion token is harmless'
);
select is(
  (
    select count(*)::integer
    from public.agent_notifications
    where agent_id = '33000000-0000-4000-8000-000000000003'
  ),
  1,
  'a retry cannot duplicate the notification'
);

select set_config(
  'request.jwt.claim.sub',
  '33000000-0000-4000-8000-0000000000a2',
  true
);
select public.reactivate_agent_record(
  '33000000-0000-4000-8000-000000000003',
  '33000000-0000-4000-8000-000000000001',
  'Retour pour vérifier la consultation des notifications'
);

-- One maritime change can span two weekly publications. Every scenario in the
-- event must materialize its own impacted recipients.
insert into public.agents (
  id,
  organization_id,
  primary_site_id,
  employee_number,
  display_name
) values
  (
    '33000000-0000-4000-8000-000000000004',
    '33000000-0000-4000-8000-000000000001',
    '33000000-0000-4000-8000-000000000002',
    'OBX-WEEK-A',
    'Outbox week A'
  ),
  (
    '33000000-0000-4000-8000-000000000005',
    '33000000-0000-4000-8000-000000000001',
    '33000000-0000-4000-8000-000000000002',
    'OBX-WEEK-B',
    'Outbox week B'
  );

insert into public.vessels (
  id,
  organization_id,
  code,
  name
) values (
  '33000000-0000-4000-8000-000000000030',
  '33000000-0000-4000-8000-000000000001',
  'OBXVESSEL',
  'Outbox vessel'
);

alter table public.port_calls disable trigger port_calls_sync_planning;
alter table public.port_calls disable trigger port_calls_zz_ensure_editable_schedule;
insert into public.port_calls (
  id,
  organization_id,
  site_id,
  vessel_id,
  scheduled_arrival_at,
  source
) values (
  '33000000-0000-4000-8000-000000000031',
  '33000000-0000-4000-8000-000000000001',
  '33000000-0000-4000-8000-000000000002',
  '33000000-0000-4000-8000-000000000030',
  timestamptz '2037-01-04 20:00:00+00',
  'test'
);
alter table public.port_calls enable trigger port_calls_sync_planning;
alter table public.port_calls enable trigger port_calls_zz_ensure_editable_schedule;

insert into public.planning_periods (
  id,
  organization_id,
  site_id,
  name,
  starts_on,
  ends_on,
  timezone
) values
  (
    '33000000-0000-4000-8000-000000000032',
    '33000000-0000-4000-8000-000000000001',
    '33000000-0000-4000-8000-000000000002',
    'Outbox week A',
    date '2036-12-29',
    date '2037-01-04',
    'Europe/Paris'
  ),
  (
    '33000000-0000-4000-8000-000000000033',
    '33000000-0000-4000-8000-000000000001',
    '33000000-0000-4000-8000-000000000002',
    'Outbox week B',
    date '2037-01-05',
    date '2037-01-11',
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
) values
  (
    '33000000-0000-4000-8000-000000000034',
    '33000000-0000-4000-8000-000000000001',
    '33000000-0000-4000-8000-000000000002',
    '33000000-0000-4000-8000-000000000032',
    1,
    'draft',
    'Outbox candidate A',
    '33000000-0000-4000-8000-0000000000a1'
  ),
  (
    '33000000-0000-4000-8000-000000000035',
    '33000000-0000-4000-8000-000000000001',
    '33000000-0000-4000-8000-000000000002',
    '33000000-0000-4000-8000-000000000033',
    1,
    'draft',
    'Outbox candidate B',
    '33000000-0000-4000-8000-0000000000a1'
  );

insert into public.disruption_events (
  id,
  organization_id,
  site_id,
  port_call_id,
  kind,
  previous_arrival_at,
  new_arrival_at,
  source,
  created_by
) values (
  '33000000-0000-4000-8000-000000000036',
  '33000000-0000-4000-8000-000000000001',
  '33000000-0000-4000-8000-000000000002',
  '33000000-0000-4000-8000-000000000031',
  'delay',
  timestamptz '2037-01-04 20:00:00+00',
  timestamptz '2037-01-05 01:00:00+00',
  'test',
  '33000000-0000-4000-8000-0000000000a1'
);

insert into public.replanning_scenarios (
  id,
  organization_id,
  site_id,
  disruption_event_id,
  base_schedule_version_id,
  status,
  title,
  created_by
) values
  (
    '33000000-0000-4000-8000-000000000037',
    '33000000-0000-4000-8000-000000000001',
    '33000000-0000-4000-8000-000000000002',
    '33000000-0000-4000-8000-000000000036',
    '33000000-0000-4000-8000-000000000034',
    'simulated',
    'Outbox scenario A',
    '33000000-0000-4000-8000-0000000000a1'
  ),
  (
    '33000000-0000-4000-8000-000000000038',
    '33000000-0000-4000-8000-000000000001',
    '33000000-0000-4000-8000-000000000002',
    '33000000-0000-4000-8000-000000000036',
    '33000000-0000-4000-8000-000000000035',
    'simulated',
    'Outbox scenario B',
    '33000000-0000-4000-8000-0000000000a1'
  );

insert into public.replanning_impacts (
  organization_id,
  site_id,
  scenario_id,
  severity,
  impact_type,
  agent_id
) values
  (
    '33000000-0000-4000-8000-000000000001',
    '33000000-0000-4000-8000-000000000002',
    '33000000-0000-4000-8000-000000000037',
    'warning',
    'agent.schedule_changed',
    '33000000-0000-4000-8000-000000000004'
  ),
  (
    '33000000-0000-4000-8000-000000000001',
    '33000000-0000-4000-8000-000000000002',
    '33000000-0000-4000-8000-000000000038',
    'warning',
    'agent.schedule_changed',
    '33000000-0000-4000-8000-000000000005'
  );

insert into public.outbox_events (
  id,
  organization_id,
  site_id,
  topic,
  aggregate_type,
  aggregate_id,
  payload,
  idempotency_key
) values (
  '33000000-0000-4000-8000-000000000039',
  '33000000-0000-4000-8000-000000000001',
  '33000000-0000-4000-8000-000000000002',
  'planning.port_call.disrupted',
  'port_call',
  '33000000-0000-4000-8000-000000000031',
  jsonb_build_object(
    'scenarioId', '33000000-0000-4000-8000-000000000037',
    'scenarioIds', jsonb_build_array(
      '33000000-0000-4000-8000-000000000037',
      '33000000-0000-4000-8000-000000000038'
    )
  ),
  'outbox-test-cross-period-scenarios'
);

create temporary table cross_period_claim as
select *
from public.claim_outbox_events(
  '33000000-0000-4000-8000-000000000106',
  1,
  120
);

select is(
  (
    select (
      public.materialize_outbox_event(id, lease_token) ->> 'processed'
    )::boolean
    from cross_period_claim
  ),
  true,
  'a cross-period disruption is materialized'
);
select is(
  (
    select count(*)::integer
    from public.agent_notifications notification
    where notification.agent_id in (
      '33000000-0000-4000-8000-000000000004',
      '33000000-0000-4000-8000-000000000005'
    )
      and notification.scenario_id in (
        '33000000-0000-4000-8000-000000000037',
        '33000000-0000-4000-8000-000000000038'
      )
  ),
  2,
  'agents impacted in both weekly scenarios receive a notification'
);
select is(
  (
    select count(distinct notification.scenario_id)::integer
    from public.agent_notifications notification
    where notification.agent_id in (
      '33000000-0000-4000-8000-000000000004',
      '33000000-0000-4000-8000-000000000005'
    )
  ),
  2,
  'each notification keeps the scenario it belongs to'
);

create temporary table notification_observations (
  observation text primary key,
  payload jsonb not null
);
grant select, insert on table notification_observations to authenticated;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '33000000-0000-4000-8000-0000000000a1',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

insert into notification_observations (observation, payload)
values ('list', public.get_my_notifications(30, false));
insert into notification_observations (observation, payload)
select
  'ack',
  public.acknowledge_my_notification((listed.payload -> 0 ->> 'id')::uuid)
from notification_observations listed
where listed.observation = 'list';

insert into notification_observations (observation, payload)
values ('unread', public.get_my_notifications(30, true));
reset role;

select is(
  jsonb_array_length(
    (select payload from notification_observations where observation = 'list')
  ),
  1,
  'the agent lists its in-app notification'
);
select is(
  (
    select payload ->> 'status'
    from notification_observations
    where observation = 'ack'
  ),
  'acknowledged',
  'the agent acknowledges its own notification'
);
select is(
  jsonb_array_length(
    (select payload from notification_observations where observation = 'unread')
  ),
  0,
  'acknowledged notifications leave the unread list'
);

insert into public.outbox_events (
  id,
  organization_id,
  site_id,
  topic,
  aggregate_type,
  aggregate_id,
  payload,
  idempotency_key,
  max_attempts
)
values (
  '33000000-0000-4000-8000-000000000011',
  '33000000-0000-4000-8000-000000000001',
  '33000000-0000-4000-8000-000000000002',
  'planning.requirements.generated',
  'planning_period',
  '33000000-0000-4000-8000-000000000021',
  '{}'::jsonb,
  'outbox-test-dead-letter',
  2
);

create temporary table retry_claim_one as
select *
from public.claim_outbox_events(
  '33000000-0000-4000-8000-000000000103',
  1,
  120
);

create temporary table retry_result_one as
select public.fail_outbox_event(
  id,
  lease_token,
  'first controlled failure'
) as payload
from retry_claim_one;

select is(
  (
    select (payload ->> 'deadLettered')::boolean
    from retry_result_one
  ),
  false,
  'a non-terminal failure is scheduled for retry'
);
select ok(
  (
    select available_at > clock_timestamp()
    from public.outbox_events
    where id = '33000000-0000-4000-8000-000000000011'
  ),
  'retry uses a future exponential-backoff timestamp'
);

update public.outbox_events
set available_at = clock_timestamp() - interval '1 second'
where id = '33000000-0000-4000-8000-000000000011';

create temporary table retry_claim_two as
select *
from public.claim_outbox_events(
  '33000000-0000-4000-8000-000000000104',
  1,
  120
);

select is(
  (select attempt_count from retry_claim_two),
  2,
  'the event is claimed for its bounded final attempt'
);
select is(
  (
    select (
      public.fail_outbox_event(
        id,
        lease_token,
        'second controlled failure'
      ) ->> 'deadLettered'
    )::boolean
    from retry_claim_two
  ),
  true,
  'the final failure is dead-lettered'
);
select ok(
  (
    select dead_lettered_at is not null
      and dead_letter_reason = 'second controlled failure'
    from public.outbox_events
    where id = '33000000-0000-4000-8000-000000000011'
  ),
  'the terminal state remains observable on the event'
);
select is(
  (
    select count(*)::integer
    from public.outbox_dead_letters
    where event_id = '33000000-0000-4000-8000-000000000011'
  ),
  1,
  'the dead-letter queue contains one idempotent record'
);
select is(
  (
    select count(*)::integer
    from public.outbox_delivery_attempts
    where event_id = '33000000-0000-4000-8000-000000000011'
      and status in ('failed', 'dead_lettered')
  ),
  2,
  'both failed attempts remain available for diagnostics'
);
select ok(
  (public.get_outbox_health() ->> 'deadLetterCount')::integer >= 1,
  'outbox health exposes the dead-letter count'
);

create function pg_temp.try_materialize_outbox(
  target_event_id uuid,
  target_lease_token uuid
)
returns text
language plpgsql
as $$
begin
  perform public.materialize_outbox_event(
    target_event_id,
    target_lease_token
  );
  return 'allowed';
exception when others then
  return sqlstate;
end;
$$;

insert into public.outbox_events (
  id,
  organization_id,
  site_id,
  topic,
  aggregate_type,
  aggregate_id,
  payload,
  idempotency_key,
  max_attempts
)
values (
  '33000000-0000-4000-8000-000000000012',
  '33000000-0000-4000-8000-000000000001',
  '33000000-0000-4000-8000-000000000002',
  'planning.unknown.event',
  'planning_period',
  '33000000-0000-4000-8000-000000000022',
  '{}'::jsonb,
  'outbox-test-unknown-topic',
  1
);

create temporary table unknown_topic_claim as
select *
from public.claim_outbox_events(
  '33000000-0000-4000-8000-000000000105',
  1,
  120
);

select is(
  (
    select pg_temp.try_materialize_outbox(id, lease_token)
    from unknown_topic_claim
  ),
  'P3301',
  'an unknown topic is never acknowledged silently'
);

select * from finish();
rollback;
