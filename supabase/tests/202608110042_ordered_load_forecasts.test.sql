begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_temp;

select plan(108);

select has_column(
  'public', 'call_load_forecasts', 'source_priority',
  'load forecasts retain source priority'
);
select has_column(
  'public', 'call_load_forecasts', 'source_sequence',
  'load forecasts retain source sequence'
);
select has_column(
  'public', 'call_load_forecasts', 'source_received_at',
  'load forecasts retain upstream event time'
);
select has_column(
  'public', 'call_load_forecasts', 'payload_fingerprint',
  'load forecasts retain an immutable payload fingerprint'
);
select has_view(
  'public', 'effective_call_load_forecasts',
  'a deterministic effective forecast read model exists'
);
select has_table(
  'public', 'call_load_forecast_overrides',
  'bounded human load overrides are audited'
);
select ok(
  not has_table_privilege(
    'authenticated', 'public.call_load_forecast_source_policies', 'UPDATE'
  ),
  'human clients cannot bypass atomic load-policy reconciliation'
);
select ok(
  not has_table_privilege(
    'service_role', 'public.call_load_forecast_source_policies', 'UPDATE'
  ),
  'the machine principal cannot mutate load-source authority directly'
);
select ok(
  not has_table_privilege(
    'authenticated', 'public.call_load_forecasts', 'INSERT'
  ),
  'authenticated clients cannot insert a forecast directly'
);
select ok(
  not has_table_privilege(
    'service_role', 'public.call_load_forecasts', 'INSERT'
  ),
  'the machine principal can only ingest loads through its ordered command'
);
select ok(
  not has_table_privilege(
    'service_role', 'public.call_load_forecasts', 'UPDATE'
  ),
  'the machine principal cannot mutate the immutable load ledger directly'
);
select ok(
  not has_table_privilege(
    'service_role', 'public.call_load_forecasts', 'DELETE'
  ),
  'the machine principal cannot delete immutable load history directly'
);
select ok(
  not has_table_privilege(
    'authenticated', 'public.port_calls', 'INSERT'
  ),
  'authenticated clients cannot reserve an escale directly'
);
select ok(
  not has_table_privilege(
    'service_role', 'public.port_calls', 'INSERT'
  ),
  'the machine principal cannot bypass the port-call command surface'
);
select ok(
  not has_table_privilege(
    'service_role', 'public.port_calls', 'UPDATE'
  ),
  'the machine principal cannot bypass port-call CAS by updating directly'
);
select ok(
  not has_table_privilege(
    'service_role', 'public.port_calls', 'DELETE'
  ),
  'the machine principal cannot delete port calls outside the command surface'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.create_manual_call_load_forecast(uuid,uuid,uuid,integer,integer,integer,integer,integer)',
    'EXECUTE'
  ),
  'human sessions can create a durable baseline only when none exists'
);
select ok(
  not has_function_privilege(
    'service_role',
    'public.create_manual_call_load_forecast(uuid,uuid,uuid,integer,integer,integer,integer,integer)',
    'EXECUTE'
  ),
  'the machine principal cannot invoke the human load command'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.override_call_load_forecast(uuid,uuid,uuid,integer,integer,integer,integer,integer,text,timestamptz,uuid)',
    'EXECUTE'
  ),
  'human sessions use the bounded motivated load override command'
);
select ok(
  not has_function_privilege(
    'service_role',
    'public.override_call_load_forecast(uuid,uuid,uuid,integer,integer,integer,integer,integer,text,timestamptz,uuid)',
    'EXECUTE'
  ),
  'the feed principal cannot invoke the human load override'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.ingest_ordered_call_load_forecast(uuid,uuid,uuid,text,text,bigint,timestamptz,integer,integer,integer,integer,integer)',
    'EXECUTE'
  ),
  'human sessions cannot impersonate the ordered feed'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.ingest_ordered_call_load_forecast(uuid,uuid,uuid,text,text,bigint,timestamptz,integer,integer,integer,integer,integer)',
    'EXECUTE'
  ),
  'only the service role can ingest an ordered feed load'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.create_manual_port_call(uuid,uuid,uuid,uuid,text,timestamptz,timestamptz)',
    'EXECUTE'
  ),
  'human sessions use the controlled manual escale command'
);
select ok(
  not has_function_privilege(
    'service_role',
    'public.create_manual_port_call(uuid,uuid,uuid,uuid,text,timestamptz,timestamptz)',
    'EXECUTE'
  ),
  'the feed principal cannot invoke the human escale command'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.create_manual_port_call(uuid,uuid,uuid,uuid,text,timestamptz,timestamptz)',
    'EXECUTE'
  ),
  'anonymous callers cannot create an escale'
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
) values
(
  '42000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'ordered-load-manager@example.invalid',
  '{}'::jsonb,
  '{"full_name":"Ordered load manager"}'::jsonb,
  now(),
  now()
),
(
  '42000000-0000-4000-8000-000000000030',
  'authenticated',
  'authenticated',
  'site-only-policy-manager@example.invalid',
  '{}'::jsonb,
  '{"full_name":"Site policy manager"}'::jsonb,
  now(),
  now()
);

insert into public.organizations (id, slug, name)
values (
  '42000000-0000-4000-8000-000000000002',
  'ordered-load-042',
  'Ordered load 042'
);

insert into public.sites (id, organization_id, code, name, timezone)
values
(
  '42000000-0000-4000-8000-000000000003',
  '42000000-0000-4000-8000-000000000002',
  'LOAD42',
  'Ordered load site',
  'Europe/Paris'
),
(
  '42000000-0000-4000-8000-000000000020',
  '42000000-0000-4000-8000-000000000002',
  'OTHER42',
  'Other ordered load site',
  'Europe/Paris'
);

