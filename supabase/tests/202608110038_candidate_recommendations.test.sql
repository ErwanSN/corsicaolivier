begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_temp;

select plan(27);

select has_function(
  'public',
  'get_planning_agent_candidates',
  array[
    'uuid',
    'timestamp with time zone',
    'timestamp with time zone',
    'jsonb',
    'jsonb',
    'uuid',
    'text',
    'integer',
    'integer'
  ],
  'the bounded candidate recommendation function exists'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.get_planning_agent_candidates(uuid,timestamptz,timestamptz,jsonb,jsonb,uuid,text,integer,integer)',
    'EXECUTE'
  ),
  'authenticated users can invoke the scoped recommendation command'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.get_planning_agent_candidates(uuid,timestamptz,timestamptz,jsonb,jsonb,uuid,text,integer,integer)',
    'EXECUTE'
  ),
  'anonymous users cannot request candidate data'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.planning_agent_satisfies_fundamental_rules(uuid,uuid,timestamptz,timestamptz,uuid)',
    'EXECUTE'
  ),
  'the internal eligibility probe is not part of the API surface'
);

insert into public.organizations (id, slug, name)
values (
  '38000000-0000-4000-8000-000000000001',
  'candidate-ranking-tests',
  'Candidate ranking tests'
);

insert into public.sites (id, organization_id, code, name, timezone)
values (
  '38000000-0000-4000-8000-000000000002',
  '38000000-0000-4000-8000-000000000001',
  'RANKING',
  'Candidate test site',
  'Europe/Paris'
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
    '38000000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    'candidate-planner@example.invalid',
    '{}'::jsonb,
    '{"full_name":"Candidate planner"}'::jsonb,
    now(),
    now()
  ),
  (
    '38000000-0000-4000-8000-000000000004',
    'authenticated',
    'authenticated',
    'candidate-supervisor@example.invalid',
    '{}'::jsonb,
    '{"full_name":"Candidate supervisor"}'::jsonb,
    now(),
    now()
  );

insert into public.user_role_assignments (
  user_id,
  organization_id,
  site_id,
  role
) values
  (
    '38000000-0000-4000-8000-000000000003',
    '38000000-0000-4000-8000-000000000001',
    '38000000-0000-4000-8000-000000000002',
    'planning_admin'
  ),
  (
    '38000000-0000-4000-8000-000000000003',
    '38000000-0000-4000-8000-000000000001',
    '38000000-0000-4000-8000-000000000002',
    'approver'
  ),
  (
    '38000000-0000-4000-8000-000000000004',
    '38000000-0000-4000-8000-000000000001',
    '38000000-0000-4000-8000-000000000002',
    'supervisor'
  );

