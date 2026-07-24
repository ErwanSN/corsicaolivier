create type public.position_preference_level as enum ('preferred', 'neutral', 'avoid');
create type public.unavailability_kind as enum (
  'leave',
  'training',
  'medical',
  'rest',
  'other'
);

create table public.agents (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  primary_site_id uuid not null references public.sites(id) on delete restrict,
  user_id uuid unique references public.app_users(id) on delete set null,
  employee_number text not null check (employee_number ~ '^[A-Za-z0-9._-]{1,32}$'),
  display_name text not null check (char_length(display_name) between 1 and 160),
  active boolean not null default true,
  hired_on date,
  left_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, employee_number),
  check (left_on is null or hired_on is null or left_on >= hired_on)
);

create index agents_site_active on public.agents (primary_site_id, active, display_name);

create table public.agent_contract_versions (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  agent_id uuid not null references public.agents(id) on delete cascade,
  effective_from date not null,
  effective_until date,
  weekly_target_minutes integer not null check (weekly_target_minutes between 0 and 10080),
  monthly_target_minutes integer check (monthly_target_minutes between 0 and 44640),
  full_time_equivalent numeric(5,4) not null default 1 check (full_time_equivalent between 0 and 2),
  label text check (label is null or char_length(label) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agent_id, effective_from),
  check (effective_until is null or effective_until >= effective_from)
);

create index agent_contract_versions_lookup
  on public.agent_contract_versions (agent_id, effective_from desc);

create table public.agent_groups (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  site_id uuid not null references public.sites(id) on delete restrict,
  code text not null check (code ~ '^[A-Z0-9-]{1,24}$'),
  name text not null check (char_length(name) between 1 and 120),
  description text check (description is null or char_length(description) <= 500),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, code)
);

create table public.agent_group_memberships (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  group_id uuid not null references public.agent_groups(id) on delete cascade,
  agent_id uuid not null references public.agents(id) on delete cascade,
  effective_from date not null,
  effective_until date,
  created_at timestamptz not null default now(),
  unique (group_id, agent_id, effective_from),
  check (effective_until is null or effective_until >= effective_from)
);

create index agent_group_memberships_agent
  on public.agent_group_memberships (agent_id, effective_from, effective_until);

create table public.hour_target_overrides (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  site_id uuid not null references public.sites(id) on delete restrict,
  agent_id uuid references public.agents(id) on delete cascade,
  group_id uuid references public.agent_groups(id) on delete cascade,
  week_start date not null,
  target_minutes integer not null check (target_minutes between 0 and 10080),
  reason text not null check (char_length(reason) between 3 and 500),
  created_by uuid not null references public.app_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (extract(isodow from week_start) = 1),
  check ((agent_id is not null)::integer + (group_id is not null)::integer = 1)
);

create unique index hour_target_overrides_subject_week
  on public.hour_target_overrides (agent_id, group_id, week_start)
  nulls not distinct;

