begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_temp;

select plan(84);

select has_function(
  'public',
  'is_current_human_aal2',
  array[]::text[],
  'the database exposes one central human assurance predicate'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.reactivate_agent_record(uuid,uuid,text)',
    'EXECUTE'
  ),
  'the explicit reactivation workflow is available to authenticated managers'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.finalize_due_agent_offboardings(integer)',
    'EXECUTE'
  ) and not has_function_privilege(
    'authenticated',
    'public.finalize_due_agent_offboardings(integer)',
    'EXECUTE'
  ),
  'only the worker can reconcile due departures'
);
select ok(
  not has_table_privilege('authenticated', 'public.agent_offboarding_plans', 'SELECT')
    and has_table_privilege('service_role', 'public.agent_offboarding_plans', 'SELECT'),
  'humans cannot bypass the bounded plan RPC while the worker retains read access'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.get_agent_offboarding_plan(uuid,uuid)',
    'EXECUTE'
  ) and has_function_privilege(
    'authenticated',
    'public.retry_failed_agent_offboarding(uuid,uuid,text)',
    'EXECUTE'
  ),
  'authorized humans use the bounded read and audited retry RPCs'
);
select has_index(
  'public',
  'agent_offboarding_plans',
  'agent_offboarding_plans_access_cutoff',
  'due access checks have a partial user/effective-time index'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.is_agent_employment_active(uuid)',
    'EXECUTE'
  ),
  'the employment predicate is not an authenticated UUID oracle'
);
select col_is_unique(
  'public',
  'agents',
  'user_id',
  'agents keep the one-user/one-agent invariant used by notifications and RLS'
);
select ok(
  position(
    'for update' in lower(pg_get_functiondef(
      'public.complete_agent_offboarding(uuid,timestamptz,text,uuid)'::regprocedure
    ))
  ) > 0
    and position(
      'banned_until is not distinct from $3' in lower(pg_get_functiondef(
        'public.reactivate_agent_record(uuid,uuid,text)'::regprocedure
      ))
    ) > 0,
  'auth bans are captured under lock and restored only when the workflow value still matches'
);
select ok(
  not has_table_privilege('service_role', 'public.agent_offboarding_plans', 'INSERT')
    and not has_table_privilege('service_role', 'public.agent_offboarding_plans', 'UPDATE')
    and not has_table_privilege('service_role', 'public.agent_offboarding_plans', 'DELETE'),
  'service_role cannot mutate plans directly and must use bounded maintenance RPCs'
);
select ok(
  position(
    'user_id::text' in lower(pg_get_functiondef(
      'public.revoke_user_auth_sessions(uuid)'::regprocedure
    ))
  ) = 0
    and position(
      'instance_id is null' in lower(pg_get_functiondef(
        'public.revoke_user_auth_sessions(uuid)'::regprocedure
      ))
    ) > 0 and position(
      'instance_id = $2' in lower(pg_get_functiondef(
        'public.revoke_user_auth_sessions(uuid)'::regprocedure
      ))
    ) > 0,
  'session cleanup never casts indexed columns and uses the refresh-token composite scope'
);
select ok(
  position(
    'select agent.id into locked_agent_id' in lower(pg_get_functiondef(
      'public.finalize_due_agent_offboardings(integer)'::regprocedure
    ))
  ) < position(
    'select plan.* into locked_plan' in lower(pg_get_functiondef(
      'public.finalize_due_agent_offboardings(integer)'::regprocedure
    ))
  ) and position(
    'when deadlock_detected or serialization_failure' in lower(pg_get_functiondef(
      'public.finalize_due_agent_offboardings(integer)'::regprocedure
    ))
  ) > 0,
  'the batch locks agent before plan and never dead-letters transient lock failures'
);

-- The compact validation image exposes an older GoTrue table. Production PG15
-- includes this nullable column; add it transactionally so ban ownership and
-- restoration are exercised functionally as well as by source inspection.
set local role supabase_auth_admin;
alter table auth.users add column if not exists banned_until timestamptz;
reset role;

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '43000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'identity-manager@example.invalid',
    '{}'::jsonb, '{"full_name":"Identity manager"}'::jsonb, now(), now()
  ),
  (
    '43000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'multi-scope-agent@example.invalid',
    '{}'::jsonb, '{"full_name":"Multi-scope agent"}'::jsonb, now(), now()
  ),
  (
    '43000000-0000-4000-8000-000000000003',
    'authenticated', 'authenticated', 'single-scope-agent@example.invalid',
    '{}'::jsonb, '{"full_name":"Single-scope agent"}'::jsonb, now(), now()
  ),
  (
    '43000000-0000-4000-8000-000000000004',
    'authenticated', 'authenticated', 'scheduled-agent@example.invalid',
    '{}'::jsonb, '{"full_name":"Scheduled agent"}'::jsonb, now(), now()
  ),
  (
    '43000000-0000-4000-8000-000000000005',
    'authenticated', 'authenticated', 'future-scope-agent@example.invalid',
    '{}'::jsonb, '{"full_name":"Future scope agent"}'::jsonb, now(), now()
  ),
  (
    '43000000-0000-4000-8000-000000000006',
    'authenticated', 'authenticated', 'legacy-inactive-agent@example.invalid',
    '{}'::jsonb, '{"full_name":"Legacy inactive agent"}'::jsonb, now(), now()
  ),
  (
    '43000000-0000-4000-8000-000000000007',
    'authenticated', 'authenticated', 'legacy-elapsed-agent@example.invalid',
    '{}'::jsonb, '{"full_name":"Legacy elapsed agent"}'::jsonb, now(), now()
  ),
  (
    '43000000-0000-4000-8000-000000000008',
    'authenticated', 'authenticated', 'independently-banned-agent@example.invalid',
    '{}'::jsonb, '{"full_name":"Independently banned agent"}'::jsonb, now(), now()
  );