insert into public.user_role_assignments (
  user_id,
  organization_id,
  site_id,
  role
) values
(
  '42000000-0000-4000-8000-000000000001',
  '42000000-0000-4000-8000-000000000002',
  null,
  'planning_admin'
),
(
  '42000000-0000-4000-8000-000000000001',
  '42000000-0000-4000-8000-000000000002',
  '42000000-0000-4000-8000-000000000003',
  'approver'
),
(
  '42000000-0000-4000-8000-000000000030',
  '42000000-0000-4000-8000-000000000002',
  '42000000-0000-4000-8000-000000000003',
  'planning_admin'
);

insert into public.vessels (id, organization_id, code, name)
values (
  '42000000-0000-4000-8000-000000000004',
  '42000000-0000-4000-8000-000000000002',
  'LOAD42',
  'Ordered load vessel'
);

insert into public.positions (
  id,
  organization_id,
  site_id,
  code,
  name
) values (
  '42000000-0000-4000-8000-000000000005',
  '42000000-0000-4000-8000-000000000002',
  '42000000-0000-4000-8000-000000000003',
  'LOAD42',
  'Ordered load position'
);

insert into public.positions (
  id, organization_id, site_id, code, name
) values (
  '42000000-0000-4000-8000-000000000021',
  '42000000-0000-4000-8000-000000000002',
  '42000000-0000-4000-8000-000000000020',
  'OTHER42',
  'Other site position'
);

insert into public.call_load_forecast_source_policies (
  organization_id, source, priority, ordered_updates_required
) values
  (
    '42000000-0000-4000-8000-000000000002',
    'partner-old', 200, true
  ),
  (
    '42000000-0000-4000-8000-000000000002',
    'partner-recent', 200, true
  );

alter table public.port_calls disable trigger port_calls_sync_planning;
alter table public.port_calls disable trigger port_calls_zz_ensure_editable_schedule;
alter table public.call_load_forecasts
  disable trigger call_load_forecasts_sync_planning;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '42000000-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.aal', 'aal2', true);
select set_config('request.jwt.claim.is_anonymous', 'false', true);

select throws_ok(
  $$
    insert into public.port_calls (
      organization_id,
      site_id,
      vessel_id,
      external_reference,
      scheduled_arrival_at,
      source
    ) values (
      '42000000-0000-4000-8000-000000000002',
      '42000000-0000-4000-8000-000000000003',
      '42000000-0000-4000-8000-000000000004',
      'RESERVED-DIRECT-042',
      timestamptz '2051-01-09 08:00:00+00',
      'corsica-linea-feed'
    )
  $$,
  '42501',
  null,
  'a planner cannot usurp the feed or reserve an external reference directly'
);
select is(
  (
    select count(*)
    from public.port_calls call
    where call.external_reference = 'RESERVED-DIRECT-042'
  ),
  0::bigint,
  'the denied direct reservation leaves no escale behind'
);
select lives_ok(
  $$
    select public.create_manual_port_call(
      '42000000-0000-4000-8000-000000000002',
      '42000000-0000-4000-8000-000000000003',
      '42000000-0000-4000-8000-000000000004',
      null,
      'MANUAL-042',
      timestamptz '2051-01-09 08:00:00+00',
      timestamptz '2051-01-09 10:00:00+00'
    )
  $$,
  'an authorized planner creates an escale through the manual command'
);
select is(
  (
    select call.source
    from public.port_calls call
    where call.external_reference = 'MANUAL-042'
  ),
  'tools-panel',
  'the manual escale source is forced by the server'
);
select is(
  (
    select call.source_priority
    from public.port_calls call
    where call.external_reference = 'MANUAL-042'
  ),
  100::smallint,
  'the manual escale receives the tools-panel priority'
);
select lives_ok(
  $$
    select public.create_manual_port_call(
      '42000000-0000-4000-8000-000000000002',
      '42000000-0000-4000-8000-000000000003',
      '42000000-0000-4000-8000-000000000004',
      null,
      'EQUAL-PRIORITY-042',
      timestamptz '2051-01-10 08:00:00+00',
      timestamptz '2051-01-10 10:00:00+00'
    )
  $$,
  'a second escale supports equal-priority source arbitration tests'
);
select throws_ok(
  $$
    select public.override_port_call_timing(
      (
        select call.id from public.port_calls call
        where call.external_reference = 'MANUAL-042'
      ),
      null,
      null,
      'scheduled',
      'corsica-linea-feed',
      'forged-feed-revision',
      (
        select call.source_revision from public.port_calls call
        where call.external_reference = 'MANUAL-042'
      ),
      0,
      'Tentative de provenance réservée',
      clock_timestamp() + interval '1 hour'
    )
  $$,
  '22023',
  'Interactive timing overrides must use tools-panel',
  'an approver cannot impersonate the maritime feed through the public RPC'
);
select is(
  (
    select call.timing_lock_version
    from public.port_calls call
    where call.external_reference = 'MANUAL-042'
  ),
  0::bigint,
  'a rejected forged timing override leaves the call unchanged'
);
select throws_ok(
  $$
    insert into public.call_load_forecasts (
      organization_id,
      site_id,
      port_call_id,
      passenger_count,
      vehicle_count,
      source,
      source_sequence
    ) values (
      '42000000-0000-4000-8000-000000000002',
      '42000000-0000-4000-8000-000000000003',
      (
        select call.id from public.port_calls call
        where call.external_reference = 'MANUAL-042'
      ),
      999,
      0,
      'corsica-linea-feed',
      999
    )
  $$,
  '42501',
  null,
  'a planner cannot insert a forecast while claiming a trusted source'
);
select lives_ok(
  $$
    select public.create_manual_call_load_forecast(
      '42000000-0000-4000-8000-000000000002',
      '42000000-0000-4000-8000-000000000003',
      (
        select call.id from public.port_calls call
        where call.external_reference = 'MANUAL-042'
      ),
      900,
      300,
      40,
      8,
      2
    )
  $$,
  'an authorized planner records the durable initial load baseline'
);
select is(
  (
    select forecast.source
    from public.call_load_forecasts forecast
    join public.port_calls call on call.id = forecast.port_call_id
    where call.external_reference = 'MANUAL-042'
  ),
  'tools-panel',
  'the manual load source is forced by the server'
);
select is(
  (
    select forecast.source_priority
    from public.call_load_forecasts forecast
    join public.port_calls call on call.id = forecast.port_call_id
    where call.external_reference = 'MANUAL-042'
  ),
  100::smallint,
  'the manual load receives the configured tools-panel priority'
);
select matches(
  (
    select forecast.payload_fingerprint
    from public.call_load_forecasts forecast
    join public.port_calls call on call.id = forecast.port_call_id
    where call.external_reference = 'MANUAL-042'
  ),
  '^[0-9a-f]{32}$',
  'the platform computes the manual load fingerprint'
);
select throws_ok(
  $$
    select public.create_manual_call_load_forecast(
      '42000000-0000-4000-8000-000000000002',
      '42000000-0000-4000-8000-000000000003',
      (
        select call.id from public.port_calls call
        where call.external_reference = 'MANUAL-042'
      ),
      901, 301, 41, 9, 3
    )
  $$,
  'P2063',
  'A durable baseline requires no effective forecast',
  'a second baseline cannot bypass the bounded override command'
);
select throws_ok(
  $$
    select public.ingest_ordered_call_load_forecast(
      '42000000-0000-4000-8000-000000000002',
      '42000000-0000-4000-8000-000000000003',
      (
        select call.id from public.port_calls call
        where call.external_reference = 'MANUAL-042'
      ),
      'corsica-linea-feed',
      'feed-10',
      10,
      clock_timestamp() - interval '2 minutes',
      100,
      20,
      5,
      1,
      0
    )
  $$,
  '42501',
  null,
  'an authenticated client cannot execute feed ingestion'
);

