begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_temp;

select plan(32);

select ok(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.skills'::regclass),
  'skills has row-level security enabled'
);
select ok(
  (select relforcerowsecurity from pg_catalog.pg_class where oid = 'public.skills'::regclass),
  'skills forces row-level security'
);
select ok(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.agent_skills'::regclass),
  'agent_skills has row-level security enabled'
);
select ok(
  (select relforcerowsecurity from pg_catalog.pg_class where oid = 'public.agent_skills'::regclass),
  'agent_skills forces row-level security'
);
select ok(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.agent_position_restrictions'::regclass),
  'agent_position_restrictions has row-level security enabled'
);
select ok(
  (select relforcerowsecurity from pg_catalog.pg_class where oid = 'public.agent_position_restrictions'::regclass),
  'agent_position_restrictions forces row-level security'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_policy policy
    where policy.polrelid in (
      'public.skills'::regclass,
      'public.agent_skills'::regclass,
      'public.agent_position_restrictions'::regclass
    )
      and not policy.polpermissive
      and policy.polname like '%_active_account_gate'
  ),
  3,
  'the three sensitive tables have the restrictive active-account gate'
);

select is(
  (
    select count(*)::integer
    from information_schema.role_table_grants privilege
    where privilege.table_schema = 'public'
      and privilege.grantee = 'anon'
  ),
  0,
  'anon has no privilege on public tables'
);

select is(
  (
    select count(*)::integer
    from information_schema.role_table_grants privilege
    where privilege.table_schema = 'public'
      and privilege.grantee = 'authenticated'
      and privilege.privilege_type in ('DELETE', 'REFERENCES', 'TRIGGER', 'TRUNCATE')
  ),
  0,
  'authenticated has no destructive or structural table privilege'
);

select ok(
  has_table_privilege('authenticated', 'public.skills', 'SELECT'),
  'authenticated keeps SELECT on skills for RLS-filtered reads'
);
select ok(
  has_table_privilege('authenticated', 'public.skills', 'INSERT'),
  'authenticated keeps INSERT on skills for the authorized API command'
);
select ok(
  not has_column_privilege('authenticated', 'public.app_users', 'status', 'UPDATE'),
  'authenticated cannot update app_users.status'
);
select ok(
  has_column_privilege('authenticated', 'public.app_users', 'display_name', 'UPDATE'),
  'authenticated can still update its display name'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_proc function_proc
    join pg_catalog.pg_namespace function_namespace
      on function_namespace.oid = function_proc.pronamespace
    where function_namespace.nspname = 'public'
      and has_function_privilege('anon', function_proc.oid, 'EXECUTE')
  ),
  0,
  'anon cannot execute any public function'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.get_my_access_context()',
    'EXECUTE'
  ),
  'authenticated can execute the access-context RPC'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.create_planning_shift(uuid,uuid,timestamptz,timestamptz,integer,uuid,uuid,text,bigint)',
    'EXECUTE'
  ),
  'authenticated can execute the concurrency-checked API business RPC'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.assert_agent_planning_rules(uuid,uuid,timestamptz,timestamptz,uuid)',
    'EXECUTE'
  ),
  'authenticated cannot execute internal rule helpers directly'
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
values
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-4000-8000-0000000000a1',
    'authenticated',
    'authenticated',
    'p0-manager@example.invalid',
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"P0 Manager"}'::jsonb,
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '20000000-0000-4000-8000-0000000000a1',
    'authenticated',
    'authenticated',
    'p0-agent@example.invalid',
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"P0 Agent"}'::jsonb,
    '',
    '',
    ''
  );

insert into public.organizations (id, slug, name)
values
  ('10000000-0000-4000-8000-000000000001', 'p0-tenant-a', 'P0 Tenant A'),
  ('20000000-0000-4000-8000-000000000001', 'p0-tenant-b', 'P0 Tenant B');

insert into public.sites (id, organization_id, code, name, timezone)
values
  (
    '10000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    'P0-A',
    'P0 Site A',
    'Europe/Paris'
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000001',
    'P0-B',
    'P0 Site B',
    'Europe/Paris'
  );