select set_config(
  'request.jwt.claim.sub',
  '38000000-0000-4000-8000-000000000003',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.aal', 'aal2', true);
select set_config('request.jwt.claim.is_anonymous', 'false', true);

insert into public.positions (
  id,
  organization_id,
  site_id,
  code,
  name
) values (
  '38000000-0000-4000-8000-000000000010',
  '38000000-0000-4000-8000-000000000001',
  '38000000-0000-4000-8000-000000000002',
  'RANK-POS',
  'Poste classement'
);

insert into public.skills (
  id,
  organization_id,
  code,
  name
) values (
  '38000000-0000-4000-8000-000000000011',
  '38000000-0000-4000-8000-000000000001',
  'RANK-SKILL',
  'Habilitation classement'
);

insert into public.position_skill_requirements (
  organization_id,
  position_id,
  skill_id,
  minimum_level,
  mandatory
) values (
  '38000000-0000-4000-8000-000000000001',
  '38000000-0000-4000-8000-000000000010',
  '38000000-0000-4000-8000-000000000011',
  2,
  true
);

insert into public.agents (
  id,
  organization_id,
  primary_site_id,
  employee_number,
  display_name,
  active,
  hired_on
) values
  ('38000000-0000-4000-8000-000000000101', '38000000-0000-4000-8000-000000000001', '38000000-0000-4000-8000-000000000002', 'RANK-A', 'Alice Préférée', true, date '2049-01-01'),
  ('38000000-0000-4000-8000-000000000102', '38000000-0000-4000-8000-000000000001', '38000000-0000-4000-8000-000000000002', 'RANK-B', 'Benoît Affecté', true, date '2049-01-01'),
  ('38000000-0000-4000-8000-000000000103', '38000000-0000-4000-8000-000000000001', '38000000-0000-4000-8000-000000000002', 'RANK-C', 'Claire Inactive', false, date '2049-01-01'),
  ('38000000-0000-4000-8000-000000000104', '38000000-0000-4000-8000-000000000001', '38000000-0000-4000-8000-000000000002', 'RANK-D', 'David Interdit', true, date '2049-01-01'),
  ('38000000-0000-4000-8000-000000000105', '38000000-0000-4000-8000-000000000001', '38000000-0000-4000-8000-000000000002', 'RANK-E', 'Emma Sans Habilitation', true, date '2049-01-01'),
  ('38000000-0000-4000-8000-000000000106', '38000000-0000-4000-8000-000000000001', '38000000-0000-4000-8000-000000000002', 'RANK-F', 'Farid Indisponible', true, date '2049-01-01'),
  ('38000000-0000-4000-8000-000000000107', '38000000-0000-4000-8000-000000000001', '38000000-0000-4000-8000-000000000002', 'RANK-G', 'Gaëlle Sans Contrat', true, date '2049-01-01'),
  ('38000000-0000-4000-8000-000000000108', '38000000-0000-4000-8000-000000000001', '38000000-0000-4000-8000-000000000002', 'RANK-I', 'Inès À Éviter', true, date '2049-01-01'),
  ('38000000-0000-4000-8000-000000000109', '38000000-0000-4000-8000-000000000001', '38000000-0000-4000-8000-000000000002', 'RANK-J', 'Jules Chargé', true, date '2049-01-01');

insert into public.agent_contract_versions (
  organization_id,
  agent_id,
  effective_from,
  weekly_target_minutes,
  monthly_target_minutes,
  label
)
select
  '38000000-0000-4000-8000-000000000001',
  agent.id,
  date '2049-01-01',
  2100,
  9100,
  'Candidate test contract'
from public.agents agent
where agent.id in (
  '38000000-0000-4000-8000-000000000101',
  '38000000-0000-4000-8000-000000000102',
  '38000000-0000-4000-8000-000000000103',
  '38000000-0000-4000-8000-000000000104',
  '38000000-0000-4000-8000-000000000105',
  '38000000-0000-4000-8000-000000000106',
  '38000000-0000-4000-8000-000000000108',
  '38000000-0000-4000-8000-000000000109'
);

insert into public.agent_skills (
  organization_id,
  agent_id,
  skill_id,
  level,
  valid_from,
  verified_by
)
select
  '38000000-0000-4000-8000-000000000001',
  agent.id,
  '38000000-0000-4000-8000-000000000011',
  3,
  date '2049-01-01',
  '38000000-0000-4000-8000-000000000003'
from public.agents agent
where agent.organization_id = '38000000-0000-4000-8000-000000000001'
  and agent.id <> '38000000-0000-4000-8000-000000000105';

insert into public.agent_position_preferences (
  organization_id,
  agent_id,
  position_id,
  level,
  priority,
  valid_from,
  created_by
) values
  (
    '38000000-0000-4000-8000-000000000001',
    '38000000-0000-4000-8000-000000000101',
    '38000000-0000-4000-8000-000000000010',
    'preferred',
    1,
    date '2049-01-01',
    '38000000-0000-4000-8000-000000000003'
  ),
  (
    '38000000-0000-4000-8000-000000000001',
    '38000000-0000-4000-8000-000000000108',
    '38000000-0000-4000-8000-000000000010',
    'avoid',
    1,
    date '2049-01-01',
    '38000000-0000-4000-8000-000000000003'
  );

insert into public.agent_position_restrictions (
  organization_id,
  agent_id,
  position_id,
  reason,
  valid_from,
  created_by
) values (
  '38000000-0000-4000-8000-000000000001',
  '38000000-0000-4000-8000-000000000104',
  '38000000-0000-4000-8000-000000000010',
  'Interdiction de test',
  date '2050-01-01',
  '38000000-0000-4000-8000-000000000003'
);

insert into public.agent_unavailability (
  organization_id,
  site_id,
  agent_id,
  kind,
  starts_at,
  ends_at,
  note,
  created_by
) values (
  '38000000-0000-4000-8000-000000000001',
  '38000000-0000-4000-8000-000000000002',
  '38000000-0000-4000-8000-000000000106',
  'training',
  '2050-01-05 07:00:00+00',
  '2050-01-05 15:00:00+00',
  'Formation de test',
  '38000000-0000-4000-8000-000000000003'
);

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
    '38000000-0000-4000-8000-000000000020',
    '38000000-0000-4000-8000-000000000001',
    '38000000-0000-4000-8000-000000000002',
    'Candidate week',
    date '2050-01-03',
    date '2050-01-09',
    'Europe/Paris'
  ),
  (
    '38000000-0000-4000-8000-000000000021',
    '38000000-0000-4000-8000-000000000001',
    '38000000-0000-4000-8000-000000000002',
    'Recent workload week',
    date '2049-12-13',
    date '2049-12-19',
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
  change_reason,
  created_by
) values
  (
    '38000000-0000-4000-8000-000000000030',
    '38000000-0000-4000-8000-000000000001',
    '38000000-0000-4000-8000-000000000002',
    '38000000-0000-4000-8000-000000000020',
    1,
    'draft',
    'Candidate draft',
    'Candidate tests',
    '38000000-0000-4000-8000-000000000003'
  ),
  (
    '38000000-0000-4000-8000-000000000031',
    '38000000-0000-4000-8000-000000000001',
    '38000000-0000-4000-8000-000000000002',
    '38000000-0000-4000-8000-000000000021',
    1,
    'draft',
    'Recent workload draft',
    'Candidate tests',
    '38000000-0000-4000-8000-000000000003'
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
  origin,
  created_by
) values
  (
    '38000000-0000-4000-8000-000000000040',
    '38000000-0000-4000-8000-000000000001',
    '38000000-0000-4000-8000-000000000002',
    '38000000-0000-4000-8000-000000000030',
    '38000000-0000-4000-8000-000000000102',
    '2050-01-05 07:00:00+00',
    '2050-01-05 15:00:00+00',
    30,
    'manual',
    '38000000-0000-4000-8000-000000000003'
  ),
  (
    '38000000-0000-4000-8000-000000000041',
    '38000000-0000-4000-8000-000000000001',
    '38000000-0000-4000-8000-000000000002',
    '38000000-0000-4000-8000-000000000031',
    '38000000-0000-4000-8000-000000000109',
    '2049-12-15 07:00:00+00',
    '2049-12-15 15:00:00+00',
    0,
    'manual',
    '38000000-0000-4000-8000-000000000003'
  );