update auth.users
set banned_until = timestamptz '2099-01-01 00:00:00+00'
where id = '43000000-0000-4000-8000-000000000008';

insert into public.organizations (id, slug, name) values
  ('43000000-0000-4000-8000-000000000011', 'identity-offboard-a', 'Identity A'),
  ('43000000-0000-4000-8000-000000000012', 'identity-offboard-b', 'Identity B');

insert into public.sites (id, organization_id, code, name, timezone) values
  (
    '43000000-0000-4000-8000-000000000021',
    '43000000-0000-4000-8000-000000000011',
    'ID-A', 'Identity site A', 'Europe/Paris'
  ),
  (
    '43000000-0000-4000-8000-000000000022',
    '43000000-0000-4000-8000-000000000012',
    'ID-B', 'Identity site B', 'Europe/Paris'
  ),
  (
    '43000000-0000-4000-8000-000000000023',
    '43000000-0000-4000-8000-000000000011',
    'ID-NY', 'Identity site New York', 'America/New_York'
  );

insert into public.user_role_assignments (
  user_id, organization_id, site_id, role
) values
  (
    '43000000-0000-4000-8000-000000000001',
    '43000000-0000-4000-8000-000000000011',
    null, 'hr'
  ),
  (
    '43000000-0000-4000-8000-000000000002',
    '43000000-0000-4000-8000-000000000011',
    '43000000-0000-4000-8000-000000000021',
    'agent'
  ),
  (
    '43000000-0000-4000-8000-000000000002',
    null,
    null,
    'platform_admin'
  ),
  (
    '43000000-0000-4000-8000-000000000002',
    '43000000-0000-4000-8000-000000000012',
    '43000000-0000-4000-8000-000000000022',
    'agent'
  ),
  (
    '43000000-0000-4000-8000-000000000003',
    '43000000-0000-4000-8000-000000000011',
    '43000000-0000-4000-8000-000000000021',
    'planning_admin'
  ),
  (
    '43000000-0000-4000-8000-000000000004',
    '43000000-0000-4000-8000-000000000011',
    null,
    'agent'
  ),
  (
    '43000000-0000-4000-8000-000000000005',
    '43000000-0000-4000-8000-000000000011',
    '43000000-0000-4000-8000-000000000021',
    'agent'
  ),
  (
    '43000000-0000-4000-8000-000000000006',
    '43000000-0000-4000-8000-000000000011',
    '43000000-0000-4000-8000-000000000021',
    'agent'
  ),
  (
    '43000000-0000-4000-8000-000000000006',
    '43000000-0000-4000-8000-000000000012',
    '43000000-0000-4000-8000-000000000022',
    'agent'
  ),
  (
    '43000000-0000-4000-8000-000000000006',
    null,
    null,
    'platform_admin'
  ),
  (
    '43000000-0000-4000-8000-000000000005',
    '43000000-0000-4000-8000-000000000012',
    '43000000-0000-4000-8000-000000000022',
    'agent'
  ),
  (
    '43000000-0000-4000-8000-000000000007',
    '43000000-0000-4000-8000-000000000011',
    '43000000-0000-4000-8000-000000000021',
    'agent'
  ),
  (
    '43000000-0000-4000-8000-000000000008',
    '43000000-0000-4000-8000-000000000011',
    '43000000-0000-4000-8000-000000000021',
    'agent'
  );

update public.user_role_assignments
set valid_from = clock_timestamp() + interval '1 day'
where user_id = '43000000-0000-4000-8000-000000000005'
  and organization_id = '43000000-0000-4000-8000-000000000012';

insert into public.agents (
  id, organization_id, primary_site_id, user_id, employee_number, display_name
) values
  (
    '43000000-0000-4000-8000-000000000031',
    '43000000-0000-4000-8000-000000000011',
    '43000000-0000-4000-8000-000000000021',
    '43000000-0000-4000-8000-000000000002',
    'ID-MULTI', 'Multi-scope agent'
  ),
  (
    '43000000-0000-4000-8000-000000000032',
    '43000000-0000-4000-8000-000000000011',
    '43000000-0000-4000-8000-000000000021',
    '43000000-0000-4000-8000-000000000003',
    'ID-SINGLE', 'Single-scope agent'
  ),
  (
    '43000000-0000-4000-8000-000000000033',
    '43000000-0000-4000-8000-000000000011',
    '43000000-0000-4000-8000-000000000021',
    '43000000-0000-4000-8000-000000000004',
    'ID-SCHEDULED', 'Scheduled agent'
  ),
  (
    '43000000-0000-4000-8000-000000000034',
    '43000000-0000-4000-8000-000000000011',
    '43000000-0000-4000-8000-000000000021',
    '43000000-0000-4000-8000-000000000005',
    'ID-FUTURE', 'Future scope agent'
  ),
  (
    '43000000-0000-4000-8000-000000000040',
    '43000000-0000-4000-8000-000000000011',
    '43000000-0000-4000-8000-000000000021',
    '43000000-0000-4000-8000-000000000008',
    'ID-INDEPENDENT-BAN', 'Independently banned agent'
  );

