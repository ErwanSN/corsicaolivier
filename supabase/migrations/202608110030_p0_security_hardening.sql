-- Close the access-control gaps found during the production security review.
-- This migration is intentionally additive: historical migrations stay immutable.

alter table public.skills enable row level security;
alter table public.skills force row level security;
alter table public.agent_skills enable row level security;
alter table public.agent_skills force row level security;
alter table public.agent_position_restrictions enable row level security;
alter table public.agent_position_restrictions force row level security;

-- A disabled application account must be denied before any permissive tenant or
-- self-service policy is considered. Keeping this check in one SECURITY DEFINER
-- function avoids recursive RLS evaluation on app_users.
create or replace function public.is_current_app_user_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.app_users app_user
    where app_user.id = (select auth.uid())
      and app_user.status = 'active'
  );
$$;

revoke all on function public.is_current_app_user_active()
from public, anon, authenticated;

-- Restrictive policies are combined with every existing permissive policy.
-- They make account suspension effective for role-based and self-service paths.
do $$
declare
  target_table text;
  gate_policy text;
begin
  for target_table in
    select table_class.relname
    from pg_catalog.pg_class table_class
    join pg_catalog.pg_namespace table_namespace
      on table_namespace.oid = table_class.relnamespace
    where table_namespace.nspname = 'public'
      and table_class.relkind in ('r', 'p')
      and table_class.relrowsecurity
    order by table_class.relname
  loop
    gate_policy := target_table || '_active_account_gate';

    execute format(
      'drop policy if exists %I on public.%I',
      gate_policy,
      target_table
    );
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated using ((select public.is_current_app_user_active())) with check ((select public.is_current_app_user_active()))',
      gate_policy,
      target_table
    );
  end loop;
end;
$$;

-- Even if a broad UPDATE grant is accidentally restored later, an inactive
-- account can no longer make its own old row pass the update policy.
drop policy if exists app_users_update_self on public.app_users;

create policy app_users_update_self
on public.app_users for update to authenticated
using (
  id = (select auth.uid())
  and status = 'active'
)
with check (
  id = (select auth.uid())
  and status = 'active'
);

-- Supabase's bootstrap default ACLs explicitly granted every table privilege to
-- anon/authenticated. Revoke them from all existing public tables and sequences,
-- then grant only operations used by the application.
do $$
declare
  target_relation record;
begin
  for target_relation in
    select table_namespace.nspname as schema_name, table_class.relname
    from pg_catalog.pg_class table_class
    join pg_catalog.pg_namespace table_namespace
      on table_namespace.oid = table_class.relnamespace
    where table_namespace.nspname = 'public'
      and table_class.relkind in ('r', 'p')
  loop
    execute format(
      'revoke all privileges on table %I.%I from public, anon, authenticated',
      target_relation.schema_name,
      target_relation.relname
    );
  end loop;

  for target_relation in
    select sequence_namespace.nspname as schema_name, sequence_class.relname
    from pg_catalog.pg_class sequence_class
    join pg_catalog.pg_namespace sequence_namespace
      on sequence_namespace.oid = sequence_class.relnamespace
    where sequence_namespace.nspname = 'public'
      and sequence_class.relkind = 'S'
  loop
    execute format(
      'revoke all privileges on sequence %I.%I from public, anon, authenticated',
      target_relation.schema_name,
      target_relation.relname
    );
  end loop;
end;
$$;

grant select on table
  public.app_users,
  public.user_role_assignments,
  public.audit_events,
  public.sites,
  public.agents,
  public.agent_contract_versions,
  public.agent_groups,
  public.agent_group_memberships,
  public.hour_target_overrides,
  public.skills,
  public.positions,
  public.position_skill_requirements,
  public.agent_skills,
  public.agent_position_preferences,
  public.agent_position_restrictions,
  public.port_calls,
  public.call_load_forecasts,
  public.vessels,
  public.demand_profiles,
  public.demand_profile_lines,
  public.planning_periods,
  public.schedule_versions,
  public.staffing_requirements,
  public.planning_shifts,
  public.shift_assignments,
  public.replanning_scenarios,
  public.replanning_impacts
to authenticated;

grant insert on table
  public.sites,
  public.agents,
  public.agent_contract_versions,
  public.agent_groups,
  public.agent_group_memberships,
  public.hour_target_overrides,
  public.skills,
  public.positions,
  public.position_skill_requirements,
  public.agent_skills,
  public.agent_position_preferences,
  public.agent_position_restrictions,
  public.port_calls,
  public.call_load_forecasts,
  public.vessels,
  public.demand_profiles,
  public.demand_profile_lines
to authenticated;

grant update on table
  public.agents,
  public.agent_groups,
  public.agent_group_memberships,
  public.hour_target_overrides,
  public.position_skill_requirements,
  public.port_calls
to authenticated;

-- Self-service profile changes are column-scoped. Account status remains a
-- privileged operation performed outside the end-user role.
grant update (email, display_name) on table public.app_users to authenticated;

-- Functions also inherited explicit anon/authenticated EXECUTE grants. Start
-- from a closed set, including trigger helpers, before exposing the RPCs used by
-- the API and the predicates required by RLS.
do $$
declare
  target_function text;