reset role;
set local role service_role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'service_role', true);

select throws_ok(
  $$
    select public.update_port_call_timing(
      (
        select call.id from public.port_calls call
        where call.external_reference = 'MANUAL-042'
      ),
      null, null, 'scheduled', 'corsica-linea-feed', 'timing-max',
      9223372036854775807,
      (
        select call.source_revision from public.port_calls call
        where call.external_reference = 'MANUAL-042'
      ),
      clock_timestamp(), 0
    )
  $$,
  'P2060',
  'Timing source sequence is outside the safety range',
  'a maximum bigint timing sequence is rejected'
);
select throws_ok(
  $$
    select public.update_port_call_timing(
      (
        select call.id from public.port_calls call
        where call.external_reference = 'MANUAL-042'
      ),
      null, null, 'scheduled', 'corsica-linea-feed', 'timing-infinity', 10,
      (
        select call.source_revision from public.port_calls call
        where call.external_reference = 'MANUAL-042'
      ),
      timestamptz 'infinity', 0
    )
  $$,
  'P2060',
  'Timing source timestamps must be finite',
  'an infinite timing event timestamp is rejected'
);
select throws_ok(
  $$
    select public.update_port_call_timing(
      (
        select call.id from public.port_calls call
        where call.external_reference = 'MANUAL-042'
      ),
      null, null, 'scheduled', 'corsica-linea-feed', 'timing-future', 10,
      (
        select call.source_revision from public.port_calls call
        where call.external_reference = 'MANUAL-042'
      ),
      timestamptz '9999-01-01 00:00:00+00', 0
    )
  $$,
  'P2060',
  'Source event time is too far in the future.',
  'an extreme but finite timing event timestamp is rejected'
);
select throws_ok(
  $$
    select public.update_port_call_timing(
      (
        select call.id from public.port_calls call
        where call.external_reference = 'MANUAL-042'
      ),
      null, null, 'scheduled', 'corsica-linea-feed', 'timing-jump', 1000001,
      (
        select call.source_revision from public.port_calls call
        where call.external_reference = 'MANUAL-042'
      ),
      clock_timestamp(), 0
    )
  $$,
  'P2060',
  'Timing source sequence jump exceeds the safety window',
  'an excessive first timing sequence jump is rejected'
);
select lives_ok(
  $$
    select public.update_port_call_timing(
      (
        select call.id from public.port_calls call
        where call.external_reference = 'MANUAL-042'
      ),
      null, null, 'scheduled', 'corsica-linea-feed', 'timing-feed-10', 10,
      (
        select call.source_revision from public.port_calls call
        where call.external_reference = 'MANUAL-042'
      ),
      clock_timestamp(), 0
    )
  $$,
  'a normal timing event remains accepted after poison attempts'
);
select throws_ok(
  $$
    select public.ingest_ordered_call_load_forecast(
      '42000000-0000-4000-8000-000000000002',
      '42000000-0000-4000-8000-000000000003',
      (
        select call.id from public.port_calls call
        where call.external_reference = 'MANUAL-042'
      ),
      'corsica-linea-feed', 'feed-max', 9223372036854775807,
      clock_timestamp(), 1, 0, 0, 0, 0
    )
  $$,
  '22023',
  'A trusted ordered source event is required',
  'a maximum bigint load sequence is rejected'
);
select throws_ok(
  $$
    select public.ingest_ordered_call_load_forecast(
      '42000000-0000-4000-8000-000000000002',
      '42000000-0000-4000-8000-000000000003',
      (
        select call.id from public.port_calls call
        where call.external_reference = 'MANUAL-042'
      ),
      'corsica-linea-feed', 'feed-infinity', 10,
      timestamptz '-infinity', 1, 0, 0, 0, 0
    )
  $$,
  '22023',
  'The source event time must be finite and current',
  'an infinite load event timestamp is rejected'
);
select throws_ok(
  $$
    select public.ingest_ordered_call_load_forecast(
      '42000000-0000-4000-8000-000000000002',
      '42000000-0000-4000-8000-000000000003',
      (
        select call.id from public.port_calls call
        where call.external_reference = 'MANUAL-042'
      ),
      'corsica-linea-feed', 'feed-future', 10,
      timestamptz '9999-01-01 00:00:00+00', 1, 0, 0, 0, 0
    )
  $$,
  '22023',
  'The source event time must be finite and current',
  'an extreme but finite load event timestamp is rejected'
);
select throws_ok(
  $$
    select public.ingest_ordered_call_load_forecast(
      '42000000-0000-4000-8000-000000000002',
      '42000000-0000-4000-8000-000000000003',
      (
        select call.id from public.port_calls call
        where call.external_reference = 'MANUAL-042'
      ),
      'corsica-linea-feed', 'feed-jump', 1000001,
      clock_timestamp(), 1, 0, 0, 0, 0
    )
  $$,
  '22023',
  'Load forecast sequence jump exceeds the safety window',
  'an excessive first load sequence jump is rejected'
);