insert into public.agents (
  id, organization_id, primary_site_id, employee_number, display_name,
  active, hired_on
) values (
  '43000000-0000-4000-8000-000000000035',
  '43000000-0000-4000-8000-000000000011',
  '43000000-0000-4000-8000-000000000021',
  'ID-FUTURE-HIRE', 'Future hire', true,
  (clock_timestamp() at time zone 'Europe/Paris')::date + 1
);

insert into public.agents (
  id, organization_id, primary_site_id, user_id, employee_number,
  display_name, active, left_on
) values (
  '43000000-0000-4000-8000-000000000036',
  '43000000-0000-4000-8000-000000000011',
  '43000000-0000-4000-8000-000000000021',
  '43000000-0000-4000-8000-000000000006',
  'ID-LEGACY-INACTIVE', 'Legacy inactive agent', false, current_date - 1
);

insert into public.agents (
  id, organization_id, primary_site_id, user_id, employee_number,
  display_name, active, left_on
) values (
  '43000000-0000-4000-8000-000000000037',
  '43000000-0000-4000-8000-000000000011',
  '43000000-0000-4000-8000-000000000021',
  '43000000-0000-4000-8000-000000000007',
  'ID-LEGACY-ELAPSED', 'Legacy elapsed agent', true,
  (clock_timestamp() at time zone 'Europe/Paris')::date - 1
);

insert into public.agents (
  id, organization_id, primary_site_id, employee_number,
  display_name, active, left_on
) values
  (
    '43000000-0000-4000-8000-000000000038',
    '43000000-0000-4000-8000-000000000011',
    '43000000-0000-4000-8000-000000000021',
    'ID-PARIS-BOUNDARY', 'Paris boundary', true,
    (clock_timestamp() at time zone 'Europe/Paris')::date
  ),
  (
    '43000000-0000-4000-8000-000000000039',
    '43000000-0000-4000-8000-000000000011',
    '43000000-0000-4000-8000-000000000023',
    'ID-NY-BOUNDARY', 'New York boundary', true,
    (clock_timestamp() at time zone 'America/New_York')::date
  );

insert into public.agent_groups (
  id, organization_id, site_id, code, name
) values (
  '43000000-0000-4000-8000-000000000044',
  '43000000-0000-4000-8000-000000000011',
  '43000000-0000-4000-8000-000000000023',
  'ID-NY-GROUP',
  'New York boundary group'
);
insert into public.agent_group_memberships (
  organization_id, group_id, agent_id, effective_from, effective_until
) values (
  '43000000-0000-4000-8000-000000000011',
  '43000000-0000-4000-8000-000000000044',
  '43000000-0000-4000-8000-000000000039',
  (clock_timestamp() at time zone 'America/New_York')::date - 1,
  (clock_timestamp() at time zone 'America/New_York')::date
);

insert into public.skills (id, organization_id, code, name)
values (
  '43000000-0000-4000-8000-000000000041',
  '43000000-0000-4000-8000-000000000011',
  'ID-SKILL', 'Identity skill'
);
insert into public.agent_skills (
  id, organization_id, agent_id, skill_id, level, valid_from
) values (
  '43000000-0000-4000-8000-000000000042',
  '43000000-0000-4000-8000-000000000011',
  '43000000-0000-4000-8000-000000000031',
  '43000000-0000-4000-8000-000000000041',
  3, current_date
);

insert into public.agent_notifications (
  organization_id, site_id, agent_id, channel, subject, body, idempotency_key
) values (
  '43000000-0000-4000-8000-000000000011',
  '43000000-0000-4000-8000-000000000021',
  '43000000-0000-4000-8000-000000000033',
  'in_app', 'Test MFA', 'Notification visible uniquement en AAL2',
  'identity-aal2-notification'
);

select ok(
  not public.is_agent_employment_active(
    '43000000-0000-4000-8000-000000000035'
  ),
  'an agent hired in the future is not employment-active'
);

select set_config('request.jwt.claim.sub', '43000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.aal', 'aal1', true);

select ok(not public.is_current_human_aal2(), 'aal1 fails the central assurance predicate');
select ok(not public.is_current_app_user_active(), 'aal1 cannot be an active business identity');
select ok(
  not public.has_role(
    '43000000-0000-4000-8000-000000000011',
    '43000000-0000-4000-8000-000000000021',
    array['hr']::public.app_role[]
  ),
  'aal1 cannot exercise an otherwise valid role'
);
select is(
  public.get_my_access_context(),
  null::jsonb,
  'aal1 receives no access context'
);
select throws_ok(
  $$select public.update_agent_record(
    '43000000-0000-4000-8000-000000000031',
    '43000000-0000-4000-8000-000000000011',
    '{"active":false,"offboardingReason":"Tentative AAL1"}'::jsonb
  )$$,
  'P2003',
  'Autorisation insuffisante pour ce collaborateur',
  'aal1 cannot call a security-definer business command'
);

select set_config('request.jwt.claim.sub', '43000000-0000-4000-8000-000000000004', true);
select is(
  public.get_my_notifications(30, false),
  '[]'::jsonb,
  'aal1 cannot bypass the notification SECURITY DEFINER RPC'
);
select throws_ok(
  $$select public.get_agent_hour_balance(
    '43000000-0000-4000-8000-000000000033', current_date, null
  )$$,
  '42501',
  'Active account required',
  'aal1 cannot bypass the hour-balance SECURITY DEFINER RPC'
);