begin
  for target_function in
    select function_proc.oid::regprocedure::text
    from pg_catalog.pg_proc function_proc
    join pg_catalog.pg_namespace function_namespace
      on function_namespace.oid = function_proc.pronamespace
    where function_namespace.nspname = 'public'
      and function_proc.prokind = 'f'
  loop
    execute format(
      'revoke all privileges on function %s from public, anon, authenticated',
      target_function
    );
  end loop;
end;
$$;

grant execute on function public.is_current_app_user_active() to authenticated;
grant execute on function public.has_role(uuid, uuid, public.app_role[]) to authenticated;
grant execute on function public.has_organization_role(uuid, public.app_role[]) to authenticated;
grant execute on function public.get_my_access_context() to authenticated;
grant execute on function public.ensure_editable_schedule_for_period(uuid)
to authenticated;
grant execute on function public.create_planning_shift(
  uuid, uuid, timestamptz, timestamptz, integer, uuid, uuid, text
) to authenticated;
grant execute on function public.create_planning_shift(
  uuid, uuid, timestamptz, timestamptz, integer, uuid, uuid, text, bigint
) to authenticated;
grant execute on function public.move_planning_assignment(uuid, uuid, date, uuid)
to authenticated;
grant execute on function public.move_planning_assignment(
  uuid, uuid, date, uuid, bigint
) to authenticated;
grant execute on function public.update_planning_assignment(
  uuid, uuid, uuid, uuid, uuid, timestamptz, timestamptz, integer, text
) to authenticated;
grant execute on function public.update_planning_assignment(
  uuid, uuid, uuid, uuid, uuid, timestamptz, timestamptz, integer, text, bigint
) to authenticated;
grant execute on function public.delete_planning_assignment(uuid, uuid)
to authenticated;
grant execute on function public.delete_planning_assignment(uuid, uuid, bigint)
to authenticated;
grant execute on function public.publish_schedule_version(uuid, text)
to authenticated;
grant execute on function public.publish_schedule_version(uuid, text, bigint)
to authenticated;
grant execute on function public.approve_replanning_scenario(uuid, text)
to authenticated;
grant execute on function public.update_port_call_timing(
  uuid, timestamptz, timestamptz, public.port_call_status, text, text
) to authenticated;
grant execute on function public.get_agent_hour_balance(uuid, date, uuid)
to authenticated;
grant execute on function public.get_schedule_content(uuid) to authenticated;

-- Do not let later migrations recreate Supabase's permissive object defaults.
-- Only alter defaults owned by roles the migration actor is allowed to manage.
do $$
declare
  object_owner text;
begin
  for object_owner in
    select role_name
    from (
      values (current_user), ('postgres'), ('supabase_admin')
    ) as candidate(role_name)
    where exists (
      select 1 from pg_catalog.pg_roles role where role.rolname = candidate.role_name
    )
      and (
        candidate.role_name = current_user
        or pg_catalog.pg_has_role(current_user, candidate.role_name, 'MEMBER')
      )
    group by role_name
  loop
    execute format(
      'alter default privileges for role %I in schema public revoke all privileges on tables from public, anon, authenticated',
      object_owner
    );
    execute format(
      'alter default privileges for role %I in schema public revoke all privileges on sequences from public, anon, authenticated',
      object_owner
    );
    execute format(
      'alter default privileges for role %I in schema public revoke all privileges on functions from public, anon, authenticated',
      object_owner
    );
  end loop;
end;
$$;

-- A legacy demo identity was historically created during migrations. It remains
-- usable only when an operator explicitly opts into a development environment;
-- missing or misspelled settings are treated as production (fail closed).
do $$
declare
  legacy_demo_user_id constant uuid := '00000000-0000-4000-8000-0000000000aa';
  legacy_demo_enabled constant boolean :=
    current_setting('app.environment', true) = 'development'
    and current_setting('app.allow_legacy_demo_account', true) = 'true';
begin
  if legacy_demo_enabled then
    return;
  end if;

  delete from public.user_role_assignments
  where user_id = legacy_demo_user_id;

  update public.app_users
  set status = 'disabled', updated_at = now()
  where id = legacy_demo_user_id;

  if to_regclass('auth.refresh_tokens') is not null then
    execute 'delete from auth.refresh_tokens where user_id = $1'
      using legacy_demo_user_id::text;
  end if;

  -- GoTrue schemas before the sessions table stored only refresh tokens.
  if to_regclass('auth.sessions') is not null then
    execute 'delete from auth.sessions where user_id = $1'
      using legacy_demo_user_id;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'auth'
      and table_name = 'users'
      and column_name = 'banned_until'
  ) then
    execute $statement$
      update auth.users
      set banned_until = timestamptz '9999-12-31 23:59:59+00',
          updated_at = now()
      where id = $1
    $statement$ using legacy_demo_user_id;
  else
    -- On older self-hosted GoTrue, deletion is the only reliable revocation.
    delete from auth.users where id = legacy_demo_user_id;
  end if;
end;
$$;
