create extension if not exists pgcrypto with schema extensions;

create type public.app_role as enum (
  'platform_admin',
  'planning_admin',
  'planner',
  'approver',
  'supervisor',
  'agent',
  'hr',
  'auditor'
);

create type public.account_status as enum ('active', 'suspended', 'disabled');

create table public.organizations (
  id uuid primary key default extensions.gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z][a-z0-9-]{2,62}$'),
  name text not null check (char_length(name) between 2 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sites (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  code text not null check (code ~ '^[A-Z0-9-]{2,24}$'),
  name text not null check (char_length(name) between 2 and 120),
  timezone text not null default 'Europe/Paris',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table public.app_users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text not null check (char_length(display_name) between 1 and 160),
  status public.account_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_role_assignments (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  site_id uuid references public.sites(id) on delete cascade,
  role public.app_role not null,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  granted_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (valid_until is null or valid_until > valid_from),
  check (
    (role = 'platform_admin' and organization_id is null and site_id is null)
    or (role <> 'platform_admin' and organization_id is not null)
  )
);

create unique index user_role_assignments_unique_scope
  on public.user_role_assignments (
    user_id,
    role,
    coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(site_id, '00000000-0000-0000-0000-000000000000'::uuid),
    valid_from
  );

create index user_role_assignments_lookup
  on public.user_role_assignments (user_id, organization_id, site_id, role)
  where valid_until is null;

create table public.audit_events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_user_id uuid references public.app_users(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete restrict,
  site_id uuid references public.sites(id) on delete restrict,
  action text not null check (action ~ '^[a-z][a-z0-9_.-]{2,100}$'),
  resource_type text not null check (resource_type ~ '^[a-z][a-z0-9_.-]{1,80}$'),
  resource_id text,
  request_id uuid,
  reason text check (reason is null or char_length(reason) <= 500),
  before_state jsonb,
  after_state jsonb,
  metadata jsonb not null default '{}'::jsonb,
  check (jsonb_typeof(metadata) = 'object')
);

create index audit_events_scope_time
  on public.audit_events (organization_id, site_id, occurred_at desc);
create index audit_events_actor_time
  on public.audit_events (actor_user_id, occurred_at desc);
create index audit_events_resource
  on public.audit_events (resource_type, resource_id, occurred_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

create trigger sites_set_updated_at
before update on public.sites
for each row execute function public.set_updated_at();

create trigger app_users_set_updated_at
before update on public.app_users
for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.app_users (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(coalesce(new.email, new.id::text), '@', 1)
    )
  )
  on conflict (id) do update
    set email = excluded.email,
        display_name = excluded.display_name,
        updated_at = now();
  return new;
end;
$$;

create trigger on_auth_user_created
after insert or update of email, raw_user_meta_data on auth.users
for each row execute function public.handle_new_auth_user();

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
          and (
            target_site_id is null
            or assignment.site_id is null
            or assignment.site_id = target_site_id
          )
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
          and assignment.valid_from <= now()
          and (assignment.valid_until is null or assignment.valid_until > now())
      ),
      '[]'::jsonb
    )
  )
  from public.app_users app_user
  where app_user.id = (select auth.uid())
    and app_user.status = 'active';
$$;

create or replace function public.prevent_audit_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_events are append-only';
end;
$$;

create trigger audit_events_prevent_update
before update or delete on public.audit_events
for each row execute function public.prevent_audit_mutation();

revoke all on function public.has_role(uuid, uuid, public.app_role[]) from public;
revoke all on function public.get_my_access_context() from public;
grant execute on function public.has_role(uuid, uuid, public.app_role[]) to authenticated;
grant execute on function public.get_my_access_context() to authenticated;

alter table public.organizations enable row level security;
alter table public.sites enable row level security;
alter table public.app_users enable row level security;
alter table public.user_role_assignments enable row level security;
alter table public.audit_events enable row level security;

create policy organizations_select_authorized
on public.organizations for select to authenticated
using (
  public.has_role(
    id,
    null,
    array[
      'platform_admin',
      'planning_admin',
      'planner',
      'approver',
      'supervisor',
      'agent',
      'hr',
      'auditor'
    ]::public.app_role[]
  )
);

create policy organizations_manage_admin
on public.organizations for all to authenticated
using (public.has_role(id, null, array['platform_admin']::public.app_role[]))
with check (public.has_role(id, null, array['platform_admin']::public.app_role[]));

create policy sites_select_authorized
on public.sites for select to authenticated
using (
  public.has_role(
    organization_id,
    id,
    array[
      'platform_admin',
      'planning_admin',
      'planner',
      'approver',
      'supervisor',
      'agent',
      'hr',
      'auditor'
    ]::public.app_role[]
  )
);

create policy sites_manage_admin
on public.sites for all to authenticated
using (
  public.has_role(
    organization_id,
    id,
    array['platform_admin', 'planning_admin']::public.app_role[]
  )
)
with check (
  public.has_role(
    organization_id,
    id,
    array['platform_admin', 'planning_admin']::public.app_role[]
  )
);

create policy app_users_select_self_or_admin
on public.app_users for select to authenticated
using (
  id = (select auth.uid())
  or public.has_role(
    null,
    null,
    array['platform_admin']::public.app_role[]
  )
  or exists (
    select 1
    from public.user_role_assignments assignment
    where assignment.user_id = app_users.id
      and public.has_role(
        assignment.organization_id,
        assignment.site_id,
        array['planning_admin', 'hr', 'auditor']::public.app_role[]
      )
  )
);

create policy app_users_update_self
on public.app_users for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()) and status = 'active');

create policy role_assignments_select_self_or_admin
on public.user_role_assignments for select to authenticated
using (
  user_id = (select auth.uid())
  or public.has_role(
    organization_id,
    site_id,
    array['platform_admin', 'planning_admin', 'auditor']::public.app_role[]
  )
);

create policy role_assignments_manage_admin
on public.user_role_assignments for all to authenticated
using (
  public.has_role(
    organization_id,
    site_id,
    array['platform_admin', 'planning_admin']::public.app_role[]
  )
)
with check (
  public.has_role(
    organization_id,
    site_id,
    array['platform_admin', 'planning_admin']::public.app_role[]
  )
);

create policy audit_events_select_auditor
on public.audit_events for select to authenticated
using (
  public.has_role(
    organization_id,
    site_id,
    array['platform_admin', 'planning_admin', 'auditor']::public.app_role[]
  )
);

revoke all on public.organizations from anon;
revoke all on public.sites from anon;
revoke all on public.app_users from anon;
revoke all on public.user_role_assignments from anon;
revoke all on public.audit_events from anon, authenticated;

grant select, insert, update, delete on public.organizations to authenticated;
grant select, insert, update, delete on public.sites to authenticated;
grant select, update on public.app_users to authenticated;
grant select, insert, update, delete on public.user_role_assignments to authenticated;
grant select on public.audit_events to authenticated;

grant all on public.organizations to service_role;
grant all on public.sites to service_role;
grant all on public.app_users to service_role;
grant all on public.user_role_assignments to service_role;
grant all on public.audit_events to service_role;
grant usage, select on sequence public.audit_events_id_seq to service_role;