select set_config('request.jwt.claim.aal', 'aal2', true);
select is(
  jsonb_array_length(public.get_my_notifications(30, false)),
  1,
  'an active employed agent receives notifications at aal2'
);

select set_config('request.jwt.claim.sub', '43000000-0000-4000-8000-000000000006', true);
select ok(
  not public.has_role(
    '43000000-0000-4000-8000-000000000011',
    '43000000-0000-4000-8000-000000000021',
    array['agent', 'platform_admin']::public.app_role[]
  ),
  'an inactive historical agent has no old-organization or global access without a plan'
);
select ok(
  public.has_role(
    '43000000-0000-4000-8000-000000000012',
    '43000000-0000-4000-8000-000000000022',
    array['agent']::public.app_role[]
  ),
  'the same historical identity keeps an unrelated scoped organization role'
);

select set_config('request.jwt.claim.sub', '43000000-0000-4000-8000-000000000001', true);

select ok(public.is_current_human_aal2(), 'aal2 satisfies the central assurance predicate');
select set_config('request.jwt.claim.is_anonymous', 'true', true);
select ok(
  not public.is_current_human_aal2(),
  'an anonymous authenticated session is rejected even when it carries aal2'
);
select set_config('request.jwt.claim.is_anonymous', 'false', true);
select ok(
  public.has_organization_role(
    '43000000-0000-4000-8000-000000000011',
    array['hr']::public.app_role[]
  ),
  'aal2 can exercise the configured organization role'
);
select isnt(
  public.get_my_access_context(),
  null::jsonb,
  'aal2 receives its access context'
);
select ok(
  position(
    'next_left_on < (clock_timestamp() at time zone target_timezone)::date'
    in lower(pg_get_functiondef(
      'public.update_agent_record(uuid,uuid,jsonb)'::regprocedure
    ))
  ) > 0 and position(
    'next_left_on < (clock_timestamp() at time zone target_timezone)::date'
    in lower(pg_get_functiondef(
      'public.update_agent_record(uuid,uuid,jsonb)'::regprocedure
    ))
  ) < position(
    'offboarding_requested :='
    in lower(pg_get_functiondef(
      'public.update_agent_record(uuid,uuid,jsonb)'::regprocedure
    ))
  ),
  'lifecycle normalization uses the site-local date before offboarding is decided'
);
select public.update_agent_record(
  '43000000-0000-4000-8000-000000000038',
  '43000000-0000-4000-8000-000000000011',
  '{"displayName":"Paris boundary retained"}'::jsonb
);
select is(
  (
    select active from public.agents
    where id = '43000000-0000-4000-8000-000000000038'
  ),
  true,
  'an agent remains active through the Paris left_on local calendar day'
);
select public.update_agent_record(
  '43000000-0000-4000-8000-000000000039',
  '43000000-0000-4000-8000-000000000011',
  '{"displayName":"New York boundary retained"}'::jsonb
);
select is(
  (
    select active from public.agents
    where id = '43000000-0000-4000-8000-000000000039'
  ),
  true,
  'an agent remains active through the New York left_on local calendar day'
);
select set_config('TimeZone', 'UTC-24', true);
select throws_ok(
  $$update public.agents
    set primary_site_id = '43000000-0000-4000-8000-000000000021'
    where id = '43000000-0000-4000-8000-000000000039'$$,
  'P2086',
  'End active cross-site group memberships before moving this agent.',
  'an old-site membership remains blocking through the New York local calendar day'
);
select set_config('TimeZone', 'UTC', true);
select throws_ok(
  $$select public.update_agent_record(
    '43000000-0000-4000-8000-000000000037',
    '43000000-0000-4000-8000-000000000011',
    '{"displayName":"Legacy elapsed edit"}'::jsonb
  )$$,
  'P2001',
  'Un motif de départ de 3 à 500 caractères est obligatoire',
  'editing an elapsed legacy employment cannot silently bypass the reason workflow'
);
select public.update_agent_record(
  '43000000-0000-4000-8000-000000000037',
  '43000000-0000-4000-8000-000000000011',
  '{"displayName":"Legacy elapsed edit","offboardingReason":"Régularisation du départ historique"}'::jsonb
);
select ok(
  not (
    select active from public.agents
    where id = '43000000-0000-4000-8000-000000000037'
  ) and (
    select status = 'completed'
    from public.agent_offboarding_plans
    where agent_id = '43000000-0000-4000-8000-000000000037'
  ) and not exists (
    select 1
    from public.user_role_assignments assignment
    where assignment.user_id = '43000000-0000-4000-8000-000000000007'
      and assignment.organization_id = '43000000-0000-4000-8000-000000000011'
      and assignment.valid_from <= clock_timestamp()
      and (assignment.valid_until is null or assignment.valid_until > clock_timestamp())
  ),
  'an elapsed legacy edit completes the transactional role cleanup after a reason'
);
update auth.users
set banned_until = timestamptz '2098-01-01 00:00:00+00'
where id = '43000000-0000-4000-8000-000000000007';
select throws_ok(
  $$select public.reactivate_agent_record(
    '43000000-0000-4000-8000-000000000037',
    '43000000-0000-4000-8000-000000000011',
    'Tentative après modification indépendante du verrou'
  )$$,
  'P2003',
  'Le verrou d’authentification a changé depuis le départ; une revue de sécurité est requise',
  'reactivation refuses an offboarding-owned ban changed by a concurrent security action'
);
select ok(
  not (
    select active from public.agents
    where id = '43000000-0000-4000-8000-000000000037'
  ) and (
    select status = 'disabled' from public.app_users
    where id = '43000000-0000-4000-8000-000000000007'
  ) and not exists (
    select 1 from public.user_role_assignments assignment
    where assignment.user_id = '43000000-0000-4000-8000-000000000007'
      and assignment.valid_from <= clock_timestamp()
      and (assignment.valid_until is null or assignment.valid_until > clock_timestamp())
  ),
  'a changed auth ban rolls back agent, account and minimal-role reactivation'
);
update auth.users auth_user
set banned_until = plan.auth_ban_value
from public.agent_offboarding_plans plan
where auth_user.id = '43000000-0000-4000-8000-000000000007'
  and plan.agent_id = '43000000-0000-4000-8000-000000000037';
