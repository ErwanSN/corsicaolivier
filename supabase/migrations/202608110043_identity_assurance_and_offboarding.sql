-- Require reinforced session assurance for every human business path
-- and make workforce departures revoke access transactionally.

create or replace function public.is_current_human_aal2()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select auth.role()) = 'authenticated', false)
    and (select auth.uid()) is not null
    and coalesce(
      nullif(current_setting('request.jwt.claim.is_anonymous', true), ''),
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'is_anonymous',
      'false'
    ) = 'false'
    and coalesce(
      nullif(current_setting('request.jwt.claim.aal', true), ''),
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'aal'
    ) = 'aal2';
$$;

revoke all on function public.is_current_human_aal2()
from public, anon, authenticated, service_role;
grant execute on function public.is_current_human_aal2() to authenticated;

create or replace function public.is_current_app_user_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_current_human_aal2()
    and exists (
      select 1
      from public.app_users app_user
      where app_user.id = (select auth.uid())
        and app_user.status = 'active'
    );
$$;

revoke all on function public.is_current_app_user_active()
from public, anon, authenticated, service_role;
grant execute on function public.is_current_app_user_active() to authenticated;

-- The maritime exception is intentionally usable only while a privileged,
-- service-role-only ingestion RPC has opened its transaction-local scope.
create or replace function public.has_role(
  target_organization_id uuid,
  target_site_id uuid,
  allowed_roles public.app_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (
      coalesce((select auth.role()) = 'service_role', false)
      and coalesce(
        current_setting('app.maritime_machine_feed', true) = 'true',
        false
      )
    )
    or (
      public.is_current_app_user_active()
      and exists (
        select 1
        from public.user_role_assignments assignment
        where assignment.user_id = (select auth.uid())
          and assignment.valid_from <= clock_timestamp()
          and (assignment.valid_until is null or assignment.valid_until > clock_timestamp())
          and assignment.role = any(allowed_roles)
          and (
            assignment.role = 'platform_admin'
            or (
              assignment.organization_id = target_organization_id
              and (
                target_site_id is null
                or assignment.site_id is null
                or assignment.site_id = target_site_id
              )
            )
          )
      )
    );
$$;

create or replace function public.has_organization_role(
  target_organization_id uuid,
  allowed_roles public.app_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_current_app_user_active()
    and exists (
      select 1
      from public.user_role_assignments assignment
      where assignment.user_id = (select auth.uid())
        and assignment.valid_from <= clock_timestamp()
        and (assignment.valid_until is null or assignment.valid_until > clock_timestamp())
        and assignment.role = any(allowed_roles)
        and (
          assignment.role = 'platform_admin'
          or (
            assignment.organization_id = target_organization_id
            and assignment.site_id is null
          )
        )
    );
$$;

create or replace function public.get_my_access_context()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'userId', app_user.id,
    'displayName', app_user.display_name,
    'status', app_user.status,
    'assignments',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'role', assignment.role,
            'organizationId', assignment.organization_id,
            'siteId', assignment.site_id,
            'validFrom', assignment.valid_from,
            'validUntil', assignment.valid_until
          )
          order by assignment.role, assignment.organization_id, assignment.site_id
        )
        from public.user_role_assignments assignment
        where assignment.user_id = app_user.id
          and assignment.valid_from <= clock_timestamp()
          and (assignment.valid_until is null or assignment.valid_until > clock_timestamp())
      ),
      '[]'::jsonb
    )
  )
  from public.app_users app_user
  where app_user.id = (select auth.uid())
    and app_user.status = 'active'
    and public.is_current_human_aal2();
$$;

revoke all on function public.has_role(uuid, uuid, public.app_role[])
from public, anon, authenticated, service_role;
revoke all on function public.has_organization_role(uuid, public.app_role[])
from public, anon, authenticated, service_role;
revoke all on function public.get_my_access_context()
from public, anon, authenticated, service_role;
grant execute on function public.has_role(uuid, uuid, public.app_role[])
to authenticated;
grant execute on function public.has_organization_role(uuid, public.app_role[])
to authenticated;
grant execute on function public.get_my_access_context() to authenticated;

-- RLS remains the final barrier for clients that bypass the API and address
-- PostgREST directly. Apply the assurance gate to every business relation,
-- including relations introduced after the original active-account gate.
do $$
declare
  target_table text;
  policy_name text;
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
    policy_name := target_table || '_aal2_human_gate';
    execute format('drop policy if exists %I on public.%I', policy_name, target_table);
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated using ((select public.is_current_app_user_active())) with check ((select public.is_current_app_user_active()))',
      policy_name,
      target_table
    );
  end loop;
end;
$$;

-- updated_at also moves when Auth synchronizes harmless email/profile metadata.
-- Keep a dedicated provenance clock that changes only with the account status,
-- so an offboarding-owned disable can later be distinguished from an
-- independent suspension without blocking ordinary identity corrections.
alter table public.app_users
add column status_changed_at timestamptz not null default clock_timestamp();

create or replace function public.set_app_user_status_changed_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.status_changed_at := clock_timestamp();
  return new;
end;
$$;

revoke all on function public.set_app_user_status_changed_at()
from public, anon, authenticated, service_role;

drop trigger if exists app_users_00_status_changed_at on public.app_users;
drop trigger if exists app_users_00_initialize_status_changed_at on public.app_users;
drop trigger if exists app_users_00_touch_status_changed_at on public.app_users;
create trigger app_users_00_initialize_status_changed_at
before insert on public.app_users
for each row execute function public.set_app_user_status_changed_at();
create trigger app_users_00_touch_status_changed_at
before update of status on public.app_users
for each row execute function public.set_app_user_status_changed_at();

create table public.agent_offboarding_plans (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  agent_id uuid not null unique references public.agents(id) on delete restrict,
  user_id uuid references public.app_users(id) on delete set null,
  effective_at timestamptz not null,
  reason text not null check (char_length(pg_catalog.btrim(reason)) between 3 and 500),
  status text not null check (status in ('scheduled', 'completed', 'cancelled', 'failed')),
  requested_by uuid not null references public.app_users(id) on delete restrict,
  requested_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  cancelled_at timestamptz,
  account_disabled_by_offboarding boolean not null default false,
  account_disabled_at timestamptz,
  auth_ban_applied_by_offboarding boolean not null default false,
  prior_auth_banned_until timestamptz,
  auth_ban_value timestamptz,
  failure_count integer not null default 0 check (failure_count >= 0),
  last_failed_at timestamptz,
  last_error_code text check (last_error_code is null or last_error_code ~ '^[0-9A-Z]{5}$'),
  updated_at timestamptz not null default clock_timestamp(),
  check (
    (status = 'scheduled' and completed_at is null and cancelled_at is null)
    or (status = 'completed' and completed_at is not null and cancelled_at is null)
    or (status = 'cancelled' and completed_at is null and cancelled_at is not null)
    or (status = 'failed' and completed_at is null and cancelled_at is null)
  ),
  check (account_disabled_by_offboarding = (account_disabled_at is not null)),
  check (auth_ban_applied_by_offboarding = (auth_ban_value is not null))
);

create index agent_offboarding_plans_due
on public.agent_offboarding_plans (effective_at, agent_id)
where status = 'scheduled';