select lives_ok(
  $$
    select public.ingest_ordered_call_load_forecast(
      '42000000-0000-4000-8000-000000000002',
      '42000000-0000-4000-8000-000000000003',
      (
        select call.id from public.port_calls call
        where call.external_reference = 'MANUAL-042'
      ),
      'corsica-linea-feed',
      'feed-10',
      10,
      clock_timestamp() - interval '2 minutes',
      100,
      20,
      5,
      1,
      0
    )
  $$,
  'service_role ingests the first ordered feed load'
);
select is(
  (
    select forecast.source_priority
    from public.call_load_forecasts forecast
    join public.port_calls call on call.id = forecast.port_call_id
    where call.external_reference = 'MANUAL-042'
      and forecast.source_revision = 'feed-10'
  ),
  200::smallint,
  'the trusted feed priority comes from server policy'
);
select throws_ok(
  $$
    select public.ingest_ordered_call_load_forecast(
      '42000000-0000-4000-8000-000000000002',
      '42000000-0000-4000-8000-000000000003',
      (
        select call.id from public.port_calls call
        where call.external_reference = 'MANUAL-042'
      ),
      'corsica-linea-feed',
      'feed-10',
      11,
      clock_timestamp() - interval '1 minute',
      110,
      22,
      6,
      1,
      0
    )
  $$,
  '23505',
  'Duplicate load forecast event',
  'a duplicate feed revision is rejected'
);
select throws_ok(
  $$
    select public.ingest_ordered_call_load_forecast(
      '42000000-0000-4000-8000-000000000002',
      '42000000-0000-4000-8000-000000000003',
      (
        select call.id from public.port_calls call
        where call.external_reference = 'MANUAL-042'
      ),
      'corsica-linea-feed',
      'feed-replay',
      9,
      clock_timestamp() - interval '1 minute',
      90,
      18,
      4,
      1,
      0
    )
  $$,
  '22023',
  'Out-of-order load forecast event',
  'a lower feed sequence is rejected as a replay'
);
select lives_ok(
  $$
    select public.ingest_ordered_call_load_forecast(
      '42000000-0000-4000-8000-000000000002',
      '42000000-0000-4000-8000-000000000003',
      (
        select call.id from public.port_calls call
        where call.external_reference = 'MANUAL-042'
      ),
      'corsica-linea-feed',
      'feed-11',
      11,
      clock_timestamp() - interval '1 minute',
      200::smallint,
      40,
      10,
      3,
      1
    )
  $$,
  'a strictly newer feed event is accepted'
);
select lives_ok(
  $$
    select public.ingest_ordered_call_load_forecast(
      '42000000-0000-4000-8000-000000000002',
      '42000000-0000-4000-8000-000000000003',
      (
        select call.id from public.port_calls call
        where call.external_reference = 'EQUAL-PRIORITY-042'
      ),
      'partner-old', 'partner-old-100', 100,
      clock_timestamp() - interval '2 minutes',
      100, 10, 5, 0, 0
    )
  $$,
  'an older equal-priority source event is accepted'
);
select lives_ok(
  $$
    select public.ingest_ordered_call_load_forecast(
      '42000000-0000-4000-8000-000000000002',
      '42000000-0000-4000-8000-000000000003',
      (
        select call.id from public.port_calls call
        where call.external_reference = 'EQUAL-PRIORITY-042'
      ),
      'partner-recent', 'partner-recent-1', 1,
      clock_timestamp() - interval '1 minute',
      101, 11, 6, 0, 0
    )
  $$,
  'a more recent equal-priority source event is accepted'
);
select is(
  (
    select forecast.source
    from public.effective_call_load_forecasts forecast
    join public.port_calls call on call.id = forecast.port_call_id
    where call.external_reference = 'EQUAL-PRIORITY-042'
  ),
  'partner-recent',
  'inter-source arbitration uses source time, not incomparable sequences'
);
select throws_ok(
  $$
    select public.override_call_load_forecast(
      '42000000-0000-4000-8000-000000000002',
      '42000000-0000-4000-8000-000000000003',
      (
        select call.id from public.port_calls call
        where call.external_reference = 'MANUAL-042'
      ),
      901,
      301,
      41,
      9,
      3,
      'Tentative machine',
      clock_timestamp() + interval '1 hour',
      (
        select forecast.id
        from public.effective_call_load_forecasts forecast
        join public.port_calls call on call.id = forecast.port_call_id
        where call.external_reference = 'MANUAL-042'
      )
    )
  $$,
  '42501',
  null,
  'service_role cannot execute the human load command'
);
select is(
  coalesce(current_setting('app.maritime_machine_feed', true), ''),
  '',
  'load ingestion closes its temporary machine-principal gate after success and failure'
);