update public.app_users
set status = 'disabled'
where id = '43000000-0000-4000-8000-000000000007';
select throws_ok(
  $$select public.reactivate_agent_record(
    '43000000-0000-4000-8000-000000000037',
    '43000000-0000-4000-8000-000000000011',
    'Tentative après réaffirmation indépendante du statut'
  )$$,
  'P2003',
  'Le statut du compte a changé depuis le départ; une revue de sécurité est requise',
  'even a disabled-to-disabled status action invalidates offboarding provenance'
);
select ok(
  not (
    select active from public.agents
    where id = '43000000-0000-4000-8000-000000000037'
  ) and (
    select status = 'completed' from public.agent_offboarding_plans
    where agent_id = '43000000-0000-4000-8000-000000000037'
  ) and not exists (
    select 1 from public.user_role_assignments assignment
    where assignment.user_id = '43000000-0000-4000-8000-000000000007'
      and assignment.valid_from <= clock_timestamp()
      and (assignment.valid_until is null or assignment.valid_until > clock_timestamp())
  ),
  'a changed account-status marker rolls back the complete reactivation workflow'
);
select throws_ok(
  $$select public.update_agent_record(
    '43000000-0000-4000-8000-000000000031',
    '43000000-0000-4000-8000-000000000011',
    '{"active":false}'::jsonb
  )$$,
  'P2001',
  'Un motif de départ de 3 à 500 caractères est obligatoire',
  'offboarding cannot be performed without a reason'
);

select lives_ok(
  $$select public.update_agent_record(
    '43000000-0000-4000-8000-000000000031',
    '43000000-0000-4000-8000-000000000011',
    '{"active":false,"offboardingReason":"Fin de mission sur le périmètre A"}'::jsonb
  )$$,
  'offboarding is transactional at aal2'
);
select ok(
  not (select active from public.agents where id = '43000000-0000-4000-8000-000000000031'),
  'the departed agent is immediately inactive'
);
select is(
  (
    select count(*)::integer
    from public.user_role_assignments assignment
    where assignment.user_id = '43000000-0000-4000-8000-000000000002'
      and assignment.organization_id = '43000000-0000-4000-8000-000000000011'
      and (assignment.valid_until is null or assignment.valid_until > clock_timestamp())
  ),
  0,
  'roles in the departed organization expire immediately'
);
select is(
  (
    select count(*)::integer
    from public.user_role_assignments assignment
    where assignment.user_id = '43000000-0000-4000-8000-000000000002'
      and assignment.organization_id = '43000000-0000-4000-8000-000000000012'
      and (assignment.valid_until is null or assignment.valid_until > clock_timestamp())
  ),
  1,
  'an unrelated active organization role is preserved'
);
select is(
  (
    select count(*)::integer
    from public.user_role_assignments assignment
    where assignment.user_id = '43000000-0000-4000-8000-000000000002'
      and assignment.role = 'platform_admin'
      and (assignment.valid_until is null or assignment.valid_until > clock_timestamp())
  ),
  0,
  'global platform authority always expires with the unique linked agent'
);
select is(
  (select status::text from public.app_users where id = '43000000-0000-4000-8000-000000000002'),
  'active',
  'the multi-organization account remains active'
);
select is(
  (
    select reason
    from public.audit_events
    where resource_id = '43000000-0000-4000-8000-000000000031'
      and action = 'workforce.agent.offboarded'
    order by id desc
    limit 1
  ),
  'Fin de mission sur le périmètre A',
  'the mandatory reason is recorded in the immutable audit trail'
);

select set_config('request.jwt.claim.sub', '43000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claim.aal', 'aal2', true);
select is(
  jsonb_array_length(public.get_my_access_context() -> 'assignments'),
  1,
  'the multi-organization user retains only the legitimate scope'
);
select throws_ok(
  $$select public.get_agent_hour_balance(
    '43000000-0000-4000-8000-000000000031', current_date, null
  )$$,
  '42501',
  'Insufficient permissions',
  'an old self identity cannot read balances through authority held elsewhere'
);

create temporary table identity_observations (
  observation text primary key,
  numeric_value bigint
);
grant all on table identity_observations to authenticated;

