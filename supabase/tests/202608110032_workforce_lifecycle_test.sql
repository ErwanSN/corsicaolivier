begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_temp;

select plan(19);

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
  '32000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'workforce-manager@example.invalid',
  '{}'::jsonb,
  '{"full_name":"Workforce manager"}'::jsonb,
  now(),
  now()
);

insert into public.organizations (id, slug, name)
values (
  '32000000-0000-4000-8000-000000000002',
  'workforce-lifecycle-test',
  'Workforce lifecycle test'
);

insert into public.sites (id, organization_id, code, name, timezone)
values (
  '32000000-0000-4000-8000-000000000003',
  '32000000-0000-4000-8000-000000000002',
  'WF-LIFE',
  'Workforce lifecycle site',
  'Europe/Paris'
);

insert into public.user_role_assignments (
  user_id,
  organization_id,
  site_id,
  role
) values (
  '32000000-0000-4000-8000-000000000001',
  '32000000-0000-4000-8000-000000000002',
  '32000000-0000-4000-8000-000000000003',
  'planning_admin'
);

insert into public.agents (
  id,
  organization_id,
  primary_site_id,
  employee_number,
  display_name
) values (
  '32000000-0000-4000-8000-000000000004',
  '32000000-0000-4000-8000-000000000002',
  '32000000-0000-4000-8000-000000000003',
  'WF-LIFE-1',
  'Agent lifecycle'
);

insert into public.organizations (id, slug, name)
values (
  '32100000-0000-4000-8000-000000000002',
  'workforce-lifecycle-outsider',
  'Workforce lifecycle outsider'
);

insert into public.sites (id, organization_id, code, name, timezone)
values (
  '32100000-0000-4000-8000-000000000003',
  '32100000-0000-4000-8000-000000000002',
  'WF-OTHER',
  'Other workforce site',
  'Europe/Paris'
);

insert into public.agents (
  id,
  organization_id,
  primary_site_id,
  employee_number,
  display_name
) values (
  '32100000-0000-4000-8000-000000000004',
  '32100000-0000-4000-8000-000000000002',
  '32100000-0000-4000-8000-000000000003',
  'WF-OTHER-1',
  'Agent outside scope'
);

insert into public.skills (id, organization_id, code, name)
values (
  '32000000-0000-4000-8000-000000000005',
  '32000000-0000-4000-8000-000000000002',
  'WF-SKILL',
  'Workforce skill'
);

insert into public.positions (id, organization_id, site_id, code, name)
values (
  '32000000-0000-4000-8000-000000000006',
  '32000000-0000-4000-8000-000000000002',
  '32000000-0000-4000-8000-000000000003',
  'WF-POS',
  'Workforce position'
);

insert into public.agent_groups (
  id,
  organization_id,
  site_id,
  code,
  name
) values
  (
    '32000000-0000-4000-8000-000000000007',
    '32000000-0000-4000-8000-000000000002',
    null,
    'WF-GRP-A',
    'Workforce group A'
  ),
  (
    '32000000-0000-4000-8000-000000000008',
    '32000000-0000-4000-8000-000000000002',
    null,
    'WF-GRP-B',
    'Workforce group B'
  );

select set_config(
  'request.jwt.claim.sub',
  '32000000-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.aal', 'aal2', true);
select set_config('request.jwt.claim.is_anonymous', 'false', true);

select ok(
  has_function_privilege(
    'authenticated',
    'public.replace_agent_contract(uuid,uuid,date,integer,integer,text,numeric,date)',
    'EXECUTE'
  ),
  'authenticated can execute the contract replacement command'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.replace_agent_contract(uuid,uuid,date,integer,integer,text,numeric,date)',
    'EXECUTE'
  ),
  'anon cannot execute the contract replacement command'
);

select throws_ok(
  $$select public.replace_agent_contract(
    '32100000-0000-4000-8000-000000000004',
    '32100000-0000-4000-8000-000000000002',
    date '2036-01-01',
    2100
  )$$,
  'P2003',
  'Autorisation insuffisante pour ce collaborateur',
  'a security-definer command cannot cross the authorized scope'
);

select lives_ok(
  $$select public.replace_agent_contract(
    '32000000-0000-4000-8000-000000000004',
    '32000000-0000-4000-8000-000000000002',
    date '2036-01-01',
    2100
  )$$,
  'a first contract is recorded'
);

select lives_ok(
  $$select public.replace_agent_contract(
    '32000000-0000-4000-8000-000000000004',
    '32000000-0000-4000-8000-000000000002',
    date '2036-02-01',
    1800
  )$$,
  'a replacement contract closes the former version atomically'
);