insert into public.shift_assignments (
  organization_id,
  site_id,
  planning_shift_id,
  position_id,
  starts_at,
  ends_at
) values
  (
    '38000000-0000-4000-8000-000000000001',
    '38000000-0000-4000-8000-000000000002',
    '38000000-0000-4000-8000-000000000040',
    '38000000-0000-4000-8000-000000000010',
    '2050-01-05 07:00:00+00',
    '2050-01-05 15:00:00+00'
  ),
  (
    '38000000-0000-4000-8000-000000000001',
    '38000000-0000-4000-8000-000000000002',
    '38000000-0000-4000-8000-000000000041',
    '38000000-0000-4000-8000-000000000010',
    '2049-12-15 07:00:00+00',
    '2049-12-15 15:00:00+00'
  );

update public.schedule_versions
set status = 'published',
    published_by = '38000000-0000-4000-8000-000000000003',
    published_at = now()
where id = '38000000-0000-4000-8000-000000000031';

create temporary table candidate_results on commit drop as
select *
from public.get_planning_agent_candidates(
  '38000000-0000-4000-8000-000000000030',
  '2050-01-05 07:00:00+00',
  '2050-01-05 15:00:00+00',
  '[{"positionId":"38000000-0000-4000-8000-000000000010","startsAt":"2050-01-05T07:00:00Z","endsAt":"2050-01-05T15:00:00Z"}]'::jsonb,
  '[{"startsAt":"2050-01-05T11:00:00Z","endsAt":"2050-01-05T11:30:00Z"}]'::jsonb,
  '38000000-0000-4000-8000-000000000040',
  null,
  20,
  0
);