set local role authenticated;
insert into identity_observations values (
  'departed_self_skills',
  (select count(*) from public.agent_skills where agent_id = '43000000-0000-4000-8000-000000000031')
);
insert into identity_observations values (
  'other_scope_sites',
  (select count(*) from public.sites where id = '43000000-0000-4000-8000-000000000022')
);
reset role;

select is(
  (select numeric_value from identity_observations where observation = 'departed_self_skills'),
  0::bigint,
  'the inactive agent immediately loses self access to old workforce data'
);
select is(
  (select numeric_value from identity_observations where observation = 'other_scope_sites'),
  1::bigint,
  'the same account still accesses its other legitimate organization'
);

update auth.users
set instance_id = '43000000-0000-4000-8000-000000000099'
where id = '43000000-0000-4000-8000-000000000005';

insert into auth.refresh_tokens (
  token, user_id, instance_id, revoked, created_at, updated_at
)
values
  (
    'identity-refresh-token',
    '43000000-0000-4000-8000-000000000003',
    null,
    false,
    now(),
    now()
  ),
  (
    'identity-future-scope-refresh-token',
    '43000000-0000-4000-8000-000000000005',
    '43000000-0000-4000-8000-000000000099',
    false,
    now(),
    now()
  );

select set_config('request.jwt.claim.sub', '43000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.aal', 'aal2', true);
select public.update_agent_record(
  '43000000-0000-4000-8000-000000000032',
  '43000000-0000-4000-8000-000000000011',
  '{"active":false,"offboardingReason":"Départ définitif sans autre périmètre"}'::jsonb
);

update auth.users
set raw_user_meta_data = '{"full_name":"Single-scope metadata corrected"}'::jsonb
where id = '43000000-0000-4000-8000-000000000003';

select lives_ok(
  $$select public.update_agent_record(
    '43000000-0000-4000-8000-000000000032',
    '43000000-0000-4000-8000-000000000011',
    '{"primarySiteId":"43000000-0000-4000-8000-000000000021","employeeNumber":"ID-SINGLE-EDIT","displayName":"Single-scope ordinary correction","active":false,"leftOn":null}'::jsonb
  )$$,
  'an inactive agent accepts an ordinary web-shaped edit with unchanged lifecycle values'
);

select is(
  (select status::text from public.app_users where id = '43000000-0000-4000-8000-000000000003'),
  'disabled',
  'an account without another legitimate authority is disabled'
);
select is(
  (select count(*)::integer from auth.refresh_tokens where user_id = '43000000-0000-4000-8000-000000000003'),
  0,
  'refresh tokens are revoked when the relation exists'
);
select ok(
  position(
    'to_regclass(''auth.sessions'')' in pg_get_functiondef(
      'public.revoke_user_auth_sessions(uuid)'::regprocedure
    )
  ) > 0,
  'session revocation is conditional for GoTrue schemas where sessions exists'
);
select throws_ok(
  $$select public.update_agent_record(
    '43000000-0000-4000-8000-000000000032',
    '43000000-0000-4000-8000-000000000011',
    '{"leftOn":"2099-01-01","offboardingReason":"Correction après départ effectif"}'::jsonb
  )$$,
  'P2003',
  'Le cycle de vie d’un collaborateur inactif exige le workflow de réactivation',
  'an inactive agent cannot overwrite completed offboarding through a leftOn correction'
);
select ok(
  (
    select plan.status = 'completed'
      and plan.account_disabled_by_offboarding
      and plan.auth_ban_applied_by_offboarding
      and plan.auth_ban_value is not null
      and auth_user.banned_until is not distinct from plan.auth_ban_value
      and app_user.status_changed_at is not distinct from plan.account_disabled_at
    from public.agent_offboarding_plans plan
    join auth.users auth_user on auth_user.id = plan.user_id
    join public.app_users app_user on app_user.id = plan.user_id
    where plan.agent_id = '43000000-0000-4000-8000-000000000032'
  ),
  'metadata and the rejected inactive edit preserve status and owned-ban provenance exactly'
);
select throws_ok(
  $$update public.agents set active = true
    where id = '43000000-0000-4000-8000-000000000032'$$,
  'P2003',
  'La réactivation exige le workflow dédié',
  'direct reactivation is blocked even for a privileged database caller'
);
select lives_ok(
  $$select public.reactivate_agent_record(
    '43000000-0000-4000-8000-000000000032',
    '43000000-0000-4000-8000-000000000011',
    'Retour validé par les ressources humaines'
  )$$,
  'the dedicated workflow can reactivate the agent'
);
select ok(
  (select active from public.agents where id = '43000000-0000-4000-8000-000000000032')
    and (select status = 'active' from public.app_users where id = '43000000-0000-4000-8000-000000000003')
    and (select banned_until is null from auth.users where id = '43000000-0000-4000-8000-000000000003')
    and (select status = 'cancelled' from public.agent_offboarding_plans where agent_id = '43000000-0000-4000-8000-000000000032'),
  'reactivation restores the agent, application identity, owned ban and plan state'
);
select is(
  (
    select jsonb_agg(assignment.role order by assignment.role)
    from public.user_role_assignments assignment
    where assignment.user_id = '43000000-0000-4000-8000-000000000003'
      and assignment.valid_from <= clock_timestamp()
      and (assignment.valid_until is null or assignment.valid_until > clock_timestamp())
  ),
  '["agent"]'::jsonb,
  'reactivation creates only minimal agent authority and never revives admin roles'
);