select is(
  (
    select contract.effective_until
    from public.agent_contract_versions contract
    where contract.agent_id = '32000000-0000-4000-8000-000000000004'
      and contract.effective_from = date '2036-01-01'
  ),
  date '2036-01-31',
  'the former contract ends the day before its replacement'
);

select lives_ok(
  $$select public.replace_agent_skill(
    '32000000-0000-4000-8000-000000000004',
    '32000000-0000-4000-8000-000000000002',
    '32000000-0000-4000-8000-000000000005',
    2,
    date '2036-01-01'
  )$$,
  'an agent skill is recorded'
);

select lives_ok(
  $$select public.replace_agent_skill(
    '32000000-0000-4000-8000-000000000004',
    '32000000-0000-4000-8000-000000000002',
    '32000000-0000-4000-8000-000000000005',
    4,
    date '2036-03-01'
  )$$,
  'a skill level is replaced without overlapping history'
);

select is(
  (
    select agent_skill.valid_until
    from public.agent_skills agent_skill
    where agent_skill.agent_id = '32000000-0000-4000-8000-000000000004'
      and agent_skill.valid_from = date '2036-01-01'
  ),
  date '2036-02-29',
  'the former skill version is closed'
);

select lives_ok(
  $$select public.replace_agent_position_preference(
    '32000000-0000-4000-8000-000000000004',
    '32000000-0000-4000-8000-000000000002',
    '32000000-0000-4000-8000-000000000006',
    'preferred',
    3,
    date '2036-01-01'
  )$$,
  'a position preference is recorded'
);

select lives_ok(
  $$select public.replace_agent_position_restriction(
    '32000000-0000-4000-8000-000000000004',
    '32000000-0000-4000-8000-000000000002',
    '32000000-0000-4000-8000-000000000006',
    'Restriction de test',
    date '2036-04-01'
  )$$,
  'a restriction supersedes the preference'
);

select is(
  (
    select preference.valid_until
    from public.agent_position_preferences preference
    where preference.agent_id = '32000000-0000-4000-8000-000000000004'
      and preference.valid_from = date '2036-01-01'
  ),
  date '2036-03-31',
  'the preference closes before the restriction starts'
);

select lives_ok(
  $$select public.replace_agent_group_membership(
    '32000000-0000-4000-8000-000000000007',
    '32000000-0000-4000-8000-000000000004',
    '32000000-0000-4000-8000-000000000002',
    date '2036-01-01',
    true
  )$$,
  'a first primary group is recorded'
);

select lives_ok(
  $$select public.replace_agent_group_membership(
    '32000000-0000-4000-8000-000000000008',
    '32000000-0000-4000-8000-000000000004',
    '32000000-0000-4000-8000-000000000002',
    date '2036-05-01',
    true
  )$$,
  'a new primary group replaces the former one'
);

select is(
  (
    select membership.effective_until
    from public.agent_group_memberships membership
    where membership.group_id = '32000000-0000-4000-8000-000000000007'
      and membership.agent_id = '32000000-0000-4000-8000-000000000004'
  ),
  date '2036-04-30',
  'the former primary membership is closed'
);

select lives_ok(
  $$select public.create_agent_unavailability(
    '32000000-0000-4000-8000-000000000004',
    '32000000-0000-4000-8000-000000000002',
    '32000000-0000-4000-8000-000000000003',
    'leave',
    timestamptz '2036-06-01 06:00:00+00',
    timestamptz '2036-06-02 16:00:00+00',
    'Congé de test'
  )$$,
  'an unavailability is recorded'
);

select throws_ok(
  $$select public.create_agent_unavailability(
    '32000000-0000-4000-8000-000000000004',
    '32000000-0000-4000-8000-000000000002',
    '32000000-0000-4000-8000-000000000003',
    'training',
    timestamptz '2036-06-01 12:00:00+00',
    timestamptz '2036-06-01 14:00:00+00'
  )$$,
  'P2001',
  'Une indisponibilité existe déjà sur cette période',
  'overlapping unavailability is rejected'
);

select lives_ok(
  format(
    $$select public.end_agent_unavailability(
      %L::uuid,
      '32000000-0000-4000-8000-000000000004',
      timestamptz '2036-06-01 12:00:00+00'
    )$$,
    (
      select unavailable.id
      from public.agent_unavailability unavailable
      where unavailable.agent_id = '32000000-0000-4000-8000-000000000004'
    )
  ),
  'an ongoing unavailability can be ended early'
);

select is(
  (
    select unavailable.ends_at
    from public.agent_unavailability unavailable
    where unavailable.agent_id = '32000000-0000-4000-8000-000000000004'
  ),
  timestamptz '2036-06-01 12:00:00+00',
  'ending an unavailability persists the shortened period'
);

select * from finish();
rollback;