create table public.skills (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  code text not null check (code ~ '^[A-Z0-9-]{1,32}$'),
  name text not null check (char_length(name) between 1 and 120),
  description text check (description is null or char_length(description) <= 500),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table public.positions (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  site_id uuid references public.sites(id) on delete restrict,
  code text not null check (code ~ '^[A-Z0-9-]{1,32}$'),
  name text not null check (char_length(name) between 1 and 120),
  description text check (description is null or char_length(description) <= 500),
  color_token text not null default 'slate' check (color_token ~ '^[a-z][a-z0-9-]{1,31}$'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create index positions_scope on public.positions (organization_id, site_id, active, name);

create table public.position_skill_requirements (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  position_id uuid not null references public.positions(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade,
  minimum_level smallint not null default 1 check (minimum_level between 1 and 5),
  mandatory boolean not null default true,
  created_at timestamptz not null default now(),
  unique (position_id, skill_id)
);

create table public.agent_skills (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  agent_id uuid not null references public.agents(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade,
  level smallint not null default 1 check (level between 1 and 5),
  valid_from date not null default current_date,
  valid_until date,
  verified_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agent_id, skill_id, valid_from),
  check (valid_until is null or valid_until >= valid_from)
);

create table public.agent_position_preferences (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  agent_id uuid not null references public.agents(id) on delete cascade,
  position_id uuid not null references public.positions(id) on delete cascade,
  level public.position_preference_level not null,
  priority smallint not null default 3 check (priority between 1 and 5),
  note text check (note is null or char_length(note) <= 500),
  valid_from date not null default current_date,
  valid_until date,
  created_by uuid not null references public.app_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agent_id, position_id, valid_from),
  check (valid_until is null or valid_until >= valid_from)
);

create table public.agent_position_restrictions (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  agent_id uuid not null references public.agents(id) on delete cascade,
  position_id uuid not null references public.positions(id) on delete cascade,
  reason text not null check (char_length(reason) between 3 and 500),
  valid_from date not null default current_date,
  valid_until date,
  created_by uuid not null references public.app_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agent_id, position_id, valid_from),
  check (valid_until is null or valid_until >= valid_from)
);

create table public.agent_unavailability (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  site_id uuid not null references public.sites(id) on delete restrict,
  agent_id uuid not null references public.agents(id) on delete cascade,
  kind public.unavailability_kind not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  note text check (note is null or char_length(note) <= 500),
  created_by uuid not null references public.app_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index agent_unavailability_lookup
  on public.agent_unavailability (agent_id, starts_at, ends_at);

create or replace function public.capture_table_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_state jsonb;
  old_state jsonb;
  organization_value uuid;
  site_value uuid;
  resource_value text;
begin
  row_state := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  old_state := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  organization_value := nullif(row_state ->> 'organization_id', '')::uuid;
  site_value := nullif(row_state ->> 'site_id', '')::uuid;
  resource_value := coalesce(row_state ->> 'id', row_state ->> 'code');

  insert into public.audit_events (
    actor_user_id,
    organization_id,
    site_id,
    action,
    resource_type,
    resource_id,
    before_state,
    after_state,
    metadata
  ) values (
    (select auth.uid()),
    organization_value,
    site_value,
    lower(tg_op),
    tg_table_name,
    resource_value,
    old_state,
    case when tg_op in ('INSERT', 'UPDATE') then row_state else null end,
    jsonb_build_object('schema', tg_table_schema, 'source', 'database_trigger')
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.capture_table_audit() from public;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'agents',
    'agent_contract_versions',
    'agent_groups',
    'agent_group_memberships',
    'hour_target_overrides',
    'skills',
    'positions',
    'position_skill_requirements',
    'agent_skills',
    'agent_position_preferences',
    'agent_position_restrictions',
    'agent_unavailability'
  ] loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function public.capture_table_audit()',
      target_table || '_audit',
      target_table
    );
  end loop;
end;
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
  select exists (
    select 1
    from public.user_role_assignments assignment
    join public.app_users app_user on app_user.id = assignment.user_id
    where assignment.user_id = (select auth.uid())
      and app_user.status = 'active'
      and assignment.valid_from <= now()
      and (assignment.valid_until is null or assignment.valid_until > now())
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

revoke all on function public.has_organization_role(uuid, public.app_role[]) from public;
grant execute on function public.has_organization_role(uuid, public.app_role[]) to authenticated;

drop policy role_assignments_manage_admin on public.user_role_assignments;

create policy role_assignments_manage_admin
on public.user_role_assignments for all to authenticated
using (
  public.has_role(
    organization_id,
    site_id,
    array['platform_admin']::public.app_role[]
  )
  or (
    site_id is null
    and public.has_organization_role(
      organization_id,
      array['planning_admin']::public.app_role[]
    )
  )
  or (
    site_id is not null
    and public.has_role(
      organization_id,
      site_id,
      array['planning_admin']::public.app_role[]
    )
  )
)
with check (
  public.has_role(
    organization_id,
    site_id,
    array['platform_admin']::public.app_role[]
  )
  or (
    site_id is null
    and public.has_organization_role(
      organization_id,
      array['planning_admin']::public.app_role[]
    )
  )
  or (
    site_id is not null
    and public.has_role(
      organization_id,
      site_id,
      array['planning_admin']::public.app_role[]
    )
  )
);

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'agents',
    'agent_contract_versions',
    'agent_groups',
    'hour_target_overrides',
    'skills',
    'positions',
    'agent_skills',
    'agent_position_preferences',
    'agent_position_restrictions',
    'agent_unavailability'
  ] loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      target_table || '_set_updated_at',
      target_table
    );
  end loop;
end;
$$;

create policy memberships_select_authorized
on public.agent_group_memberships for select to authenticated
using (
  exists (
    select 1 from public.agent_groups agent_group
    where agent_group.id = agent_group_memberships.group_id
      and public.has_role(
        agent_group_memberships.organization_id,
        agent_group.site_id,
        array['platform_admin', 'planning_admin', 'planner', 'approver', 'supervisor', 'hr', 'auditor']::public.app_role[]
      )
  )
  or exists (
    select 1 from public.agents agent
    where agent.id = agent_group_memberships.agent_id
      and agent.user_id = (select auth.uid())
  )
);

create policy memberships_manage_authorized
on public.agent_group_memberships for all to authenticated
using (
  exists (
    select 1 from public.agent_groups agent_group
    where agent_group.id = agent_group_memberships.group_id
      and public.has_role(
        agent_group_memberships.organization_id,
        agent_group.site_id,
        array['platform_admin', 'planning_admin', 'planner', 'hr']::public.app_role[]
      )
  )
)
with check (
  exists (
    select 1 from public.agent_groups agent_group
    where agent_group.id = agent_group_memberships.group_id
      and public.has_role(
        agent_group_memberships.organization_id,
        agent_group.site_id,
        array['platform_admin', 'planning_admin', 'planner', 'hr']::public.app_role[]
      )
  )
);

create policy skills_select_authorized
on public.skills for select to authenticated
using (
  public.has_role(
    organization_id,
    null,
    array['platform_admin', 'planning_admin', 'planner', 'approver', 'supervisor', 'hr', 'auditor']::public.app_role[]
  )
);

create policy skills_manage_organization
on public.skills for all to authenticated
using (
  public.has_organization_role(
    organization_id,
    array['platform_admin', 'planning_admin', 'hr']::public.app_role[]
  )
)
with check (
  public.has_organization_role(
    organization_id,
    array['platform_admin', 'planning_admin', 'hr']::public.app_role[]
  )
);

create policy positions_select_authorized
on public.positions for select to authenticated
using (
  public.has_role(
    organization_id,
    site_id,
    array['platform_admin', 'planning_admin', 'planner', 'approver', 'supervisor', 'hr', 'auditor']::public.app_role[]
  )
);

create policy positions_manage_authorized
on public.positions for all to authenticated
using (
  (site_id is null and public.has_organization_role(
    organization_id,
    array['platform_admin', 'planning_admin', 'hr']::public.app_role[]
  ))
  or (site_id is not null and public.has_role(
    organization_id,
    site_id,
    array['platform_admin', 'planning_admin', 'planner', 'hr']::public.app_role[]
  ))
)
with check (
  (site_id is null and public.has_organization_role(
    organization_id,
    array['platform_admin', 'planning_admin', 'hr']::public.app_role[]
  ))
  or (site_id is not null and public.has_role(
    organization_id,
    site_id,
    array['platform_admin', 'planning_admin', 'planner', 'hr']::public.app_role[]
  ))
);

create policy position_requirements_select_authorized
on public.position_skill_requirements for select to authenticated
using (
  exists (
    select 1 from public.positions position
    where position.id = position_skill_requirements.position_id
      and public.has_role(
        position_skill_requirements.organization_id,
        position.site_id,
        array['platform_admin', 'planning_admin', 'planner', 'approver', 'supervisor', 'hr', 'auditor']::public.app_role[]
      )
  )
);

create policy position_requirements_manage_authorized
on public.position_skill_requirements for all to authenticated
using (
  exists (
    select 1 from public.positions position
    where position.id = position_skill_requirements.position_id
      and (
        (position.site_id is null and public.has_organization_role(
          position_skill_requirements.organization_id,
          array['platform_admin', 'planning_admin', 'hr']::public.app_role[]
        ))
        or (position.site_id is not null and public.has_role(
          position_skill_requirements.organization_id,
          position.site_id,
          array['platform_admin', 'planning_admin', 'planner', 'hr']::public.app_role[]
        ))
      )
  )
)
with check (
  exists (
    select 1 from public.positions position
    where position.id = position_skill_requirements.position_id
      and (
        (position.site_id is null and public.has_organization_role(
          position_skill_requirements.organization_id,
          array['platform_admin', 'planning_admin', 'hr']::public.app_role[]
        ))
        or (position.site_id is not null and public.has_role(
          position_skill_requirements.organization_id,
          position.site_id,
          array['platform_admin', 'planning_admin', 'planner', 'hr']::public.app_role[]
        ))
      )
  )
);

create policy agent_skills_select_authorized
on public.agent_skills for select to authenticated
using (
  exists (
    select 1 from public.agents agent
    where agent.id = agent_skills.agent_id
      and (
        agent.user_id = (select auth.uid())
        or public.has_role(
          agent_skills.organization_id,
          agent.primary_site_id,
          array['platform_admin', 'planning_admin', 'planner', 'approver', 'supervisor', 'hr', 'auditor']::public.app_role[]
        )
      )
  )
);

create policy agent_skills_manage_sensitive
on public.agent_skills for all to authenticated
using (
  exists (
    select 1 from public.agents agent
    where agent.id = agent_skills.agent_id
      and public.has_role(
        agent_skills.organization_id,
        agent.primary_site_id,
        array['platform_admin', 'planning_admin', 'hr']::public.app_role[]
      )
  )
)
with check (
  exists (
    select 1 from public.agents agent
    where agent.id = agent_skills.agent_id
      and public.has_role(
        agent_skills.organization_id,
        agent.primary_site_id,
        array['platform_admin', 'planning_admin', 'hr']::public.app_role[]
      )
  )
);

create policy preferences_select_authorized
on public.agent_position_preferences for select to authenticated
using (
  exists (
    select 1 from public.agents agent
    where agent.id = agent_position_preferences.agent_id
      and (
        agent.user_id = (select auth.uid())
        or public.has_role(
          agent_position_preferences.organization_id,
          agent.primary_site_id,
          array['platform_admin', 'planning_admin', 'planner', 'approver', 'supervisor', 'hr', 'auditor']::public.app_role[]
        )
      )
  )
);

create policy preferences_manage_authorized
on public.agent_position_preferences for all to authenticated
using (
  exists (
    select 1 from public.agents agent
    where agent.id = agent_position_preferences.agent_id
      and public.has_role(
        agent_position_preferences.organization_id,
        agent.primary_site_id,
        array['platform_admin', 'planning_admin', 'planner', 'hr']::public.app_role[]
      )
  )
)
with check (
  exists (
    select 1 from public.agents agent
    where agent.id = agent_position_preferences.agent_id
      and public.has_role(
        agent_position_preferences.organization_id,
        agent.primary_site_id,
        array['platform_admin', 'planning_admin', 'planner', 'hr']::public.app_role[]
      )
  )
);

create policy restrictions_select_authorized
on public.agent_position_restrictions for select to authenticated
using (
  exists (
    select 1 from public.agents agent
    where agent.id = agent_position_restrictions.agent_id
      and (
        agent.user_id = (select auth.uid())
        or public.has_role(
          agent_position_restrictions.organization_id,
          agent.primary_site_id,
          array['platform_admin', 'planning_admin', 'planner', 'approver', 'supervisor', 'hr', 'auditor']::public.app_role[]
        )
      )
  )
);

create policy restrictions_manage_sensitive
on public.agent_position_restrictions for all to authenticated
using (
  exists (
    select 1 from public.agents agent
    where agent.id = agent_position_restrictions.agent_id
      and public.has_role(
        agent_position_restrictions.organization_id,
        agent.primary_site_id,
        array['platform_admin', 'planning_admin', 'hr']::public.app_role[]
      )
  )
)
with check (
  exists (
    select 1 from public.agents agent
    where agent.id = agent_position_restrictions.agent_id
      and public.has_role(
        agent_position_restrictions.organization_id,
        agent.primary_site_id,
        array['platform_admin', 'planning_admin', 'hr']::public.app_role[]
      )
  )
);

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'agents',
    'agent_contract_versions',
    'agent_groups',
    'agent_group_memberships',
    'hour_target_overrides',
    'positions',
    'position_skill_requirements',
    'agent_position_preferences',
    'agent_unavailability'
  ] loop
    execute format('alter table public.%I enable row level security', target_table);
  end loop;