select is(
  (select count(*) from candidate_results),
  4::bigint,
  'only the four hard-eligible agents remain'
);
select results_eq(
  $$select employee_number from candidate_results order by recommendation_rank$$,
  $$values ('RANK-A'::text), ('RANK-B'::text), ('RANK-J'::text), ('RANK-I'::text)$$,
  'preference, target deficit, recent load and avoidance rank deterministically'
);
select is(
  (select preference_level from candidate_results where employee_number = 'RANK-A'),
  'preferred'::text,
  'a positive preference is exposed without overriding eligibility'
);
select matches(
  (select explanation from candidate_results where employee_number = 'RANK-A'),
  '^Poste apprécié',
  'the recommendation has a short human explanation'
);
select is(
  (select scheduled_week_minutes from candidate_results where employee_number = 'RANK-B'),
  0,
  'the edited shift is removed from its current agent workload'
);
select is(
  (select projected_week_minutes from candidate_results where employee_number = 'RANK-B'),
  450,
  'exact first-class breaks determine the projected workload'
);
select is(
  (select recent_load_minutes from candidate_results where employee_number = 'RANK-J'),
  480,
  'recent published workload is part of the ranking evidence'
);
select is(
  (
    select count(*)
    from public.get_planning_agent_candidates(
      '38000000-0000-4000-8000-000000000030',
      '2050-01-05 07:00:00+00',
      '2050-01-05 15:00:00+00',
      '[{"positionId":"38000000-0000-4000-8000-000000000010","startsAt":"2050-01-05T07:00:00Z","endsAt":"2050-01-05T15:00:00Z"}]',
      '[]',
      null,
      null,
      20,
      0
    )
  ),
  3::bigint,
  'an overlapping current assignment is a hard exclusion without edit context'
);
select is(
  (select count(*) from candidate_results where employee_number = 'RANK-C'),
  0::bigint,
  'inactive agents are excluded'
);
select is(
  (select count(*) from candidate_results where employee_number = 'RANK-D'),
  0::bigint,
  'position restrictions are hard exclusions'
);
select is(
  (select count(*) from candidate_results where employee_number = 'RANK-E'),
  0::bigint,
  'missing mandatory skills are hard exclusions'
);
select is(
  (select count(*) from candidate_results where employee_number = 'RANK-F'),
  0::bigint,
  'unavailability is a hard exclusion'
);
select is(
  (select count(*) from candidate_results where employee_number = 'RANK-G'),
  0::bigint,
  'absence of an effective contract is a hard exclusion'
);
select is(
  (
    select count(*)
    from public.get_planning_agent_candidates(
      '38000000-0000-4000-8000-000000000030',
      '2050-01-05 07:00:00+00',
      '2050-01-05 15:00:00+00',
      '[{"positionId":"38000000-0000-4000-8000-000000000010","startsAt":"2050-01-05T07:00:00Z","endsAt":"2050-01-05T15:00:00Z"}]',
      '[]',
      '38000000-0000-4000-8000-000000000040',
      '%_',
      20,
      0
    )
  ),
  0::bigint,
  'search wildcard characters are treated literally'
);
select is(
  (
    select count(*)
    from public.get_planning_agent_candidates(
      '38000000-0000-4000-8000-000000000030',
      '2050-01-05 07:00:00+00',
      '2050-01-05 15:00:00+00',
      '[{"positionId":"38000000-0000-4000-8000-000000000010","startsAt":"2050-01-05T07:00:00Z","endsAt":"2050-01-05T15:00:00Z"}]',
      '[]',
      '38000000-0000-4000-8000-000000000040',
      null,
      1,
      0
    )
  ),
  1::bigint,
  'the result limit is enforced in SQL'
);
select is(
  (
    select total_count
    from public.get_planning_agent_candidates(
      '38000000-0000-4000-8000-000000000030',
      '2050-01-05 07:00:00+00',
      '2050-01-05 15:00:00+00',
      '[{"positionId":"38000000-0000-4000-8000-000000000010","startsAt":"2050-01-05T07:00:00Z","endsAt":"2050-01-05T15:00:00Z"}]',
      '[]',
      '38000000-0000-4000-8000-000000000040',
      null,
      1,
      0
    )
  ),
  4::bigint,
  'a bounded page still reports the eligible total'
);
select throws_ok(
  $$select * from public.get_planning_agent_candidates(
    '38000000-0000-4000-8000-000000000030',
    '2050-01-05 07:00:00+00',
    '2050-01-05 15:00:00+00',
    '[{"positionId":"38000000-0000-4000-8000-000000000010","startsAt":"2050-01-05T07:00:00Z","endsAt":"2050-01-05T15:00:00Z"}]',
    '[]', null, null, 51, 0
  )$$,
  'P2085',
  'La pagination demandée dépasse les limites autorisées.',
  'oversized pages are rejected'
);
select throws_ok(
  $$select * from public.get_planning_agent_candidates(
    '38000000-0000-4000-8000-000000000030',
    '2050-01-05 07:00:00+00',
    '2050-01-05 15:00:00+00',
    '[{"positionId":"38000000-0000-4000-8000-000000000010","startsAt":"2050-01-05T07:00:00Z","endsAt":"2050-01-05T15:00:00Z"}]',
    '[]', null, null, 20, 501
  )$$,
  'P2085',
  'La pagination demandée dépasse les limites autorisées.',
  'deep unbounded offsets are rejected'
);
select throws_ok(
  $$select * from public.get_planning_agent_candidates(
    '38000000-0000-4000-8000-000000000030',
    '2050-01-05 07:00:00+00',
    '2050-01-05 15:00:00+00',
    '[{"positionId":"38000000-0000-4000-8000-000000000010","startsAt":"2050-01-05T07:00:00Z","endsAt":"2050-01-05T15:00:00Z"}]',
    '[]', null, 'x', 20, 0
  )$$,
  'P2085',
  'La recherche doit contenir entre 2 et 80 caractères.',
  'one-character searches are rejected'
);