select public.update_agent_record(
  '43000000-0000-4000-8000-000000000040',
  '43000000-0000-4000-8000-000000000011',
  '{"active":false,"offboardingReason":"Départ avec suspension sécurité préexistante"}'::jsonb
);
select throws_ok(
  $$select public.reactivate_agent_record(
    '43000000-0000-4000-8000-000000000040',
    '43000000-0000-4000-8000-000000000011',
    'Tentative malgré la suspension indépendante'
  )$$,
  'P2003',
  'Une suspension de sécurité indépendante bloque la réactivation',
  'reactivation refuses an independently owned active authentication ban'
);
select ok(
  not (
    select active from public.agents
    where id = '43000000-0000-4000-8000-000000000040'
  ) and (
    select status = 'disabled' from public.app_users
    where id = '43000000-0000-4000-8000-000000000008'
  ) and (
    select plan.status = 'completed'
      and plan.account_disabled_by_offboarding
      and not plan.auth_ban_applied_by_offboarding
      and plan.prior_auth_banned_until = timestamptz '2099-01-01 00:00:00+00'
    from public.agent_offboarding_plans plan
    where plan.agent_id = '43000000-0000-4000-8000-000000000040'
  ) and not exists (
    select 1 from public.user_role_assignments assignment
    where assignment.user_id = '43000000-0000-4000-8000-000000000008'
      and assignment.valid_from <= clock_timestamp()
      and (assignment.valid_until is null or assignment.valid_until > clock_timestamp())
  ),
  'an independent ban conflict rolls back agent, account, plan and minimal-role mutation'
);

select public.update_agent_record(
  '43000000-0000-4000-8000-000000000034',
  '43000000-0000-4000-8000-000000000011',
  '{"active":false,"offboardingReason":"Fin du périmètre avant prise de poste future"}'::jsonb
);
select is(
  (select status::text from public.app_users where id = '43000000-0000-4000-8000-000000000005'),
  'active',
  'a legitimate future assignment keeps the account activatable at its threshold'
);
select is(
  (
    select count(*)::integer from auth.refresh_tokens
    where user_id = '43000000-0000-4000-8000-000000000005'
  ),
  0,
  'sessions are still revoked when only future authority remains'
);
select set_config('request.jwt.claim.sub', '43000000-0000-4000-8000-000000000005', true);
select ok(
  not public.has_role(
    '43000000-0000-4000-8000-000000000012',
    '43000000-0000-4000-8000-000000000022',
    array['agent']::public.app_role[]
  ),
  'future authority grants no access before valid_from'
);
update public.user_role_assignments
set valid_from = clock_timestamp() - interval '1 second'
where user_id = '43000000-0000-4000-8000-000000000005'
  and organization_id = '43000000-0000-4000-8000-000000000012';
select ok(
  public.has_role(
    '43000000-0000-4000-8000-000000000012',
    '43000000-0000-4000-8000-000000000022',
    array['agent']::public.app_role[]
  ),
  'future authority becomes usable exactly after valid_from without an orphan ban'
);
select set_config('request.jwt.claim.sub', '43000000-0000-4000-8000-000000000001', true);

select public.update_agent_record(
  '43000000-0000-4000-8000-000000000033',
  '43000000-0000-4000-8000-000000000011',
  jsonb_build_object(
    'leftOn', '2027-03-13',
    'offboardingReason', 'Départ planifié puis changement de zone'
  )
);
select is(
  (
    select effective_at
    from public.agent_offboarding_plans
    where agent_id = '43000000-0000-4000-8000-000000000033'
  ),
  timestamptz '2027-03-13 23:00:00+00',
  'the initial departure deadline uses the current Paris site timezone'
);
create temporary table identity_schedule_snapshot as
select requested_by, requested_at, reason, effective_at
from public.agent_offboarding_plans
where agent_id = '43000000-0000-4000-8000-000000000033';

select public.update_agent_record(
  '43000000-0000-4000-8000-000000000033',
  '43000000-0000-4000-8000-000000000011',
  jsonb_build_object(
    'primarySiteId', '43000000-0000-4000-8000-000000000023'
  )
);
select is(
  (
    select effective_at
    from public.agent_offboarding_plans
    where agent_id = '43000000-0000-4000-8000-000000000033'
  ),
  timestamptz '2027-03-14 05:00:00+00',
  'leftOn becomes effective at the next local midnight across the New York DST boundary'
);
select ok(
  exists (
    select 1
    from public.agent_offboarding_plans plan
    cross join identity_schedule_snapshot snapshot
    where plan.agent_id = '43000000-0000-4000-8000-000000000033'
      and plan.requested_by = snapshot.requested_by
      and plan.requested_at = snapshot.requested_at
      and plan.reason = snapshot.reason
  ) and exists (
    select 1 from public.audit_events
    where action = 'workforce.agent.offboarding-rescheduled'
      and resource_id = (
        select id::text from public.agent_offboarding_plans
        where agent_id = '43000000-0000-4000-8000-000000000033'
      )
  ),
  'moving a scheduled agent recalculates the deadline while preserving provenance and auditing the move'
);
select is(
  (
    select count(*)::integer
    from public.user_role_assignments assignment
    where assignment.user_id = '43000000-0000-4000-8000-000000000004'
      and (assignment.valid_until is null or assignment.valid_until > clock_timestamp())
  ),
  1,
  'scheduling a future departure does not truncate roles'
);
select public.reactivate_agent_record(
  '43000000-0000-4000-8000-000000000033',
  '43000000-0000-4000-8000-000000000011',
  'Annulation du départ avant son échéance'
);
select is(
  (
    select status
    from public.agent_offboarding_plans
    where agent_id = '43000000-0000-4000-8000-000000000033'
  ),
  'cancelled',
  'the dedicated workflow cancels a scheduled departure atomically'
);
select is(
  (
    select count(*)::integer
    from public.user_role_assignments assignment
    where assignment.user_id = '43000000-0000-4000-8000-000000000004'
      and (assignment.valid_until is null or assignment.valid_until > clock_timestamp())
  ),
  1,
  'cancelling before the deadline preserves the exact role set'
);