end;
$$;

create policy agents_select_authorized
on public.agents for select to authenticated
using (
  user_id = (select auth.uid())
  or public.has_role(
    organization_id,
    primary_site_id,
    array['platform_admin', 'planning_admin', 'planner', 'approver', 'supervisor', 'hr', 'auditor']::public.app_role[]
  )
);

create policy agents_manage_authorized
on public.agents for all to authenticated
using (
  public.has_role(
    organization_id,
    primary_site_id,
    array['platform_admin', 'planning_admin', 'hr']::public.app_role[]
  )
)
with check (
  public.has_role(
    organization_id,
    primary_site_id,
    array['platform_admin', 'planning_admin', 'hr']::public.app_role[]
  )
);

create policy contracts_select_authorized
on public.agent_contract_versions for select to authenticated
using (
  exists (
    select 1 from public.agents agent
    where agent.id = agent_contract_versions.agent_id
      and (
        agent.user_id = (select auth.uid())
        or public.has_role(
          agent_contract_versions.organization_id,
          agent.primary_site_id,
          array['platform_admin', 'planning_admin', 'planner', 'approver', 'hr', 'auditor']::public.app_role[]
        )
      )
  )
);

create policy contracts_manage_authorized
on public.agent_contract_versions for all to authenticated
using (
  exists (
    select 1 from public.agents agent
    where agent.id = agent_contract_versions.agent_id
      and public.has_role(
        agent_contract_versions.organization_id,
        agent.primary_site_id,
        array['platform_admin', 'planning_admin', 'hr']::public.app_role[]
      )
  )
)
with check (
  exists (
    select 1 from public.agents agent
    where agent.id = agent_contract_versions.agent_id
      and public.has_role(
        agent_contract_versions.organization_id,
        agent.primary_site_id,
        array['platform_admin', 'planning_admin', 'hr']::public.app_role[]
      )
  )
);

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'agent_groups',
    'hour_target_overrides',
    'agent_unavailability'
  ] loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.has_role(organization_id, coalesce((to_jsonb(%I) ->> ''site_id'')::uuid, null), array[''platform_admin'', ''planning_admin'', ''planner'', ''approver'', ''supervisor'', ''hr'', ''auditor'']::public.app_role[]) or exists (select 1 from public.agents a where a.id = nullif(to_jsonb(%I) ->> ''agent_id'', '''')::uuid and a.user_id = (select auth.uid())))',
      target_table || '_select_authorized',
      target_table,
      target_table,
      target_table
    );
  end loop;
end;
$$;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'agent_groups',
    'hour_target_overrides',
    'agent_unavailability'
  ] loop
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.has_role(organization_id, coalesce((to_jsonb(%I) ->> ''site_id'')::uuid, null), array[''platform_admin'', ''planning_admin'', ''planner'', ''hr'']::public.app_role[])) with check (public.has_role(organization_id, coalesce((to_jsonb(%I) ->> ''site_id'')::uuid, null), array[''platform_admin'', ''planning_admin'', ''planner'', ''hr'']::public.app_role[]))',
      target_table || '_manage_authorized',
      target_table,
      target_table,
      target_table
    );
  end loop;
end;
$$;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'agents',
    'agent_contract_versions',
    'agent_groups',
    'agent_group_memberships',
    'hour_target_overrides',
    'skills',
    'positions',
    'position_skill_requirements',
    'agent_skills',
    'agent_position_preferences',
    'agent_position_restrictions',
    'agent_unavailability'
  ] loop
    execute format('revoke all on public.%I from anon', target_table);
    execute format('grant select, insert, update, delete on public.%I to authenticated', target_table);
    execute format('grant all on public.%I to service_role', target_table);
  end loop;
end;
$$;