create index agent_offboarding_plans_access_cutoff
on public.agent_offboarding_plans (user_id, effective_at)
where status in ('scheduled', 'failed');

alter table public.agent_offboarding_plans enable row level security;
alter table public.agent_offboarding_plans force row level security;

create policy agent_offboarding_plans_service_role
on public.agent_offboarding_plans for select to service_role
using (true);

revoke all on table public.agent_offboarding_plans
from public, anon, authenticated, service_role;
grant select on table public.agent_offboarding_plans to service_role;

create trigger agent_offboarding_plans_set_updated_at
before update on public.agent_offboarding_plans
for each row execute function public.set_updated_at();

create or replace function public.is_agent_employment_active(target_agent_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.agents agent
    join public.sites site on site.id = agent.primary_site_id
    where agent.id = target_agent_id
      and agent.active
      and (
        agent.hired_on is null
        or agent.hired_on <= (clock_timestamp() at time zone site.timezone)::date
      )
      and (
        agent.left_on is null
        or agent.left_on >= (clock_timestamp() at time zone site.timezone)::date
      )
      and not exists (
        select 1
        from public.agent_offboarding_plans plan
        where plan.agent_id = agent.id
          and plan.status in ('scheduled', 'failed')
          and plan.effective_at <= clock_timestamp()
      )
  );
$$;

revoke all on function public.is_agent_employment_active(uuid)
from public, anon, authenticated, service_role;

create or replace function public.can_current_user_access_agent(
  target_agent_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_current_app_user_active()
    and exists (
      select 1
      from public.agents agent
      where agent.id = target_agent_id
        and agent.user_id = (select auth.uid())
        and public.is_agent_employment_active(agent.id)
    );
$$;

revoke all on function public.can_current_user_access_agent(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.can_current_user_access_agent(uuid)
to authenticated;

create or replace function public.is_role_assignment_available(
  target_assignment_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
      select 1
      from public.user_role_assignments assignment
      join public.agent_offboarding_plans plan
        on plan.user_id = assignment.user_id
        and (
          plan.organization_id = assignment.organization_id
          or assignment.role = 'platform_admin'
        )
      join public.agents departed_agent on departed_agent.id = plan.agent_id
      where assignment.id = target_assignment_id
        and plan.status in ('scheduled', 'failed')
        and plan.effective_at <= clock_timestamp()
        and (
          assignment.organization_id = departed_agent.organization_id
          or assignment.role = 'platform_admin'
        )
    )
    and not exists (
      -- Historical inactive/expired agents may predate the plan table. Their
      -- old organization and global platform roles are still fail-closed.
      select 1
      from public.user_role_assignments assignment
      join public.agents departed_agent
        on departed_agent.user_id = assignment.user_id
      where assignment.id = target_assignment_id
        and (
          assignment.organization_id = departed_agent.organization_id
          or assignment.role = 'platform_admin'
        )
        and not public.is_agent_employment_active(departed_agent.id)
    );
$$;

revoke all on function public.is_role_assignment_available(uuid)
from public, anon, authenticated, service_role;

-- Redefine the access primitives after the offboarding relation exists so a
-- due plan cuts access at the exact boundary even if maintenance is delayed.
create or replace function public.has_role(
  target_organization_id uuid,
  target_site_id uuid,
  allowed_roles public.app_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (
      coalesce((select auth.role()) = 'service_role', false)
      and coalesce(
        current_setting('app.maritime_machine_feed', true) = 'true',
        false
      )
    )
    or (
      public.is_current_app_user_active()
      and exists (
        select 1
        from public.user_role_assignments assignment
        where assignment.user_id = (select auth.uid())
          and assignment.valid_from <= clock_timestamp()
          and (assignment.valid_until is null or assignment.valid_until > clock_timestamp())
          and public.is_role_assignment_available(assignment.id)
          and assignment.role = any(allowed_roles)
          and (
            assignment.role = 'platform_admin'
            or (
              assignment.organization_id = target_organization_id
              and (
                target_site_id is null
                or assignment.site_id is null
                or assignment.site_id = target_site_id
              )
            )
          )
      )
    );
$$;

create or replace function public.has_organization_role(
  target_organization_id uuid,
  allowed_roles public.app_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_current_app_user_active()
    and exists (
      select 1
      from public.user_role_assignments assignment
      where assignment.user_id = (select auth.uid())
        and assignment.valid_from <= clock_timestamp()
        and (assignment.valid_until is null or assignment.valid_until > clock_timestamp())
        and public.is_role_assignment_available(assignment.id)
        and assignment.role = any(allowed_roles)
        and (
          assignment.role = 'platform_admin'
          or (
            assignment.organization_id = target_organization_id
            and assignment.site_id is null
          )
        )
    );
$$;

create or replace function public.get_my_access_context()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'userId', app_user.id,
    'displayName', app_user.display_name,
    'status', app_user.status,
    'assignments',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'role', assignment.role,
            'organizationId', assignment.organization_id,
            'siteId', assignment.site_id,
            'validFrom', assignment.valid_from,
            'validUntil', assignment.valid_until
          )
          order by assignment.role, assignment.organization_id, assignment.site_id
        )
        from public.user_role_assignments assignment
        where assignment.user_id = app_user.id
          and assignment.valid_from <= clock_timestamp()
          and (assignment.valid_until is null or assignment.valid_until > clock_timestamp())
          and public.is_role_assignment_available(assignment.id)
      ),
      '[]'::jsonb
    )
  )
  from public.app_users app_user
  where app_user.id = (select auth.uid())
    and app_user.status = 'active'
    and public.is_current_human_aal2();
$$;

-- An account may retain a legitimate role in another organization, but its
-- old self-service identity must no longer expose the departed agent's rows.
do $$
declare
  target_table text;
  policy_name text;
begin
  for target_table in
    select table_name
    from information_schema.columns
    where table_schema = 'public'
      and column_name = 'agent_id'
      and table_name <> 'agent_offboarding_plans'
      and exists (
        select 1
        from pg_catalog.pg_class table_class
        join pg_catalog.pg_namespace table_namespace
          on table_namespace.oid = table_class.relnamespace
        where table_namespace.nspname = 'public'
          and table_class.relname = information_schema.columns.table_name
          and table_class.relrowsecurity
      )
    order by table_name
  loop
    policy_name := target_table || '_inactive_self_gate';
    execute format('drop policy if exists %I on public.%I', policy_name, target_table);
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated using (not exists (select 1 from public.agents self_agent where self_agent.id = agent_id and self_agent.user_id = (select auth.uid())) or public.can_current_user_access_agent(agent_id)) with check (not exists (select 1 from public.agents self_agent where self_agent.id = agent_id and self_agent.user_id = (select auth.uid())) or public.can_current_user_access_agent(agent_id))',
      policy_name,
      target_table
    );
  end loop;
end;
$$;

drop policy if exists agents_inactive_self_gate on public.agents;
create policy agents_inactive_self_gate
on public.agents as restrictive for all to authenticated
using (
  user_id is distinct from (select auth.uid())
  or public.can_current_user_access_agent(id)
)
with check (
  user_id is distinct from (select auth.uid())
  or public.can_current_user_access_agent(id)
);