select set_config(
  'request.jwt.claim.sub',
  '38000000-0000-4000-8000-000000000004',
  true
);
select throws_ok(
  $$select * from public.get_planning_agent_candidates(
    '38000000-0000-4000-8000-000000000030',
    '2050-01-05 07:00:00+00',
    '2050-01-05 15:00:00+00',
    '[{"positionId":"38000000-0000-4000-8000-000000000010","startsAt":"2050-01-05T07:00:00Z","endsAt":"2050-01-05T15:00:00Z"}]',
    '[]', null, null, 20, 0
  )$$,
  'P2082',
  'Autorisation insuffisante pour rechercher des candidats.',
  'a non-planning role cannot enumerate candidates'
);

select set_config(
  'request.jwt.claim.sub',
  '38000000-0000-4000-8000-000000000003',
  true
);
update public.app_users
set status = 'suspended'
where id = '38000000-0000-4000-8000-000000000003';
select throws_ok(
  $$select * from public.get_planning_agent_candidates(
    '38000000-0000-4000-8000-000000000030',
    '2050-01-05 07:00:00+00',
    '2050-01-05 15:00:00+00',
    '[{"positionId":"38000000-0000-4000-8000-000000000010","startsAt":"2050-01-05T07:00:00Z","endsAt":"2050-01-05T15:00:00Z"}]',
    '[]', null, null, 20, 0
  )$$,
  'P2080',
  'Un compte actif est requis.',
  'a suspended account cannot enumerate candidates'
);
update public.app_users
set status = 'active'
where id = '38000000-0000-4000-8000-000000000003';

select throws_ok(
  $$select * from public.get_planning_agent_candidates(
    '38000000-0000-4000-8000-000000000030',
    '2050-01-05 07:00:00+00',
    '2050-01-05 15:00:00+00',
    '[{"positionId":"38000000-0000-4000-8000-000000000010","startsAt":"2050-01-05T07:00:00Z","endsAt":"2050-01-05T10:00:00Z"},{"positionId":"38000000-0000-4000-8000-000000000010","startsAt":"2050-01-05T11:00:00Z","endsAt":"2050-01-05T15:00:00Z"}]',
    '[]', null, null, 20, 0
  )$$,
  'P2084',
  'Les segments doivent couvrir le service sans vide ni chevauchement.',
  'multi-position segments must cover the complete service'
);
select throws_ok(
  $$select * from public.get_planning_agent_candidates(
    '38000000-0000-4000-8000-000000000030',
    '2050-01-05 07:00:00+00',
    '2050-01-05 15:00:00+00',
    '[{"positionId":"38000000-0000-4000-8000-000000000010","startsAt":"2050-01-05T07:00:00Z","endsAt":"2050-01-05T15:00:00Z"}]',
    '[{"startsAt":"2050-01-05T10:00:00Z","endsAt":"2050-01-05T11:00:00Z"},{"startsAt":"2050-01-05T10:30:00Z","endsAt":"2050-01-05T11:30:00Z"}]',
    null, null, 20, 0
  )$$,
  'P2084',
  'Les pauses doivent être entières, bornées et sans chevauchement.',
  'overlapping first-class breaks are rejected'
);

select * from finish();
rollback;