reset role;
insert into public.planning_periods (
  id,
  organization_id,
  site_id,
  name,
  starts_on,
  ends_on,
  timezone
) values (
  '42000000-0000-4000-8000-000000000008',
  '42000000-0000-4000-8000-000000000002',
  '42000000-0000-4000-8000-000000000003',
  'Ordered load week',
  date '2051-01-09',
  date '2051-01-15',
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
  '42000000-0000-4000-8000-000000000009',
  '42000000-0000-4000-8000-000000000002',
  '42000000-0000-4000-8000-000000000003',
  '42000000-0000-4000-8000-000000000008',
  1,
  'draft',
  'Ordered load snapshot',
  '42000000-0000-4000-8000-000000000001'
);
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '42000000-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

select throws_ok(
  $$
    select public.override_call_load_forecast(
      '42000000-0000-4000-8000-000000000002',
      '42000000-0000-4000-8000-000000000003',
      (
        select call.id from public.port_calls call
        where call.external_reference = 'MANUAL-042'
      ),
      950,
      350,
      45,
      9,
      3,
      'Vue devenue obsolète',
      clock_timestamp() + interval '2 hours',
      (
        select forecast.id
        from public.call_load_forecasts forecast
        join public.port_calls call on call.id = forecast.port_call_id
        where call.external_reference = 'MANUAL-042'
          and forecast.source = 'tools-panel'
        order by forecast.source_sequence
        limit 1
      )
    )
  $$,
  'P2063',
  'Effective load forecast changed concurrently',
  'a stale operator view cannot silently supersede the effective forecast'
);
select lives_ok(
  $$
    select public.override_call_load_forecast(
      '42000000-0000-4000-8000-000000000002',
      '42000000-0000-4000-8000-000000000003',
      (
        select call.id from public.port_calls call
        where call.external_reference = 'MANUAL-042'
      ),
      950,
      350,
      45,
      9,
      3,
      'Comptage terrain prioritaire',
      clock_timestamp() + interval '2 hours',
      (
        select forecast.id
        from public.effective_call_load_forecasts forecast
        join public.port_calls call on call.id = forecast.port_call_id
        where call.external_reference = 'MANUAL-042'
      )
    )
  $$,
  'a current operator view creates a bounded load override'
);
select is(
  (
    select forecast.source
    from public.effective_call_load_forecasts forecast
    join public.port_calls call on call.id = forecast.port_call_id
    where call.external_reference = 'MANUAL-042'
  ),
  'tools-panel',
  'the active motivated human override is effective'
);
select is(
  (
    select forecast.passenger_count
    from public.effective_call_load_forecasts forecast
    join public.port_calls call on call.id = forecast.port_call_id
    where call.external_reference = 'MANUAL-042'
  ),
  950,
  'the active override exposes the corrected load'
);
select is(
  (
    select forecast.source_sequence
    from public.effective_call_load_forecasts forecast
    join public.port_calls call on call.id = forecast.port_call_id
    where call.external_reference = 'MANUAL-042'
  ),
  1::bigint,
  'the active override keeps its own intra-source sequence'
);
select is(
  (
    select forecast.source_sequence
    from public.get_latest_call_load_forecasts(array[
      (
        select call.id from public.port_calls call
        where call.external_reference = 'MANUAL-042'
      )
    ]) forecast
  ),
  1::bigint,
  'the bounded export RPC returns the same active override as the UI'
);
select is(
  (
    select count(*)
    from public.call_load_forecasts forecast
    join public.port_calls call on call.id = forecast.port_call_id
    where call.external_reference = 'MANUAL-042'
  ),
  4::bigint,
  'all accepted source events remain available as immutable history'
);

reset role;

insert into public.demand_profiles (
  id,
  organization_id,
  site_id,
  code,
  name,
  version
) values (
  '42000000-0000-4000-8000-000000000006',
  '42000000-0000-4000-8000-000000000002',
  '42000000-0000-4000-8000-000000000003',
  'LOAD42',
  'Ordered load profile',
  1
);

insert into public.demand_profiles (
  id, organization_id, site_id, code, name, version
) values (
  '42000000-0000-4000-8000-000000000022',
  '42000000-0000-4000-8000-000000000002',
  '42000000-0000-4000-8000-000000000020',
  'OTHER42',
  'Other site profile',
  1
);

insert into public.demand_profile_lines (
  id,
  organization_id,
  site_id,
  demand_profile_id,
  position_id,
  anchor,
  starts_offset_minutes,
  duration_minutes,
  base_agents,
  passengers_per_extra_agent,
  minimum_agents,
  maximum_agents
) values (
  '42000000-0000-4000-8000-000000000007',
  '42000000-0000-4000-8000-000000000002',
  '42000000-0000-4000-8000-000000000003',
  '42000000-0000-4000-8000-000000000006',
  '42000000-0000-4000-8000-000000000005',
  'arrival',
  0,
  60,
  0,
  100,
  1,
  20
);