create or replace function public.revoke_user_auth_sessions(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  refresh_user_id_type text;
  refresh_instance_id uuid;
  session_user_id_type text;
begin
  if to_regclass('auth.refresh_tokens') is not null
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'auth'
        and table_name = 'refresh_tokens'
        and column_name = 'user_id'
    ) then
    select column_info.udt_name into refresh_user_id_type
    from information_schema.columns column_info
    where column_info.table_schema = 'auth'
      and column_info.table_name = 'refresh_tokens'
      and column_info.column_name = 'user_id';

    if refresh_user_id_type = 'uuid' then
      execute 'delete from auth.refresh_tokens where user_id = $1'
        using target_user_id;
    elsif exists (
      select 1 from information_schema.columns
      where table_schema = 'auth'
        and table_name = 'refresh_tokens'
        and column_name = 'instance_id'
    ) and exists (
      select 1 from information_schema.columns
      where table_schema = 'auth'
        and table_name = 'users'
        and column_name = 'instance_id'
    ) then
      execute 'select instance_id from auth.users where id = $1'
        into refresh_instance_id
        using target_user_id;

      if refresh_instance_id is null then
        execute $statement$
          delete from auth.refresh_tokens
          where instance_id is null
            and user_id = $1::text
        $statement$ using target_user_id;
      else
        execute $statement$
          delete from auth.refresh_tokens
          where instance_id = $2
            and user_id = $1::text
        $statement$ using target_user_id, refresh_instance_id;
      end if;
    else
      execute 'delete from auth.refresh_tokens where user_id = $1::text'
        using target_user_id;
    end if;
  end if;

  -- Older GoTrue schemas deliberately have no sessions relation.
  if to_regclass('auth.sessions') is not null
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'auth'
        and table_name = 'sessions'
        and column_name = 'user_id'
    ) then
    select column_info.udt_name into session_user_id_type
    from information_schema.columns column_info
    where column_info.table_schema = 'auth'
      and column_info.table_name = 'sessions'
      and column_info.column_name = 'user_id';

    if session_user_id_type = 'uuid' then
      execute 'delete from auth.sessions where user_id = $1'
        using target_user_id;
    else
      execute 'delete from auth.sessions where user_id = $1::text'
        using target_user_id;
    end if;
  end if;
end;
$$;

revoke all on function public.revoke_user_auth_sessions(uuid)
from public, anon, authenticated, service_role;