insert into public.user_role_assignments (
  user_id,
  organization_id,
  site_id,
  role
)
values (
  '10000000-0000-4000-8000-0000000000a1',
  '10000000-0000-4000-8000-000000000001',
  null,
  'planning_admin'
);

insert into public.agents (
  id,
  organization_id,
  primary_site_id,
  user_id,
  employee_number,
  display_name
)
values
  (
    '10000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-0000000000a1',
    'P0-A-AGENT',
    'P0 Agent A'
  ),
  (
    '20000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-0000000000a1',
    'P0-B-AGENT',
    'P0 Agent B'
  );

insert into public.skills (id, organization_id, code, name)
values
  (
    '10000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000001',
    'P0-SKILL-A',
    'P0 Skill A'
  ),
  (
    '20000000-0000-4000-8000-000000000004',
    '20000000-0000-4000-8000-000000000001',
    'P0-SKILL-B',
    'P0 Skill B'
  );

insert into public.positions (id, organization_id, site_id, code, name)
values
  (
    '10000000-0000-4000-8000-000000000005',
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000002',
    'P0-POS-A',
    'P0 Position A'
  ),
  (
    '20000000-0000-4000-8000-000000000005',
    '20000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002',
    'P0-POS-B',
    'P0 Position B'
  );

insert into public.agent_skills (
  organization_id,
  agent_id,
  skill_id,
  level,
  verified_by
)
values
  (
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000004',
    3,
    '10000000-0000-4000-8000-0000000000a1'
  ),
  (
    '20000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000004',
    3,
    '20000000-0000-4000-8000-0000000000a1'
  );

insert into public.agent_position_restrictions (
  organization_id,
  agent_id,
  position_id,
  reason,
  created_by
)
values
  (
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000005',
    'P0 restriction A',
    '10000000-0000-4000-8000-0000000000a1'
  ),
  (
    '20000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000005',
    'P0 restriction B',
    '20000000-0000-4000-8000-0000000000a1'
  );

create temporary table p0_observations (
  observation text primary key,
  numeric_value bigint,
  text_value text
);
grant select, insert on table p0_observations to authenticated;

create function pg_temp.try_reactivate(target_user_id uuid)
returns text
language plpgsql
as $$
begin
  update public.app_users
  set status = 'active'
  where id = target_user_id;
  return 'allowed';
exception when others then
  return sqlstate;
end;
$$;
grant execute on function pg_temp.try_reactivate(uuid) to authenticated;

create function pg_temp.try_insert_skill(
  target_organization_id uuid,
  target_code text
)
returns text
language plpgsql
as $$
begin
  insert into public.skills (organization_id, code, name)
  values (target_organization_id, target_code, target_code);
  return 'allowed';
exception when others then
  return sqlstate;
end;
$$;
grant execute on function pg_temp.try_insert_skill(uuid, text) to authenticated;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-0000000000a1',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.aal', 'aal2', true);
select set_config('request.jwt.claim.is_anonymous', 'false', true);

insert into p0_observations (observation, numeric_value)
select 'manager_skills', count(*) from public.skills;
insert into p0_observations (observation, numeric_value)
select 'manager_agent_skills', count(*) from public.agent_skills;
insert into p0_observations (observation, numeric_value)
select 'manager_restrictions', count(*) from public.agent_position_restrictions;
insert into p0_observations (observation, text_value)
values (
  'manager_own_insert',
  pg_temp.try_insert_skill(
    '10000000-0000-4000-8000-000000000001',
    'P0-OWN-INSERT'
  )
);
insert into p0_observations (observation, text_value)
values (
  'manager_cross_insert',
  pg_temp.try_insert_skill(
    '20000000-0000-4000-8000-000000000001',
    'P0-CROSS-INSERT'
  )
);
reset role;