select throws_ok(
  $$
    update public.port_calls call
    set demand_profile_id = '42000000-0000-4000-8000-000000000022'
    where call.external_reference = 'MANUAL-042'
  $$,
  '23514',
  'Port-call demand profile is outside its organization/site',
  'an escale cannot reference a demand profile from another site'
);
select is(
  (
    select call.demand_profile_id
    from public.port_calls call
    where call.external_reference = 'MANUAL-042'
  ),
  null::uuid,
  'the rejected cross-site profile update leaves the escale unchanged'
);
select throws_ok(
  $$
    insert into public.demand_profile_lines (
      organization_id, site_id, demand_profile_id, position_id, anchor,
      starts_offset_minutes, duration_minutes, base_agents,
      minimum_agents
    ) values (
      '42000000-0000-4000-8000-000000000002',
      '42000000-0000-4000-8000-000000000003',
      '42000000-0000-4000-8000-000000000006',
      '42000000-0000-4000-8000-000000000021',
      'arrival', 0, 60, 1, 1
    )
  $$,
  '23514',
  'Demand-profile line position is outside its site scope',
  'a demand rule cannot use a position from another site'
);
select throws_ok(
  $$
    insert into public.demand_profile_lines (
      organization_id, site_id, demand_profile_id, position_id, anchor,
      starts_offset_minutes, duration_minutes, base_agents,
      minimum_agents
    ) values (
      '42000000-0000-4000-8000-000000000002',
      '42000000-0000-4000-8000-000000000003',
      '42000000-0000-4000-8000-000000000022',
      '42000000-0000-4000-8000-000000000005',
      'arrival', 0, 60, 1, 1
    )
  $$,
  '23514',
  'Demand-profile line is outside its profile scope',
  'a demand rule cannot impersonate the scope of a remote profile'
);
select throws_ok(
  $$
    update public.demand_profile_lines line
    set position_id = '42000000-0000-4000-8000-000000000021'
    where line.id = '42000000-0000-4000-8000-000000000007'
  $$,
  '23514',
  'Demand-profile line position is outside its site scope',
  'cross-site position scope is also enforced on updates'
);
select throws_ok(
  $$
    update public.demand_profiles profile
    set site_id = '42000000-0000-4000-8000-000000000020'
    where profile.id = '42000000-0000-4000-8000-000000000006'
  $$,
  '23514',
  'Referenced demand-profile scope cannot be changed',
  'a referenced profile cannot be moved away from its rules'
);
select throws_ok(
  $$
    update public.positions position
    set site_id = '42000000-0000-4000-8000-000000000020'
    where position.id = '42000000-0000-4000-8000-000000000005'
  $$,
  '23514',
  'Referenced position scope cannot exclude its demand profiles',
  'a referenced position cannot be moved away from its demand rules'
);

update public.port_calls call
set demand_profile_id = '42000000-0000-4000-8000-000000000006'
where call.external_reference = 'MANUAL-042';

alter table public.port_calls enable trigger port_calls_sync_planning;
alter table public.port_calls enable trigger port_calls_zz_ensure_editable_schedule;
alter table public.call_load_forecasts
  enable trigger call_load_forecasts_sync_planning;