create or replace function public.complete_agent_offboarding(
  target_agent_id uuid,
  target_effective_at timestamptz,
  offboarding_reason text,
  actor_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_agent public.agents;
  remaining_authority boolean := false;
  has_other_organization_authority boolean := false;
  has_future_organization_authority boolean := false;
  sessions_revoked boolean := false;
  account_disabled boolean := false;
  disabled_at_value timestamptz;
  prior_banned_until_value timestamptz;
  applied_ban_value constant timestamptz := timestamptz '9999-12-31 23:59:59+00';
  ban_applied boolean := false;
  expired_role_count integer := 0;
  changed_role_count integer := 0;
begin
  select agent.* into target_agent
  from public.agents agent
  where agent.id = target_agent_id
  for update;

  if target_agent.id is null then
    raise exception 'Collaborateur introuvable' using errcode = 'P2002';
  end if;

  -- Future departures are only scheduled. Roles and sessions stay untouched
  -- until the exact site-local boundary, making cancellation/rescheduling
  -- lossless and leaving the worker one atomic offboarding transaction.
  if target_effective_at > clock_timestamp() then
    insert into public.audit_events (
      actor_user_id, organization_id, site_id, action, resource_type,
      resource_id, reason, before_state, after_state
    ) values (
      actor_user_id,
      target_agent.organization_id,
      target_agent.primary_site_id,
      'workforce.agent.offboarding-scheduled',
      'agent',
      target_agent.id::text,
      pg_catalog.btrim(offboarding_reason),
      jsonb_build_object('active', target_agent.active, 'leftOn', target_agent.left_on),
      jsonb_build_object(
        'active', target_agent.active,
        'leftOn', target_agent.left_on,
        'effectiveAt', target_effective_at
      )
    );
    return;
  end if;

  select exists (
    select 1
    from public.user_role_assignments assignment
    where assignment.user_id = target_agent.user_id
      and assignment.organization_id is not null
      and assignment.organization_id <> target_agent.organization_id
      and assignment.valid_from <= clock_timestamp()
      and (assignment.valid_until is null or assignment.valid_until > clock_timestamp())
  ) into has_other_organization_authority;

  select exists (
    select 1
    from public.user_role_assignments assignment
    where assignment.user_id = target_agent.user_id
      and assignment.organization_id is not null
      and assignment.organization_id <> target_agent.organization_id
      and assignment.role <> 'platform_admin'
      and assignment.valid_from > clock_timestamp()
      and (
        assignment.valid_until is null
        or assignment.valid_until > assignment.valid_from
      )
  ) into has_future_organization_authority;

  -- The agent/user relation is unique. Close every role in the departed
  -- organization. The unique linked agent also loses every global platform
  -- role, even when a scoped role in another organization keeps the account.
  delete from public.user_role_assignments assignment
  where assignment.user_id = target_agent.user_id
    and (
      assignment.organization_id = target_agent.organization_id
      or assignment.role = 'platform_admin'
    )
    and assignment.valid_from >= target_effective_at;
  get diagnostics expired_role_count = row_count;

  update public.user_role_assignments assignment
  set valid_until = least(
    coalesce(assignment.valid_until, target_effective_at),
    target_effective_at
  )
  where assignment.user_id = target_agent.user_id
    and (
      assignment.organization_id = target_agent.organization_id
      or assignment.role = 'platform_admin'
    )
    and assignment.valid_from < target_effective_at
    and (assignment.valid_until is null or assignment.valid_until > target_effective_at);
  get diagnostics changed_role_count = row_count;
  expired_role_count := expired_role_count + changed_role_count;

  if target_effective_at <= clock_timestamp() then
    update public.agents agent
    set active = false
    where agent.id = target_agent.id;
  end if;

  if target_agent.user_id is not null and target_effective_at <= clock_timestamp() then
    select exists (
      select 1
      from public.user_role_assignments assignment
      where assignment.user_id = target_agent.user_id
        and assignment.valid_from <= clock_timestamp()
        and (assignment.valid_until is null or assignment.valid_until > clock_timestamp())
    ) or exists (
      select 1
      from public.agents other_agent
      where other_agent.user_id = target_agent.user_id
        and other_agent.id <> target_agent.id
        and public.is_agent_employment_active(other_agent.id)
    ) into remaining_authority;

    if not remaining_authority then
      perform public.revoke_user_auth_sessions(target_agent.user_id);
      sessions_revoked := true;
    end if;

    if not remaining_authority and not has_future_organization_authority then
      update public.app_users app_user
      set status = 'disabled'
      where app_user.id = target_agent.user_id
        and app_user.status = 'active'
      returning app_user.status_changed_at into disabled_at_value;

      account_disabled := disabled_at_value is not null;

      if account_disabled and exists (
        select 1 from information_schema.columns
        where table_schema = 'auth'
          and table_name = 'users'
          and column_name = 'banned_until'
      ) then
        execute 'select banned_until from auth.users where id = $1 for update'
          into prior_banned_until_value
          using target_agent.user_id;

        if prior_banned_until_value is null
          or prior_banned_until_value <= clock_timestamp() then
          execute $statement$
            update auth.users
            set banned_until = $2,
                updated_at = clock_timestamp()
            where id = $1
          $statement$ using target_agent.user_id, applied_ban_value;
          ban_applied := true;
        end if;
      end if;

      if account_disabled then
        update public.agent_offboarding_plans plan
        set account_disabled_by_offboarding = true,
            account_disabled_at = disabled_at_value,
            auth_ban_applied_by_offboarding = ban_applied,
            prior_auth_banned_until = prior_banned_until_value,
            auth_ban_value = case when ban_applied then applied_ban_value else null end
        where plan.agent_id = target_agent.id;
      end if;
    end if;
  end if;

  insert into public.audit_events (
    actor_user_id,
    organization_id,
    site_id,
    action,
    resource_type,
    resource_id,
    reason,
    before_state,
    after_state,
    metadata
  ) values (
    actor_user_id,
    target_agent.organization_id,
    target_agent.primary_site_id,
    'workforce.agent.offboarded',
    'agent',
    target_agent.id::text,
    pg_catalog.btrim(offboarding_reason),
    jsonb_build_object('active', target_agent.active, 'leftOn', target_agent.left_on),
    jsonb_build_object(
      'active', false,
      'leftOn', target_agent.left_on,
      'effectiveAt', target_effective_at
    ),
    jsonb_build_object(
      'expiredRoleCount', expired_role_count,
      'accountDisabled', account_disabled,
      'preservedOtherOrganizationAuthority', has_other_organization_authority,
      'preservedFutureOrganizationAuthority', has_future_organization_authority,
      'sessionsRevoked', sessions_revoked,
      'authBanApplied', ban_applied
    )
  );
end;
$$;

revoke all on function public.complete_agent_offboarding(uuid, timestamptz, text, uuid)
from public, anon, authenticated, service_role;

create or replace function public.prevent_informal_agent_reactivation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_setting('app.agent_reactivation_workflow', true) = 'true' then
    return new;
  end if;

  if (not old.active and new.active)
    or (old.left_on is not null and new.left_on is null) then
    raise exception 'La réactivation exige le workflow dédié'
      using errcode = 'P2003';
  end if;

  return new;
end;
$$;

revoke all on function public.prevent_informal_agent_reactivation()
from public, anon, authenticated, service_role;

drop trigger if exists agents_prevent_informal_reactivation on public.agents;
create trigger agents_prevent_informal_reactivation
before update of active, left_on on public.agents
for each row execute function public.prevent_informal_agent_reactivation();

-- Migration 040 used the database session's current_date here. Evaluate the
-- membership window in the agent's former site instead, otherwise a move near
-- midnight can bypass still-active local workforce rules.
create or replace function public.guard_agent_primary_site_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_site_timezone text;
  old_site_local_date date;
begin
  if new.primary_site_id is distinct from old.primary_site_id then
    select site.timezone into old_site_timezone
    from public.sites site
    where site.id = old.primary_site_id
      and site.organization_id = old.organization_id;

    if old_site_timezone is null or not exists (
      select 1
      from pg_catalog.pg_timezone_names timezone_name
      where timezone_name.name = old_site_timezone
    ) then
      raise exception using
        errcode = 'P2086',
        message = 'Cannot determine the former site timezone for this agent.';
    end if;

    old_site_local_date := (
      clock_timestamp() at time zone old_site_timezone
    )::date;

    if exists (
      select 1
      from public.agent_group_memberships membership
      join public.agent_groups agent_group
        on agent_group.id = membership.group_id
      where membership.agent_id = old.id
        and membership.organization_id = old.organization_id
        and membership.effective_from <= old_site_local_date
        and (
          membership.effective_until is null
          or membership.effective_until >= old_site_local_date
        )
        and agent_group.site_id <> new.primary_site_id
    ) then
      raise exception using
        errcode = 'P2086',
        message = 'End active cross-site group memberships before moving this agent.';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.guard_agent_primary_site_change()
from public, anon, authenticated, service_role;

create or replace function public.update_agent_record(
  target_agent_id uuid,
  target_organization_id uuid,
  changes jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_agent public.agents;
  existing_plan public.agent_offboarding_plans%rowtype;
  previous_site_id uuid;
  next_site_id uuid;
  next_employee_number text;
  next_display_name text;
  next_active boolean;
  next_hired_on date;
  next_left_on date;
  offboarding_reason text;
  offboarding_requested boolean := false;
  site_only_reschedule boolean := false;
  effective_at timestamptz;
  target_timezone text;
  actor_id uuid := (select auth.uid());
begin
  select agent.* into target_agent
  from public.agents agent
  where agent.id = target_agent_id
    and agent.organization_id = target_organization_id
  for update;

  if target_agent.id is null then
    raise exception 'Collaborateur introuvable' using errcode = 'P2002';
  end if;

  previous_site_id := target_agent.primary_site_id;

  if not public.has_role(
    target_agent.organization_id,
    target_agent.primary_site_id,
    array['platform_admin', 'planning_admin', 'hr']::public.app_role[]
  ) then
    raise exception 'Autorisation insuffisante pour ce collaborateur'
      using errcode = 'P2003';
  end if;

  select plan.* into existing_plan
  from public.agent_offboarding_plans plan
  where plan.agent_id = target_agent.id
  for update;

  if changes is null or jsonb_typeof(changes) <> 'object'
    or changes - array[
      'primarySiteId', 'employeeNumber', 'displayName', 'active',
      'hiredOn', 'leftOn', 'offboardingReason'
    ] <> '{}'::jsonb then
    raise exception 'Champs de modification invalides' using errcode = 'P2001';
  end if;

  next_site_id := case when changes ? 'primarySiteId'
    then nullif(changes ->> 'primarySiteId', '')::uuid else target_agent.primary_site_id end;
  next_employee_number := case when changes ? 'employeeNumber'
    then pg_catalog.btrim(changes ->> 'employeeNumber') else target_agent.employee_number end;
  next_display_name := case when changes ? 'displayName'
    then pg_catalog.btrim(changes ->> 'displayName') else target_agent.display_name end;
  next_active := case when changes ? 'active'
    then (changes ->> 'active')::boolean else target_agent.active end;
  next_hired_on := case when changes ? 'hiredOn'
    then nullif(changes ->> 'hiredOn', '')::date else target_agent.hired_on end;
  next_left_on := case when changes ? 'leftOn'
    then nullif(changes ->> 'leftOn', '')::date else target_agent.left_on end;
  offboarding_reason := nullif(pg_catalog.btrim(changes ->> 'offboardingReason'), '');

  -- Once an effective offboarding made the agent inactive, only the dedicated
  -- reactivation workflow may change lifecycle fields. Full web forms may
  -- repeat unchanged active/leftOn values, so reject actual divergence rather
  -- than the mere presence of those keys.
  if not target_agent.active and (
    next_active is distinct from target_agent.active
    or next_left_on is distinct from target_agent.left_on
  ) then
    raise exception 'Le cycle de vie d’un collaborateur inactif exige le workflow de réactivation'
      using errcode = 'P2003';
  end if;

  if next_site_id is distinct from target_agent.primary_site_id
    and existing_plan.status = 'failed' then
    raise exception 'Relancez ou annulez le départ en échec avant de changer de zone'
      using errcode = 'P2003';
  end if;

  site_only_reschedule := next_site_id is distinct from target_agent.primary_site_id
    and next_left_on is not null
    and next_left_on is not distinct from target_agent.left_on
    and existing_plan.status = 'scheduled';

  if site_only_reschedule then
    offboarding_reason := existing_plan.reason;
  end if;

  if not target_agent.active and next_active then
    raise exception 'La réactivation exige le workflow dédié'
      using errcode = 'P2003';
  end if;

  if target_agent.left_on is not null and next_left_on is null then
    raise exception 'L’annulation d’un départ exige le workflow de réactivation'
      using errcode = 'P2003';
  end if;

  select site.timezone into target_timezone
  from public.sites site
  where site.id = next_site_id
    and site.organization_id = target_agent.organization_id
    and site.active;

  if next_site_id is null
    or target_timezone is null
    or not exists (
      select 1
      from pg_catalog.pg_timezone_names timezone_name
      where timezone_name.name = target_timezone
    ) then
    raise exception 'Organisation ou zone invalide' using errcode = 'P2002';
  end if;

  if next_site_id <> target_agent.primary_site_id and not public.has_role(
    target_agent.organization_id,
    next_site_id,
    array['platform_admin', 'planning_admin', 'hr']::public.app_role[]
  ) then
    raise exception 'Autorisation insuffisante sur la nouvelle zone'
      using errcode = 'P2003';
  end if;

  if next_employee_number !~ '^[A-Za-z0-9._-]{1,32}$'
    or char_length(next_display_name) not between 1 and 160
    or (next_left_on is not null and next_hired_on is not null and next_left_on < next_hired_on) then
    raise exception 'Données du collaborateur invalides' using errcode = 'P2001';
  end if;

  if next_left_on is not null
    and next_left_on < (clock_timestamp() at time zone target_timezone)::date then
    next_active := false;
  end if;

  -- Normalize lifecycle state in the site timezone before deciding whether
  -- this command starts offboarding. Otherwise an ordinary edit of a legacy
  -- row with an elapsed left_on could silently deactivate the agent without
  -- the transactional role/session cleanup and mandatory audit reason.
  offboarding_requested := (target_agent.active and not next_active)
    or (next_left_on is not null and next_left_on is distinct from target_agent.left_on)
    or site_only_reschedule;

  if offboarding_requested
    and (offboarding_reason is null or char_length(offboarding_reason) not between 3 and 500) then
    raise exception 'Un motif de départ de 3 à 500 caractères est obligatoire'
      using errcode = 'P2001';
  end if;

  update public.agents agent
  set primary_site_id = next_site_id,
      employee_number = next_employee_number,
      display_name = next_display_name,
      active = next_active,
      hired_on = next_hired_on,
      left_on = next_left_on
  where agent.id = target_agent.id
  returning * into target_agent;

  if offboarding_requested then
    effective_at := case
      when not next_active then clock_timestamp()
      else (next_left_on + 1)::timestamp at time zone target_timezone
    end;

    insert into public.agent_offboarding_plans (
      organization_id, agent_id, user_id, effective_at, reason,
      status, requested_by, requested_at, completed_at
    ) values (
      target_agent.organization_id,
      target_agent.id,
      target_agent.user_id,
      effective_at,
      offboarding_reason,
      case when effective_at <= clock_timestamp() then 'completed' else 'scheduled' end,
      case when site_only_reschedule then existing_plan.requested_by else actor_id end,
      case when site_only_reschedule then existing_plan.requested_at else clock_timestamp() end,
      case when effective_at <= clock_timestamp() then clock_timestamp() else null end
    )
    on conflict (agent_id) do update
    set organization_id = excluded.organization_id,
        user_id = excluded.user_id,
        effective_at = excluded.effective_at,
        reason = excluded.reason,
        status = excluded.status,
        requested_by = excluded.requested_by,
        requested_at = excluded.requested_at,
        completed_at = excluded.completed_at,
        cancelled_at = null,
        account_disabled_by_offboarding = false,
        account_disabled_at = null,
        auth_ban_applied_by_offboarding = false,
        prior_auth_banned_until = null,
        auth_ban_value = null,
        failure_count = 0,
        last_failed_at = null,
        last_error_code = null;

    perform public.complete_agent_offboarding(
      target_agent.id,
      effective_at,
      offboarding_reason,
      actor_id
    );

    if site_only_reschedule then
      insert into public.audit_events (
        actor_user_id, organization_id, site_id, action, resource_type,
        resource_id, reason, before_state, after_state
      ) values (
        actor_id,
        target_agent.organization_id,
        target_agent.primary_site_id,
        'workforce.agent.offboarding-rescheduled',
        'agent_offboarding_plan',
        existing_plan.id::text,
        'Recalcul automatique après changement de zone',
        jsonb_build_object(
          'siteId', previous_site_id,
          'effectiveAt', existing_plan.effective_at
        ),
        jsonb_build_object(
          'siteId', target_agent.primary_site_id,
          'effectiveAt', effective_at
        )
      );
    end if;
  end if;

  return to_jsonb(target_agent);
end;
$$;

create or replace function public.reactivate_agent_record(
  target_agent_id uuid,
  target_organization_id uuid,
  reactivation_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_agent public.agents;
  offboarding_plan public.agent_offboarding_plans%rowtype;
  account_status public.account_status;
  account_status_changed_at timestamptz;
  current_auth_banned_until timestamptz;
  target_authority_valid boolean := false;
  departure_was_effective boolean := false;
  reactivate_account boolean := false;
  auth_ban_restored boolean := false;
  actor_id uuid := (select auth.uid());
begin
  select agent.* into target_agent
  from public.agents agent
  where agent.id = target_agent_id
    and agent.organization_id = target_organization_id
  for update;

  if target_agent.id is null then
    raise exception 'Collaborateur introuvable' using errcode = 'P2002';
  end if;

  if not public.has_role(
    target_agent.organization_id,
    target_agent.primary_site_id,
    array['platform_admin', 'planning_admin', 'hr']::public.app_role[]
  ) then
    raise exception 'Autorisation insuffisante pour ce collaborateur'
      using errcode = 'P2003';
  end if;

  if reactivation_reason is null
    or char_length(pg_catalog.btrim(reactivation_reason)) not between 3 and 500 then
    raise exception 'Un motif de réactivation de 3 à 500 caractères est obligatoire'
      using errcode = 'P2001';
  end if;

  select plan.* into offboarding_plan
  from public.agent_offboarding_plans plan
  where plan.agent_id = target_agent.id
  for update;

  departure_was_effective := not target_agent.active
    or coalesce(offboarding_plan.status in ('completed', 'failed'), false)
    or coalesce(offboarding_plan.effective_at <= clock_timestamp(), false);

  if target_agent.user_id is not null then
    select app_user.status, app_user.status_changed_at
    into account_status, account_status_changed_at
    from public.app_users app_user
    where app_user.id = target_agent.user_id
    for update;

    if coalesce(offboarding_plan.account_disabled_by_offboarding, false)
      and (
        account_status is distinct from 'disabled'::public.account_status
        or account_status_changed_at is distinct from offboarding_plan.account_disabled_at
      ) then
      raise exception 'Le statut du compte a changé depuis le départ; une revue de sécurité est requise'
        using errcode = 'P2003';
    end if;

    if coalesce(offboarding_plan.account_disabled_by_offboarding, false) then
      if exists (
        select 1 from information_schema.columns
        where table_schema = 'auth'
          and table_name = 'users'
          and column_name = 'banned_until'
      ) then
        execute 'select banned_until from auth.users where id = $1 for update'
          into current_auth_banned_until
          using target_agent.user_id;
      elsif coalesce(offboarding_plan.auth_ban_applied_by_offboarding, false) then
        raise exception 'Le verrou d’authentification du départ est introuvable'
          using errcode = 'P2003';
      end if;

      if coalesce(offboarding_plan.auth_ban_applied_by_offboarding, false)
        and current_auth_banned_until is distinct from offboarding_plan.auth_ban_value then
        raise exception 'Le verrou d’authentification a changé depuis le départ; une revue de sécurité est requise'
          using errcode = 'P2003';
      elsif not coalesce(offboarding_plan.auth_ban_applied_by_offboarding, false)
        and current_auth_banned_until > clock_timestamp() then
        raise exception 'Une suspension de sécurité indépendante bloque la réactivation'
          using errcode = 'P2003';
      end if;
    end if;

    if departure_was_effective and not exists (
      select 1
      from public.user_role_assignments assignment
      where assignment.user_id = target_agent.user_id
        and assignment.organization_id = target_agent.organization_id
        and assignment.site_id = target_agent.primary_site_id
        and assignment.role = 'agent'
        and assignment.valid_from <= clock_timestamp()
        and (assignment.valid_until is null or assignment.valid_until > clock_timestamp())
    ) then
      insert into public.user_role_assignments (
        user_id, organization_id, site_id, role, valid_from, granted_by
      ) values (
        target_agent.user_id,
        target_agent.organization_id,
        target_agent.primary_site_id,
        'agent',
        clock_timestamp(),
        actor_id
      );
    end if;

    select exists (
      select 1
      from public.user_role_assignments assignment
      where assignment.user_id = target_agent.user_id
        and assignment.valid_from <= clock_timestamp()
        and (assignment.valid_until is null or assignment.valid_until > clock_timestamp())
        and (
          assignment.organization_id is distinct from target_agent.organization_id
          or (
            assignment.organization_id = target_agent.organization_id
            and assignment.site_id = target_agent.primary_site_id
          )
        )
    ) into target_authority_valid;

    reactivate_account := coalesce(
      offboarding_plan.account_disabled_by_offboarding
        and account_status = 'disabled'
        and account_status_changed_at = offboarding_plan.account_disabled_at,
      false
    ) and target_authority_valid;
  end if;

  perform set_config('app.agent_reactivation_workflow', 'true', true);
  update public.agents agent
  set active = true,
      left_on = null
  where agent.id = target_agent.id
  returning * into target_agent;
  perform set_config('app.agent_reactivation_workflow', '', true);

  if reactivate_account then
    update public.app_users app_user
    set status = 'active'
    where app_user.id = target_agent.user_id;

    if offboarding_plan.auth_ban_applied_by_offboarding and exists (
      select 1 from information_schema.columns
      where table_schema = 'auth'
        and table_name = 'users'
        and column_name = 'banned_until'
    ) then
      execute $statement$
        update auth.users
        set banned_until = $2,
            updated_at = clock_timestamp()
        where id = $1
          and banned_until is not distinct from $3
        returning true
      $statement$
      into auth_ban_restored
      using
        target_agent.user_id,
        offboarding_plan.prior_auth_banned_until,
        offboarding_plan.auth_ban_value;
      auth_ban_restored := coalesce(auth_ban_restored, false);
    end if;
  end if;

  update public.agent_offboarding_plans plan
  set status = 'cancelled',
      completed_at = null,
      cancelled_at = clock_timestamp()
  where plan.agent_id = target_agent.id;

  insert into public.audit_events (
    actor_user_id, organization_id, site_id, action, resource_type,
    resource_id, reason, after_state
  ) values (
    actor_id,
    target_agent.organization_id,
    target_agent.primary_site_id,
    'workforce.agent.reactivated',
    'agent',
    target_agent.id::text,
    pg_catalog.btrim(reactivation_reason),
    jsonb_build_object(
      'active', true,
      'leftOn', null,
      'accountReactivated', reactivate_account,
      'minimalAgentAuthorityEnsured', departure_was_effective and target_agent.user_id is not null,
      'authBanRestored', auth_ban_restored
    )
  );

  return to_jsonb(target_agent);
exception
  when others then
    perform set_config('app.agent_reactivation_workflow', '', true);
    raise;
end;
$$;

create or replace function public.get_agent_offboarding_plan(
  target_agent_id uuid,
  target_organization_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_agent public.agents;
  response jsonb;
begin
  select agent.* into target_agent
  from public.agents agent
  where agent.id = target_agent_id
    and agent.organization_id = target_organization_id;

  if target_agent.id is null or not public.has_role(
    target_organization_id,
    target_agent.primary_site_id,
    array['platform_admin', 'planning_admin', 'hr', 'auditor']::public.app_role[]
  ) then
    raise exception 'Autorisation insuffisante pour ce collaborateur'
      using errcode = 'P2003';
  end if;

  select jsonb_build_object(
    'status', plan.status,
    'effectiveAt', plan.effective_at,
    'retryCount', plan.failure_count,
    'failureCode', plan.last_error_code,
    'failedAt', plan.last_failed_at
  ) into response
  from public.agent_offboarding_plans plan
  where plan.agent_id = target_agent.id;

  return response;
end;
$$;

create or replace function public.retry_failed_agent_offboarding(
  target_agent_id uuid,
  target_organization_id uuid,
  retry_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_agent public.agents;
  failed_plan public.agent_offboarding_plans%rowtype;
  retried_plan public.agent_offboarding_plans%rowtype;
  actor_id uuid := (select auth.uid());
begin
  select agent.* into target_agent
  from public.agents agent
  where agent.id = target_agent_id
    and agent.organization_id = target_organization_id
  for update;

  if target_agent.id is null or not public.has_role(
    target_organization_id,
    target_agent.primary_site_id,
    array['platform_admin', 'planning_admin', 'hr']::public.app_role[]
  ) then
    raise exception 'Autorisation insuffisante pour ce collaborateur'
      using errcode = 'P2003';
  end if;

  if retry_reason is null
    or char_length(pg_catalog.btrim(retry_reason)) not between 3 and 500 then
    raise exception 'Un motif de relance de 3 à 500 caractères est obligatoire'
      using errcode = 'P2001';
  end if;

  select plan.* into failed_plan
  from public.agent_offboarding_plans plan
  where plan.agent_id = target_agent.id
    and plan.status = 'failed'
  for update;

  if failed_plan.id is null then
    raise exception 'Aucun départ en échec à relancer' using errcode = 'P2002';
  end if;

  update public.agent_offboarding_plans plan
  set status = 'scheduled',
      requested_by = actor_id,
      requested_at = clock_timestamp(),
      completed_at = null,
      cancelled_at = null,
      failure_count = 0,
      last_failed_at = null,
      last_error_code = null
  where plan.id = failed_plan.id
  returning plan.* into retried_plan;

  insert into public.audit_events (
    actor_user_id, organization_id, site_id, action, resource_type,
    resource_id, reason, before_state, after_state
  ) values (
    actor_id,
    target_agent.organization_id,
    target_agent.primary_site_id,
    'workforce.agent.offboarding-retry-requested',
    'agent_offboarding_plan',
    failed_plan.id::text,
    pg_catalog.btrim(retry_reason),
    jsonb_build_object(
      'status', failed_plan.status,
      'retryCount', failed_plan.failure_count,
      'failureCode', failed_plan.last_error_code
    ),
    jsonb_build_object(
      'status', retried_plan.status,
      'retryCount', retried_plan.failure_count,
      'effectiveAt', retried_plan.effective_at
    )
  );

  return jsonb_build_object(
    'status', retried_plan.status,
    'effectiveAt', retried_plan.effective_at,
    'retryCount', retried_plan.failure_count,
    'failureCode', retried_plan.last_error_code,
    'failedAt', retried_plan.last_failed_at
  );
end;
$$;

create or replace function public.finalize_due_agent_offboardings(
  reconciliation_batch_size integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  due_plan record;
  locked_plan public.agent_offboarding_plans%rowtype;
  locked_agent_id uuid;
  completed_count integer := 0;
  failed_count integer := 0;
  transient_failure_count integer := 0;
  dead_lettered_count integer := 0;
  failed_plan_ids uuid[] := array[]::uuid[];
  failure_sqlstate text;
  remaining_count integer := 0;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;

  if reconciliation_batch_size is null or reconciliation_batch_size not between 1 and 500 then
    raise exception 'reconciliation_batch_size must be between 1 and 500'
      using errcode = '22023';
  end if;

  for due_plan in
    -- Candidate discovery takes no row lock. Every mutation path below locks
    -- agent first, then plan, matching update/reactivate and avoiding cycles.
    select plan.id, plan.agent_id
    from public.agent_offboarding_plans plan
    where plan.status = 'scheduled'
      and plan.effective_at <= clock_timestamp()
    order by plan.failure_count, plan.last_failed_at nulls first, plan.effective_at, plan.agent_id
    limit reconciliation_batch_size
  loop
    begin
      locked_agent_id := null;
      locked_plan := null;

      select agent.id into locked_agent_id
      from public.agents agent
      where agent.id = due_plan.agent_id
      for update skip locked;

      if locked_agent_id is null then
        continue;
      end if;

      select plan.* into locked_plan
      from public.agent_offboarding_plans plan
      where plan.id = due_plan.id
        and plan.status = 'scheduled'
        and plan.effective_at <= clock_timestamp()
      for update skip locked;

      if locked_plan.id is null then
        continue;
      end if;

      perform public.complete_agent_offboarding(
        locked_plan.agent_id,
        locked_plan.effective_at,
        locked_plan.reason,
        locked_plan.requested_by
      );

      update public.agent_offboarding_plans plan
      set status = 'completed',
          completed_at = clock_timestamp(),
          cancelled_at = null,
          last_failed_at = null,
          last_error_code = null
      where plan.id = locked_plan.id;
      completed_count := completed_count + 1;
    exception
      when deadlock_detected or serialization_failure then
        -- Lock races are transient capacity signals, never business poison.
        transient_failure_count := transient_failure_count + 1;
      when others then
        get stacked diagnostics failure_sqlstate = returned_sqlstate;
        failed_count := failed_count + 1;
        if cardinality(failed_plan_ids) < 20 then
          failed_plan_ids := array_append(failed_plan_ids, locked_plan.id);
        end if;

        update public.agent_offboarding_plans plan
        set failure_count = plan.failure_count + 1,
            last_failed_at = clock_timestamp(),
            last_error_code = failure_sqlstate,
            status = case when plan.failure_count + 1 >= 5
              then 'failed'
              else 'scheduled'
            end
        where plan.id = locked_plan.id;

        if locked_plan.failure_count + 1 >= 5 then
          dead_lettered_count := dead_lettered_count + 1;
          insert into public.audit_events (
            actor_user_id, organization_id, site_id, action, resource_type,
            resource_id, reason, metadata
          )
          select
            locked_plan.requested_by,
            locked_plan.organization_id,
            agent.primary_site_id,
            'workforce.agent.offboarding-failed',
            'agent_offboarding_plan',
            locked_plan.id::text,
            'Échec technique répété de la finalisation du départ',
            jsonb_build_object(
              'agentId', locked_plan.agent_id,
              'attemptCount', locked_plan.failure_count + 1,
              'errorCode', failure_sqlstate
            )
          from public.agents agent
          where agent.id = locked_plan.agent_id;
        end if;
    end;
  end loop;

  select count(*)::integer into remaining_count
  from public.agent_offboarding_plans plan
  where plan.status = 'scheduled'
    and plan.effective_at <= clock_timestamp();

  -- Report the whole dead-letter backlog, not only failures created by this
  -- batch, so the worker heartbeat remains actionable between retries.
  select count(*)::integer into dead_lettered_count
  from public.agent_offboarding_plans plan
  where plan.status = 'failed';

  return jsonb_build_object(
    'completedCount', completed_count,
    'failedCount', failed_count,
    'transientFailureCount', transient_failure_count,
    'deadLetteredCount', dead_lettered_count,
    'failedPlanIds', to_jsonb(failed_plan_ids),
    'remainingCount', remaining_count
  );
end;
$$;

revoke all on function public.update_agent_record(uuid, uuid, jsonb)
from public, anon, authenticated, service_role;
revoke all on function public.reactivate_agent_record(uuid, uuid, text)
from public, anon, authenticated, service_role;
revoke all on function public.get_agent_offboarding_plan(uuid, uuid)
from public, anon, authenticated, service_role;
revoke all on function public.retry_failed_agent_offboarding(uuid, uuid, text)
from public, anon, authenticated, service_role;
revoke all on function public.finalize_due_agent_offboardings(integer)
from public, anon, authenticated, service_role;
grant execute on function public.update_agent_record(uuid, uuid, jsonb)
to authenticated;
grant execute on function public.reactivate_agent_record(uuid, uuid, text)
to authenticated;
grant execute on function public.get_agent_offboarding_plan(uuid, uuid)
to authenticated;
grant execute on function public.retry_failed_agent_offboarding(uuid, uuid, text)
to authenticated;
grant execute on function public.finalize_due_agent_offboardings(integer)
to service_role;

-- Keep the mature balance calculation unchanged behind an assurance-aware
-- authorization wrapper. A departed self identity must use a legitimate
-- manager role just like any other caller.
alter function public.get_agent_hour_balance(uuid, date, uuid)
rename to get_agent_hour_balance_unchecked_043;
revoke all on function public.get_agent_hour_balance_unchecked_043(uuid, date, uuid)
from public, anon, authenticated, service_role;

create or replace function public.get_agent_hour_balance(
  target_agent_id uuid,
  target_week_start date,
  target_schedule_version_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_agent public.agents;
begin
  if not public.is_current_app_user_active() then
    raise exception 'Active account required' using errcode = '42501';
  end if;

  select agent.* into target_agent
  from public.agents agent
  where agent.id = target_agent_id;

  if target_agent.id is null then
    raise exception 'Agent not found' using errcode = 'P2002';
  end if;

  if not (
    target_agent.user_id = (select auth.uid())
    and public.is_agent_employment_active(target_agent.id)
  ) and not public.has_role(
    target_agent.organization_id,
    target_agent.primary_site_id,
    array[
      'platform_admin', 'planning_admin', 'planner', 'approver',
      'supervisor', 'hr', 'auditor'
    ]::public.app_role[]
  ) then
    raise exception 'Insufficient permissions' using errcode = '42501';
  end if;

  return public.get_agent_hour_balance_unchecked_043(
    target_agent_id,
    target_week_start,
    target_schedule_version_id
  );
end;
$$;

revoke all on function public.get_agent_hour_balance(uuid, date, uuid)
from public, anon, authenticated, service_role;
grant execute on function public.get_agent_hour_balance(uuid, date, uuid)
to authenticated;

create or replace function public.get_my_notifications(
  notification_limit integer default 30,
  unread_only boolean default false
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(notification.payload order by notification.created_at desc),
    '[]'::jsonb
  )
  from (
    select
      jsonb_build_object(
        'id', item.id,
        'organizationId', item.organization_id,
        'siteId', item.site_id,
        'agentId', item.agent_id,
        'scenarioId', item.scenario_id,
        'status', item.status,
        'channel', item.channel,
        'subject', item.subject,
        'body', item.body,
        'sentAt', item.sent_at,
        'acknowledgedAt', item.acknowledged_at,
        'createdAt', item.created_at
      ) as payload,
      item.created_at
    from public.agent_notifications item
    join public.agents agent on agent.id = item.agent_id
    join public.app_users app_user on app_user.id = agent.user_id
    where public.is_current_app_user_active()
      and agent.user_id = (select auth.uid())
      and public.is_agent_employment_active(agent.id)
      and app_user.status = 'active'
      and item.channel = 'in_app'
      and (
        not unread_only
        or item.status not in (
          'acknowledged'::public.notification_status,
          'cancelled'::public.notification_status
        )
      )
    order by item.created_at desc, item.id desc
    limit least(greatest(coalesce(notification_limit, 30), 1), 100)
  ) notification;
$$;

revoke all on function public.get_my_notifications(integer, boolean)
from public, anon, authenticated, service_role;
grant execute on function public.get_my_notifications(integer, boolean)
to authenticated;

-- The notification acknowledgement is a SECURITY DEFINER self-service RPC;
-- unlike table reads it does not pass through RLS, so enforce the same gate.
create or replace function public.acknowledge_my_notification(
  target_notification_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_notification public.agent_notifications%rowtype;
begin
  if not public.is_current_app_user_active() then
    return null;
  end if;

  select item.* into target_notification
  from public.agent_notifications item
  join public.agents agent on agent.id = item.agent_id
  join public.app_users app_user on app_user.id = agent.user_id
  where item.id = target_notification_id
    and agent.user_id = (select auth.uid())
    and public.is_agent_employment_active(agent.id)
    and app_user.status = 'active'
    and item.channel = 'in_app'
    and item.status <> 'cancelled'::public.notification_status
  for update of item;

  if target_notification.id is null then
    return null;
  end if;

  if target_notification.status <> 'acknowledged'::public.notification_status then
    update public.agent_notifications item
    set status = 'acknowledged'::public.notification_status,
        acknowledged_at = clock_timestamp(),
        updated_at = clock_timestamp()
    where item.id = target_notification.id
    returning item.* into target_notification;
  end if;

  return jsonb_build_object(
    'id', target_notification.id,
    'status', target_notification.status,
    'acknowledgedAt', target_notification.acknowledged_at
  );
end;
$$;

revoke all on function public.acknowledge_my_notification(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.acknowledge_my_notification(uuid)
to authenticated;

-- Production and disaster recovery apply migrations from a supabase_admin
-- session after `SET LOCAL ROLE postgres`. This preserves canonical ownership
-- while still allowing us to prove that the bootstrap closed Supabase's broad
-- default ACLs. The local CLI connects directly as postgres; its reset command
-- therefore runs the same versioned hardening immediately after migrations.
do $$
declare
  public_default_acl_difference_count integer;
  non_postgres_owner_count integer;
begin
  if session_user = 'supabase_admin' then
    if current_user <> 'postgres' then
      raise exception
        'Migrations must run as postgres from the supabase_admin session'
        using errcode = '42501';
    end if;

    with actual_default_acl as (
      select
        default_acl.defaclrole::regrole::text as owner_name,
        privilege.grantor::regrole::text as grantor_name,
        case
          when privilege.grantee = 0 then 'PUBLIC'
          else privilege.grantee::regrole::text
        end as grantee_name,
        default_acl.defaclobjtype::text as object_type,
        privilege.privilege_type,
        privilege.is_grantable
      from pg_catalog.pg_default_acl default_acl
      join pg_catalog.pg_namespace namespace
        on namespace.oid = default_acl.defaclnamespace
      cross join lateral pg_catalog.aclexplode(default_acl.defaclacl) privilege
      where namespace.nspname = 'public'
    ),
    expected_default_acl as (
      select
        owner_name,
        owner_name as grantor_name,
        grantee_name,
        privilege.object_type,
        privilege.privilege_type,
        false as is_grantable
      from unnest(array['postgres', 'supabase_admin']) owner_name
      cross join unnest(array['postgres', 'service_role']) grantee_name
      cross join (
        values
          ('f', 'EXECUTE'),
          ('S', 'SELECT'),
          ('S', 'UPDATE'),
          ('S', 'USAGE'),
          ('r', 'INSERT'),
          ('r', 'SELECT'),
          ('r', 'UPDATE'),
          ('r', 'DELETE'),
          ('r', 'TRUNCATE'),
          ('r', 'REFERENCES'),
          ('r', 'TRIGGER')
      ) privilege(object_type, privilege_type)
    )
    select count(*)::integer
      into public_default_acl_difference_count
    from (
      (
        select * from actual_default_acl
        except
        select * from expected_default_acl
      )
      union all
      (
        select * from expected_default_acl
        except
        select * from actual_default_acl
      )
    ) difference;

    if public_default_acl_difference_count <> 0 then
      raise exception
        'Public default privileges do not match the strict PostgreSQL 15 baseline'
        using errcode = '42501';
    end if;

    select count(*)::integer
      into non_postgres_owner_count
    from (
      select relation.oid
      from pg_catalog.pg_class relation
      join pg_catalog.pg_namespace namespace
        on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and relation.relkind in ('r', 'p', 'v', 'm', 'S')
        and relation.relowner <> 'postgres'::regrole

      union all

      select procedure.oid
      from pg_catalog.pg_proc procedure
      join pg_catalog.pg_namespace namespace
        on namespace.oid = procedure.pronamespace
      where namespace.nspname = 'public'
        and procedure.proowner <> 'postgres'::regrole

      union all

      select type.oid
      from pg_catalog.pg_type type
      join pg_catalog.pg_namespace namespace
        on namespace.oid = type.typnamespace
      where namespace.nspname = 'public'
        and type.typowner <> 'postgres'::regrole
    ) unexpected_owner;

    if non_postgres_owner_count <> 0 then
      raise exception
        'Public objects must remain owned by postgres'
        using errcode = '42501';
    end if;
  end if;
end;
$$;

comment on function public.is_current_human_aal2() is
  'True only for a human authenticated JWT with reinforced aal2 session assurance.';
comment on function public.finalize_due_agent_offboardings(integer) is
  'Bounded service-role maintenance that applies scheduled departures and revokes orphaned sessions.';