select public.update_agent_record(
  '43000000-0000-4000-8000-000000000033',
  '43000000-0000-4000-8000-000000000011',
  jsonb_build_object(
    'leftOn', (current_date + 1)::text,
    'offboardingReason', 'Nouveau départ planifié et validé'
  )
);
select is(
  (
    select status from public.agent_offboarding_plans
    where agent_id = '43000000-0000-4000-8000-000000000033'
  ),
  'scheduled',
  'a future departure is scheduled without premature deactivation'
);

update public.agent_offboarding_plans
set effective_at = clock_timestamp() - interval '1 second',
    status = 'failed',
    failure_count = 5,
    last_failed_at = clock_timestamp(),
    last_error_code = 'P0001'
where agent_id = '43000000-0000-4000-8000-000000000033';
select throws_ok(
  $$select public.update_agent_record(
    '43000000-0000-4000-8000-000000000033',
    '43000000-0000-4000-8000-000000000011',
    '{"primarySiteId":"43000000-0000-4000-8000-000000000021"}'::jsonb
  )$$,
  'P2003',
  'Relancez ou annulez le départ en échec avant de changer de zone',
  'a failed departure must be explicitly retried or cancelled before moving zones'
);
select is(
  public.get_agent_offboarding_plan(
    '43000000-0000-4000-8000-000000000033',
    '43000000-0000-4000-8000-000000000011'
  ) ->> 'retryCount',
  '5',
  'the manager reads the bounded current failure state'
);
select ok(
  not (
    public.get_agent_offboarding_plan(
      '43000000-0000-4000-8000-000000000033',
      '43000000-0000-4000-8000-000000000011'
    ) ? 'reason'
  ),
  'the plan RPC never exposes the offboarding reason or internal provenance'
);
select is(
  public.retry_failed_agent_offboarding(
    '43000000-0000-4000-8000-000000000033',
    '43000000-0000-4000-8000-000000000011',
    'Incident technique corrigé et vérifié'
  ) ->> 'retryCount',
  '0',
  'an authorized retry returns the failed plan to the scheduled queue'
);
select ok(
  exists (
    select 1 from public.audit_events
    where resource_type = 'agent_offboarding_plan'
      and action = 'workforce.agent.offboarding-retry-requested'
      and resource_id = (
        select id::text from public.agent_offboarding_plans
        where agent_id = '43000000-0000-4000-8000-000000000033'
      )
  ),
  'the failed-plan retry is immutably audited'
);

select set_config('request.jwt.claim.sub', '43000000-0000-4000-8000-000000000004', true);
select ok(
  not public.has_role(
    '43000000-0000-4000-8000-000000000011',
    '43000000-0000-4000-8000-000000000023',
    array['agent']::public.app_role[]
  ),
  'a due scheduled plan cuts role access even before the worker runs'
);
select is(
  jsonb_array_length(public.get_my_access_context() -> 'assignments'),
  0,
  'the access context is fail-closed while due offboarding maintenance is delayed'
);

insert into public.agent_offboarding_plans (
  organization_id, agent_id, effective_at, reason, status, requested_by,
  failure_count, last_failed_at, last_error_code
) values (
  '43000000-0000-4000-8000-000000000011',
  '43000000-0000-4000-8000-000000000035',
  clock_timestamp() - interval '1 minute',
  'Plan empoisonné conservé pour les opérations',
  'failed',
  '43000000-0000-4000-8000-000000000001',
  5,
  clock_timestamp(),
  'P0001'
);

select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.aal', '', true);
create temporary table identity_worker_result (payload jsonb not null);
insert into identity_worker_result
select public.finalize_due_agent_offboardings(10);
select is(
  (select payload ->> 'completedCount' from identity_worker_result),
  '1',
  'the bounded worker finalizes a due departure'
);
select is(
  (select payload ->> 'deadLetteredCount' from identity_worker_result),
  '1',
  'maintenance reports the persistent failed-plan backlog to health monitoring'
);
select ok(
  not (select active from public.agents where id = '43000000-0000-4000-8000-000000000033'),
  'due departure reconciliation deactivates the agent'
);

select ok(
  not public.has_role(
    '43000000-0000-4000-8000-000000000011',
    '43000000-0000-4000-8000-000000000021',
    array['planning_admin']::public.app_role[]
  ),
  'service_role has no implicit human business authority'
);
select set_config('app.maritime_machine_feed', 'true', true);
select ok(
  public.has_role(
    '43000000-0000-4000-8000-000000000011',
    '43000000-0000-4000-8000-000000000021',
    array['planning_admin']::public.app_role[]
  ),
  'the machine exception exists only inside the explicit maritime scope'
);

select * from finish();
rollback;