select set_config(
  'request.jwt.claim.sub',
  '42000000-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

select lives_ok(
  $$
    select public.generate_staffing_requirements(
      '42000000-0000-4000-8000-000000000008'
    )
  $$,
  'requirement generation consumes the effective load read model'
);
select is(
  (
    select requirement.required_agents
    from public.staffing_requirements requirement
    where requirement.planning_period_id =
      '42000000-0000-4000-8000-000000000008'
      and requirement.demand_profile_line_id =
        '42000000-0000-4000-8000-000000000007'
      and requirement.retired_at is null
  ),
  10::smallint,
  'generated staffing stays consistent with the active human override'
);
select matches(
  (
    select requirement.source_revision
    from public.staffing_requirements requirement
    where requirement.planning_period_id =
      '42000000-0000-4000-8000-000000000008'
      and requirement.demand_profile_line_id =
        '42000000-0000-4000-8000-000000000007'
      and requirement.retired_at is null
  ),
  'manual-',
  'the requirement trace records the effective override revision'
);

update public.call_load_forecast_overrides source_override
set created_at = clock_timestamp() - interval '3 hours',
    valid_until = clock_timestamp() - interval '1 hour'
where source_override.port_call_id = (
    select call.id from public.port_calls call
    where call.external_reference = 'MANUAL-042'
  )
  and source_override.resumed_at is null;

select is(
  (
    select forecast.passenger_count
    from public.effective_call_load_forecasts forecast
    join public.port_calls call on call.id = forecast.port_call_id
    where call.external_reference = 'MANUAL-042'
  ),
  950,
  'an expired override remains effective until atomic reconciliation'
);

set local role service_role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'service_role', true);
select lives_ok(
  $$
    select public.reconcile_expired_call_load_forecast_overrides(100)
  $$,
  'the worker atomically resumes the trusted forecast after expiry'
);
reset role;
select set_config(
  'request.jwt.claim.sub',
  '42000000-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  (
    select forecast.passenger_count
    from public.effective_call_load_forecasts forecast
    join public.port_calls call on call.id = forecast.port_call_id
    where call.external_reference = 'MANUAL-042'
  ),
  200,
  'the trusted feed resumes after the bounded override expires'
);
select is(
  (
    select requirement.required_agents
    from public.staffing_requirements requirement
    where requirement.planning_period_id =
      '42000000-0000-4000-8000-000000000008'
      and requirement.demand_profile_line_id =
        '42000000-0000-4000-8000-000000000007'
      and requirement.retired_at is null
  ),
  2::smallint,
  'override resumption and requirement regeneration commit together'
);
select is(
  (
    select source_override.resumed_reason
    from public.call_load_forecast_overrides source_override
    where source_override.port_call_id = (
      select call.id from public.port_calls call
      where call.external_reference = 'MANUAL-042'
    )
    order by source_override.created_at desc
    limit 1
  ),
  'expired',
  'the override audit records its automatic expiry'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '42000000-0000-4000-8000-000000000030',
  true
);
select throws_ok(
  $$
    select public.set_call_load_forecast_source_policy_state(
      '42000000-0000-4000-8000-000000000002',
      'corsica-linea-feed',
      200::smallint,
      false
    )
  $$,
  '42501',
  'Insufficient permissions',
  'a site-scoped planner cannot mutate an organization-wide source policy'
);
select set_config(
  'request.jwt.claim.sub',
  '42000000-0000-4000-8000-000000000001',
  true
);
select lives_ok(
  $$
    select public.set_call_load_forecast_source_policy_state(
      '42000000-0000-4000-8000-000000000002',
      'corsica-linea-feed',
      200::smallint,
      false
    )
  $$,
  'an administrator can atomically revoke a compromised feed source'
);
select is(
  (
    select forecast.passenger_count
    from public.effective_call_load_forecasts forecast
    join public.port_calls call on call.id = forecast.port_call_id
    where call.external_reference = 'MANUAL-042'
  ),
  900,
  'source revocation restores the durable safe baseline, not the expired override'
);
select is(
  (
    select policy.active
    from public.port_call_source_policies policy
    where policy.organization_id =
      '42000000-0000-4000-8000-000000000002'
      and policy.source = 'corsica-linea-feed'
  ),
  true,
  'load-source revocation never alters the independent timing-feed policy'
);
select is(
  (
    select requirement.required_agents
    from public.staffing_requirements requirement
    where requirement.planning_period_id =
      '42000000-0000-4000-8000-000000000008'
      and requirement.demand_profile_line_id =
        '42000000-0000-4000-8000-000000000007'
      and requirement.retired_at is null
  ),
  9::smallint,
  'source revocation and baseline requirement regeneration are atomic'
);
select lives_ok(
  $$
    select public.set_call_load_forecast_source_policy_state(
      '42000000-0000-4000-8000-000000000002',
      'corsica-linea-feed',
      200::smallint,
      true
    )
  $$,
  'the trusted feed source can be reactivated through the same command'
);
select is(
  (
    select requirement.required_agents
    from public.staffing_requirements requirement
    where requirement.planning_period_id =
      '42000000-0000-4000-8000-000000000008'
      and requirement.demand_profile_line_id =
        '42000000-0000-4000-8000-000000000007'
      and requirement.retired_at is null
  ),
  2::smallint,
  'reactivation restores the feed and its staffing requirement atomically'
);

select lives_ok(
  $$
    select public.override_call_load_forecast(
      '42000000-0000-4000-8000-000000000002',
      '42000000-0000-4000-8000-000000000003',
      (
        select call.id from public.port_calls call
        where call.external_reference = 'MANUAL-042'
      ),
      700, 250, 35, 7, 2,
      'Correction avant publication',
      clock_timestamp() + interval '2 hours',
      (
        select forecast.id
        from public.effective_call_load_forecasts forecast
        join public.port_calls call on call.id = forecast.port_call_id
        where call.external_reference = 'MANUAL-042'
      )
    )
  $$,
  'a final bounded override is applied before publication'
);
select is(
  (
    select requirement.required_agents
    from public.staffing_requirements requirement
    where requirement.planning_period_id =
      '42000000-0000-4000-8000-000000000008'
      and requirement.demand_profile_line_id =
        '42000000-0000-4000-8000-000000000007'
      and requirement.retired_at is null
  ),
  7::smallint,
  'requirements follow the active pre-publication override'
);

reset role;
update public.call_load_forecast_overrides source_override
set created_at = clock_timestamp() - interval '3 hours',
    valid_until = clock_timestamp() - interval '1 hour'
where source_override.port_call_id = (
    select call.id from public.port_calls call
    where call.external_reference = 'MANUAL-042'
  )
  and source_override.resumed_at is null;