select is(
  (select numeric_value from p0_observations where observation = 'manager_skills'),
  1::bigint,
  'a manager sees skills only in its organization'
);
select is(
  (select numeric_value from p0_observations where observation = 'manager_agent_skills'),
  1::bigint,
  'a manager sees agent skills only in its organization'
);
select is(
  (select numeric_value from p0_observations where observation = 'manager_restrictions'),
  1::bigint,
  'a manager sees restrictions only in its organization'
);
select is(
  (select text_value from p0_observations where observation = 'manager_own_insert'),
  'allowed',
  'an authorized manager can insert a skill in its organization'
);
select is(
  (select text_value from p0_observations where observation = 'manager_cross_insert'),
  '42501',
  'RLS blocks a manager from inserting a skill in another organization'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '20000000-0000-4000-8000-0000000000a1',
  true
);

insert into p0_observations (observation, numeric_value)
select 'active_self_skills', count(*) from public.agent_skills;
insert into p0_observations (observation, numeric_value)
select 'active_self_restrictions', count(*)
from public.agent_position_restrictions;
reset role;

select is(
  (select numeric_value from p0_observations where observation = 'active_self_skills'),
  1::bigint,
  'an active agent can read its own skills'
);
select is(
  (select numeric_value from p0_observations where observation = 'active_self_restrictions'),
  1::bigint,
  'an active agent can read its own restrictions'
);

update public.app_users
set status = 'disabled'
where id = '20000000-0000-4000-8000-0000000000a1';

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '20000000-0000-4000-8000-0000000000a1',
  true
);

insert into p0_observations (observation, numeric_value)
select 'disabled_self_skills', count(*) from public.agent_skills;
insert into p0_observations (observation, numeric_value)
select 'disabled_self_restrictions', count(*)
from public.agent_position_restrictions;
insert into p0_observations (observation, numeric_value)
select 'disabled_self_profile', count(*) from public.app_users;
insert into p0_observations (observation, text_value)
values (
  'disabled_reactivation',
  pg_temp.try_reactivate('20000000-0000-4000-8000-0000000000a1')
);
reset role;

select is(
  (select numeric_value from p0_observations where observation = 'disabled_self_skills'),
  0::bigint,
  'a disabled account cannot read its former self-service skills'
);
select is(
  (select numeric_value from p0_observations where observation = 'disabled_self_restrictions'),
  0::bigint,
  'a disabled account cannot read its former self-service restrictions'
);
select is(
  (select numeric_value from p0_observations where observation = 'disabled_self_profile'),
  0::bigint,
  'the restrictive gate hides app_users from a disabled account'
);
select is(
  (select text_value from p0_observations where observation = 'disabled_reactivation'),
  '42501',
  'a disabled account cannot reactivate itself'
);

select is(
  (
    select count(*)::integer
    from public.user_role_assignments
    where user_id = '00000000-0000-4000-8000-0000000000aa'
  ),
  0,
  'the legacy demo identity has no role assignment by default'
);
select ok(
  not exists (
    select 1
    from public.app_users
    where id = '00000000-0000-4000-8000-0000000000aa'
  )
  or exists (
    select 1
    from public.app_users
    where id = '00000000-0000-4000-8000-0000000000aa'
      and status = 'disabled'
  ),
  'the legacy demo application account is absent or disabled by default'
);
select ok(
  not exists (
    select 1
    from auth.users
    where id = '00000000-0000-4000-8000-0000000000aa'
  )
  or exists (
    select 1
    from auth.users auth_user
    where auth_user.id = '00000000-0000-4000-8000-0000000000aa'
      and nullif(to_jsonb(auth_user) ->> 'banned_until', '')::timestamptz
        > now()
  ),
  'the legacy demo authentication identity is absent or banned by default'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_default_acl default_acl,
      lateral aclexplode(default_acl.defaclacl) privilege
    where default_acl.defaclnamespace = 'public'::regnamespace
      and default_acl.defaclrole = 'postgres'::regrole
      and privilege.grantee in ('anon'::regrole, 'authenticated'::regrole)
  ),
  0,
  'future application migrations do not inherit anon/authenticated privileges'
);

select * from finish();
rollback;