select lives_ok(
  $$
    select public.capture_schedule_requirement_snapshot(
      '42000000-0000-4000-8000-000000000009',
      'publication'
    )
  $$,
  'snapshot capture succeeds with the effective forecast'
);
select ok(
  position(
    'effective_call_load_forecasts' in pg_get_functiondef(
      'public.capture_schedule_requirement_snapshot(uuid,text)'::regprocedure
    )
  ) > 0,
  'publication snapshots read the effective forecast view'
);
select is(
  (
    select snapshot.source_facts #>> '{forecast,sourceRevision}'
    from public.schedule_requirement_snapshots snapshot
    where snapshot.schedule_version_id =
      '42000000-0000-4000-8000-000000000009'
  ),
  'feed-11',
  'the snapshot traces the effective feed revision'
);
select is(
  (
    select (snapshot.source_facts #>> '{forecast,passengerCount}')::integer
    from public.schedule_requirement_snapshots snapshot
    where snapshot.schedule_version_id =
      '42000000-0000-4000-8000-000000000009'
  ),
  200,
  'the snapshot retains the effective feed count, not the newer manual count'
);
select is(
  (
    select snapshot.required_agents
    from public.schedule_requirement_snapshots snapshot
    where snapshot.schedule_version_id =
      '42000000-0000-4000-8000-000000000009'
  ),
  2::smallint,
  'publication reconciles expiry before capturing requirement facts'
);

select lives_ok(
  $$
    select public.create_manual_port_call(
      '42000000-0000-4000-8000-000000000002',
      '42000000-0000-4000-8000-000000000003',
      '42000000-0000-4000-8000-000000000004',
      null, 'EMPTY-OVERRIDE-042',
      timestamptz '2051-02-03 08:00:00+00',
      timestamptz '2051-02-03 10:00:00+00'
    )
  $$,
  'an escale without a baseline is prepared for expiry isolation'
);
select lives_ok(
  $$
    select public.create_manual_port_call(
      '42000000-0000-4000-8000-000000000002',
      '42000000-0000-4000-8000-000000000020',
      '42000000-0000-4000-8000-000000000004',
      null, 'POISON-OVERRIDE-042',
      timestamptz '2051-03-03 08:00:00+00',
      timestamptz '2051-03-03 10:00:00+00'
    )
  $$,
  'a second-site escale is prepared for poison isolation'
);
select lives_ok(
  $$
    select public.override_call_load_forecast(
      '42000000-0000-4000-8000-000000000002',
      '42000000-0000-4000-8000-000000000003',
      (
        select call.id from public.port_calls call
        where call.external_reference = 'EMPTY-OVERRIDE-042'
      ),
      222, 20, 10, 0, 0,
      'Correction sans baseline',
      clock_timestamp() + interval '1 hour',
      null
    )
  $$,
  'an override with no baseline is still explicitly audited'
);
select lives_ok(
  $$
    select public.override_call_load_forecast(
      '42000000-0000-4000-8000-000000000002',
      '42000000-0000-4000-8000-000000000020',
      (
        select call.id from public.port_calls call
        where call.external_reference = 'POISON-OVERRIDE-042'
      ),
      333, 30, 11, 0, 0,
      'Correction qui échouera à reprendre',
      clock_timestamp() + interval '1 hour',
      null
    )
  $$,
  'a poison candidate is independently audited'
);
select is(
  (
    select count(*)
    from public.call_load_forecast_overrides source_override
    join public.port_calls call on call.id = source_override.port_call_id
    where call.external_reference in (
      'EMPTY-OVERRIDE-042', 'POISON-OVERRIDE-042'
    )
      and source_override.resumed_at is null
  ),
  2::bigint,
  'both no-baseline corrections have explicit open override rows'
);

update public.call_load_forecast_overrides source_override
set created_at = case
      when call.external_reference = 'POISON-OVERRIDE-042'
        then clock_timestamp() - interval '4 hours'
      else clock_timestamp() - interval '3 hours'
    end,
    valid_until = case
      when call.external_reference = 'POISON-OVERRIDE-042'
        then clock_timestamp() - interval '2 hours'
      else clock_timestamp() - interval '1 hour'
    end
from public.port_calls call
where call.id = source_override.port_call_id
  and call.external_reference in (
    'EMPTY-OVERRIDE-042', 'POISON-OVERRIDE-042'
  )
  and source_override.resumed_at is null;

update public.sites site
set active = false
where site.id = '42000000-0000-4000-8000-000000000020';

set local role service_role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'service_role', true);
create temporary table load_reconcile_result on commit drop as
select public.reconcile_expired_call_load_forecast_overrides(100) as payload;
select is(
  (select (result.payload ->> 'failedCount')::integer
   from load_reconcile_result result),
  1,
  'one poisoned expiry does not prevent the next override from resuming'
);
select is(
  (select jsonb_array_length(result.payload -> 'failedIds')
   from load_reconcile_result result),
  1,
  'the reconciler returns a bounded diagnostic id for the failed item'
);
reset role;
select is(
  (
    select count(*)
    from public.effective_call_load_forecasts forecast
    join public.port_calls call on call.id = forecast.port_call_id
    where call.external_reference = 'EMPTY-OVERRIDE-042'
  ),
  0::bigint,
  'an override without a baseline disappears after successful reconciliation'
);
select is(
  (
    select forecast.passenger_count
    from public.effective_call_load_forecasts forecast
    join public.port_calls call on call.id = forecast.port_call_id
    where call.external_reference = 'POISON-OVERRIDE-042'
  ),
  333,
  'the failed item stays consistent and effective for a later retry'
);
select is(
  (
    select count(*)
    from public.call_load_forecast_overrides source_override
    join public.port_calls call on call.id = source_override.port_call_id
    where call.external_reference = 'POISON-OVERRIDE-042'
      and source_override.resumed_at is null
  ),
  1::bigint,
  'the poison override remains open instead of being half-reconciled'
);
select ok(
  position(
    'effective_call_load_forecasts' in pg_get_functiondef(
      'public.generate_staffing_requirements(uuid)'::regprocedure
    )
  ) > 0,
  'the staffing generator reads the effective view'
);
select ok(
  position(
    'effective_call_load_forecasts' in pg_get_functiondef(
      'public.get_latest_call_load_forecasts(uuid[])'::regprocedure
    )
  ) > 0,
  'the export RPC reads the effective view'
);
select ok(
  position(
    '''tools-panel''' in pg_get_functiondef(
      'public.create_manual_port_call(uuid,uuid,uuid,uuid,text,timestamptz,timestamptz)'::regprocedure
    )
  ) > 0,
  'the manual escale command hard-codes the human source'
);

select * from finish();
rollback;
