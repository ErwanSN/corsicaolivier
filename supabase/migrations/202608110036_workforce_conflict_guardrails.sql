-- Turn workforce changes into scoped business commands and surface any
-- published assignment that becomes impossible after a HR mutation.

-- A schedule version must never make its children disappear implicitly. A
-- draft shift is deleted through the dedicated CAS command; published content
-- remains immutable and every parent deletion is now rejected by the FK.
alter table public.planning_shifts
  drop constraint planning_shifts_schedule_version_id_fkey;

alter table public.planning_shifts
  add constraint planning_shifts_schedule_version_id_fkey
  foreign key (schedule_version_id)
  references public.schedule_versions(id)
  on delete restrict;

-- Migration 004 also installed a composite tenant-integrity FK. Leaving that
-- second path on CASCADE would still make every shift disappear before the
-- simple FK could reject the parent deletion.
alter table public.planning_shifts
  drop constraint shifts_schedule_same_organization;

alter table public.planning_shifts
  add constraint shifts_schedule_same_organization
  foreign key (schedule_version_id, organization_id)
  references public.schedule_versions(id, organization_id)
  on delete restrict;

create table public.planning_workforce_conflicts (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id) on delete restrict,
  site_id uuid not null
    references public.sites(id) on delete restrict,
  schedule_version_id uuid not null
    references public.schedule_versions(id) on delete restrict,
  planning_shift_id uuid not null
    references public.planning_shifts(id) on delete restrict,
  agent_id uuid not null
    references public.agents(id) on delete restrict,
  conflict_kind text not null check (
    conflict_kind in (
      'scope',
      'inactive',
      'employment',
      'contract',
      'unavailability',
      'restriction',
      'skill'
    )
  ),
  summary text not null check (char_length(summary) between 3 and 240),
  details jsonb not null default '{}'::jsonb
    check (jsonb_typeof(details) = 'object'),
  status text not null default 'open'
    check (status in ('open', 'resolved')),
  detection_generation integer not null default 1
    check (detection_generation > 0),
  notified_generation integer not null default 0
    check (
      notified_generation >= 0
      and notified_generation <= detection_generation
    ),
  detected_at timestamptz not null default now(),
  last_detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.app_users(id) on delete set null,
  resolution_note text check (
    resolution_note is null
    or char_length(resolution_note) between 3 and 500
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (planning_shift_id, conflict_kind),
  check (
    (status = 'open' and resolved_at is null and resolved_by is null)
    or (status = 'resolved' and resolved_at is not null)
  )
);

create index planning_workforce_conflicts_open_site_time
  on public.planning_workforce_conflicts (
    site_id,
    last_detected_at desc,
    planning_shift_id
  )
  where status = 'open';

create index planning_workforce_conflicts_agent_status
  on public.planning_workforce_conflicts (
    agent_id,
    status,
    last_detected_at desc
  );

create trigger planning_workforce_conflicts_set_updated_at
before update on public.planning_workforce_conflicts
for each row execute function public.set_updated_at();

create trigger planning_workforce_conflicts_audit
after insert or update or delete on public.planning_workforce_conflicts
for each row execute function public.capture_table_audit();

alter table public.planning_workforce_conflicts enable row level security;
alter table public.planning_workforce_conflicts force row level security;

create policy planning_workforce_conflicts_active_account_gate
on public.planning_workforce_conflicts
as restrictive for all to authenticated
using ((select public.is_current_app_user_active()))
with check ((select public.is_current_app_user_active()));

create policy planning_workforce_conflicts_select_authorized
on public.planning_workforce_conflicts for select to authenticated
using (
  public.has_role(
    organization_id,
    site_id,
    array[
      'platform_admin',
      'planning_admin',
      'planner',
      'approver',
      'supervisor',
      'hr',
      'auditor'
    ]::public.app_role[]
  )
  or exists (
    select 1
    from public.agents agent
    where agent.id = planning_workforce_conflicts.agent_id
      and agent.user_id = (select auth.uid())
  )
);

create policy planning_workforce_conflicts_service_role
on public.planning_workforce_conflicts for all to service_role
using (true)
with check (true);

revoke all on table public.planning_workforce_conflicts
from public, anon, authenticated;
grant select on table public.planning_workforce_conflicts to authenticated;
grant all on table public.planning_workforce_conflicts to service_role;

-- This private read model deliberately mirrors the workforce checks performed
-- at publication. Only future/ongoing shifts in the currently published
-- version are considered.
create or replace function public.get_agent_planning_workforce_violations(
  target_agent_id uuid
)
returns table (
  organization_id uuid,
  site_id uuid,
  schedule_version_id uuid,
  planning_shift_id uuid,
  agent_id uuid,
  conflict_kind text,
  summary text,
  details jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  with future_shifts as materialized (
    select
      shift.id as planning_shift_id,
      shift.organization_id,
      shift.site_id,
      shift.schedule_version_id,
      shift.agent_id,
      shift.starts_at,
      shift.ends_at,
      schedule.planning_period_id,
      schedule.organization_id as schedule_organization_id,
      schedule.site_id as schedule_site_id,
      period.timezone,
      agent.active,
      agent.hired_on,
      agent.left_on,
      agent.organization_id as agent_organization_id,
      agent.primary_site_id
    from public.planning_shifts shift
    join public.schedule_versions schedule
      on schedule.id = shift.schedule_version_id
    join public.planning_periods period
      on period.id = schedule.planning_period_id
    join public.agents agent on agent.id = shift.agent_id
    where shift.agent_id = target_agent_id
      and shift.ends_at > now()
      and schedule.status = 'published'
  )
  select
    shift.organization_id,
    shift.site_id,
    shift.schedule_version_id,
    shift.planning_shift_id,
    shift.agent_id,
    'scope'::text,
    'Le collaborateur n’appartient plus au périmètre de ce planning'::text,
    jsonb_build_object(
      'agentOrganizationId', shift.agent_organization_id,
      'agentSiteId', shift.primary_site_id,
      'scheduleOrganizationId', shift.schedule_organization_id,
      'scheduleSiteId', shift.schedule_site_id
    )
  from future_shifts shift
  where shift.agent_organization_id <> shift.schedule_organization_id
    or shift.primary_site_id <> shift.schedule_site_id

  union all

  select
    shift.organization_id,
    shift.site_id,
    shift.schedule_version_id,
    shift.planning_shift_id,
    shift.agent_id,
    'inactive'::text,
    'Le collaborateur est inactif'::text,
    '{}'::jsonb
  from future_shifts shift
  where not shift.active

  union all

  select
    shift.organization_id,
    shift.site_id,
    shift.schedule_version_id,
    shift.planning_shift_id,
    shift.agent_id,
    'employment'::text,
    'Le service est hors de la période d’emploi'::text,
    jsonb_build_object(
      'hiredOn', shift.hired_on,
      'leftOn', shift.left_on
    )
  from future_shifts shift
  where (
      shift.hired_on is not null
      and shift.hired_on > (shift.starts_at at time zone shift.timezone)::date
    )
    or (
      shift.left_on is not null
      and shift.left_on < (
        (shift.ends_at - interval '1 microsecond')
          at time zone shift.timezone
      )::date
    )

  union all

  select
    shift.organization_id,
    shift.site_id,
    shift.schedule_version_id,
    shift.planning_shift_id,
    shift.agent_id,
    'contract'::text,
    'Aucun contrat ne couvre entièrement ce service'::text,
    '{}'::jsonb
  from future_shifts shift
  where not exists (
    select 1
    from public.agent_contract_versions contract
    where contract.agent_id = shift.agent_id
      and contract.organization_id = shift.schedule_organization_id
      and contract.effective_from
        <= (shift.starts_at at time zone shift.timezone)::date
      and (
        contract.effective_until is null
        or contract.effective_until >= (
          (shift.ends_at - interval '1 microsecond')
            at time zone shift.timezone
        )::date
      )
  )

  union all

  select
    shift.organization_id,
    shift.site_id,
    shift.schedule_version_id,
    shift.planning_shift_id,
    shift.agent_id,
    'unavailability'::text,
    'Une indisponibilité chevauche ce service'::text,
    jsonb_build_object(
      'overlapCount', (
        select count(*)
        from public.agent_unavailability unavailable
        where unavailable.agent_id = shift.agent_id
          and unavailable.organization_id = shift.schedule_organization_id
          and tstzrange(unavailable.starts_at, unavailable.ends_at, '[)')
            && tstzrange(shift.starts_at, shift.ends_at, '[)')
      )
    )
  from future_shifts shift
  where exists (
    select 1
    from public.agent_unavailability unavailable
    where unavailable.agent_id = shift.agent_id
      and unavailable.organization_id = shift.schedule_organization_id
      and tstzrange(unavailable.starts_at, unavailable.ends_at, '[)')
        && tstzrange(shift.starts_at, shift.ends_at, '[)')
  )

  union all

  select
    shift.organization_id,
    shift.site_id,
    shift.schedule_version_id,
    shift.planning_shift_id,
    shift.agent_id,
    'restriction'::text,
    'Une restriction interdit un poste affecté à ce service'::text,
    jsonb_build_object(
      'assignmentCount', (
        select count(distinct assignment.id)
        from public.shift_assignments assignment
        join public.agent_position_restrictions restriction
          on restriction.agent_id = shift.agent_id
          and restriction.position_id = assignment.position_id
          and restriction.organization_id = shift.schedule_organization_id
        where assignment.planning_shift_id = shift.planning_shift_id
          and restriction.valid_from <= (
            (assignment.ends_at - interval '1 microsecond')
              at time zone shift.timezone
          )::date
          and (
            restriction.valid_until is null
            or restriction.valid_until >= (
              assignment.starts_at at time zone shift.timezone
            )::date
          )
      )
    )
  from future_shifts shift
  where exists (
    select 1
    from public.shift_assignments assignment
    join public.agent_position_restrictions restriction
      on restriction.agent_id = shift.agent_id
      and restriction.position_id = assignment.position_id
      and restriction.organization_id = shift.schedule_organization_id
    where assignment.planning_shift_id = shift.planning_shift_id
      and restriction.valid_from <= (
        (assignment.ends_at - interval '1 microsecond')
          at time zone shift.timezone
      )::date
      and (
        restriction.valid_until is null
        or restriction.valid_until >= (
          assignment.starts_at at time zone shift.timezone
        )::date
      )
  )

  union all

  select
    shift.organization_id,
    shift.site_id,
    shift.schedule_version_id,
    shift.planning_shift_id,
    shift.agent_id,
    'skill'::text,
    'Une compétence obligatoire manque pour un poste affecté'::text,
    jsonb_build_object(
      'missingRequirementCount', (
        select count(*)
        from public.shift_assignments assignment
        join public.position_skill_requirements requirement
          on requirement.position_id = assignment.position_id
          and requirement.organization_id = shift.schedule_organization_id
          and requirement.mandatory
        where assignment.planning_shift_id = shift.planning_shift_id
          and not exists (
            select 1
            from public.agent_skills agent_skill
            where agent_skill.agent_id = shift.agent_id
              and agent_skill.skill_id = requirement.skill_id
              and agent_skill.organization_id = shift.schedule_organization_id
              and agent_skill.level >= requirement.minimum_level
              and agent_skill.valid_from <= (
                assignment.starts_at at time zone shift.timezone
              )::date
              and (
                agent_skill.valid_until is null
                or agent_skill.valid_until >= (
                  (assignment.ends_at - interval '1 microsecond')
                    at time zone shift.timezone
                )::date
              )
          )
      )
    )
  from future_shifts shift
  where exists (
    select 1
    from public.shift_assignments assignment
    join public.position_skill_requirements requirement
      on requirement.position_id = assignment.position_id
      and requirement.organization_id = shift.schedule_organization_id
      and requirement.mandatory
    where assignment.planning_shift_id = shift.planning_shift_id
      and not exists (
        select 1
        from public.agent_skills agent_skill
        where agent_skill.agent_id = shift.agent_id
          and agent_skill.skill_id = requirement.skill_id
          and agent_skill.organization_id = shift.schedule_organization_id
          and agent_skill.level >= requirement.minimum_level
          and agent_skill.valid_from <= (
            assignment.starts_at at time zone shift.timezone
          )::date
          and (
            agent_skill.valid_until is null
            or agent_skill.valid_until >= (
              (assignment.ends_at - interval '1 microsecond')
                at time zone shift.timezone
            )::date
          )
      )
  );
$$;

revoke all on function public.get_agent_planning_workforce_violations(uuid)
from public, anon, authenticated;

create or replace function public.recompute_planning_workforce_conflicts(
  target_agent_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  pending_conflict public.planning_workforce_conflicts;
  open_count integer;
  resolved_count integer;
begin
  if target_agent_id is null then
    return jsonb_build_object('openCount', 0, 'resolvedCount', 0);
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'planning-workforce-conflict:' || target_agent_id::text,
      0
    )
  );

  insert into public.planning_workforce_conflicts as conflict (
    organization_id,
    site_id,
    schedule_version_id,
    planning_shift_id,
    agent_id,
    conflict_kind,
    summary,
    details
  )
  select
    violation.organization_id,
    violation.site_id,
    violation.schedule_version_id,
    violation.planning_shift_id,
    violation.agent_id,
    violation.conflict_kind,
    violation.summary,
    violation.details
  from public.get_agent_planning_workforce_violations(target_agent_id) violation
  on conflict (planning_shift_id, conflict_kind) do update
  set organization_id = excluded.organization_id,
      site_id = excluded.site_id,
      schedule_version_id = excluded.schedule_version_id,
      agent_id = excluded.agent_id,
      summary = excluded.summary,
      details = excluded.details,
      status = 'open',
      detection_generation = case
        when conflict.status = 'resolved'
          then conflict.detection_generation + 1
        else conflict.detection_generation
      end,
      last_detected_at = clock_timestamp(),
      resolved_at = null,
      resolved_by = null,
      resolution_note = null;

  update public.planning_workforce_conflicts conflict
  set status = 'resolved',
      resolved_at = clock_timestamp(),
      resolved_by = null,
      resolution_note = 'Contrainte corrigée ou planning publié remplacé'
  where conflict.agent_id = target_agent_id
    and conflict.status = 'open'
    and not exists (
      select 1
      from public.get_agent_planning_workforce_violations(target_agent_id) violation
      where violation.planning_shift_id = conflict.planning_shift_id
        and violation.conflict_kind = conflict.conflict_kind
    );

  get diagnostics resolved_count = row_count;

  for pending_conflict in
    select conflict.*
    from public.planning_workforce_conflicts conflict
    where conflict.agent_id = target_agent_id
      and conflict.status = 'open'
      and conflict.notified_generation < conflict.detection_generation
    order by conflict.detected_at, conflict.id
    for update
  loop
    insert into public.outbox_events (
      organization_id,
      site_id,
      topic,
      aggregate_type,
      aggregate_id,
      payload,
      idempotency_key
    ) values (
      pending_conflict.organization_id,
      pending_conflict.site_id,
      'planning.workforce.conflict',
      'planning_workforce_conflict',
      pending_conflict.id,
      jsonb_build_object(
        'conflictId', pending_conflict.id,
        'scheduleVersionId', pending_conflict.schedule_version_id,
        'shiftId', pending_conflict.planning_shift_id,
        'agentId', pending_conflict.agent_id,
        'kind', pending_conflict.conflict_kind,
        'summary', pending_conflict.summary,
        'generation', pending_conflict.detection_generation
      ),
      'planning-workforce-conflict-'
        || pending_conflict.id::text
        || '-'
        || pending_conflict.detection_generation::text
    )
    on conflict (organization_id, idempotency_key) do nothing;

    update public.planning_workforce_conflicts conflict
    set notified_generation = pending_conflict.detection_generation
    where conflict.id = pending_conflict.id;
  end loop;

  select count(*)::integer
  into open_count
  from public.planning_workforce_conflicts conflict
  where conflict.agent_id = target_agent_id
    and conflict.status = 'open';

  return jsonb_build_object(
    'agentId', target_agent_id,
    'openCount', open_count,
    'resolvedCount', resolved_count
  );
end;
$$;

revoke all on function public.recompute_planning_workforce_conflicts(uuid)
from public, anon, authenticated;

-- Constraint triggers run against the final state of a transaction. Temporal
-- replacement commands can therefore close an old row and insert its successor
-- without emitting a transient missing-contract/missing-skill conflict.
create or replace function public.recompute_workforce_conflicts_from_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_agent_id uuid;
begin
  -- Keep row-type-specific fields in separate branches. PL/pgSQL resolves
  -- every CASE arm against the trigger row type, even an arm never executed.
  if tg_table_name = 'agents' then
    affected_agent_id := case
      when tg_op = 'DELETE' then old.id
      else new.id
    end;
  else
    affected_agent_id := case
      when tg_op = 'DELETE' then old.agent_id
      else new.agent_id
    end;
  end if;

  perform public.recompute_planning_workforce_conflicts(affected_agent_id);
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.recompute_workforce_conflicts_from_row()
from public, anon, authenticated;

create constraint trigger agents_recompute_workforce_conflicts
after insert or update or delete on public.agents
deferrable initially deferred
for each row execute function public.recompute_workforce_conflicts_from_row();

create constraint trigger contracts_recompute_workforce_conflicts
after insert or update or delete on public.agent_contract_versions
deferrable initially deferred
for each row execute function public.recompute_workforce_conflicts_from_row();

create constraint trigger skills_recompute_workforce_conflicts
after insert or update or delete on public.agent_skills
deferrable initially deferred
for each row execute function public.recompute_workforce_conflicts_from_row();

create constraint trigger restrictions_recompute_workforce_conflicts
after insert or update or delete on public.agent_position_restrictions
deferrable initially deferred
for each row execute function public.recompute_workforce_conflicts_from_row();

create constraint trigger unavailability_recompute_workforce_conflicts
after insert or update or delete on public.agent_unavailability
deferrable initially deferred
for each row execute function public.recompute_workforce_conflicts_from_row();

-- Publishing a corrected version archives the invalid published parent. Close
-- its conflicts automatically in the same transaction.
create or replace function public.recompute_workforce_conflicts_from_schedule()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_agent_id uuid;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  for affected_agent_id in
    select shift.agent_id
    from public.planning_shifts shift
    where shift.schedule_version_id in (old.id, new.id)
    union
    select conflict.agent_id
    from public.planning_workforce_conflicts conflict
    where conflict.schedule_version_id in (old.id, new.id)
  loop
    perform public.recompute_planning_workforce_conflicts(affected_agent_id);
  end loop;

  return new;
end;
$$;

revoke all on function public.recompute_workforce_conflicts_from_schedule()
from public, anon, authenticated;

create constraint trigger schedule_versions_recompute_workforce_conflicts
after update on public.schedule_versions
deferrable initially deferred
for each row execute function public.recompute_workforce_conflicts_from_schedule();

-- Agent creation and updates are scoped commands. The JSON patch preserves the
-- difference between an omitted field and an explicit null employment date.
create or replace function public.create_agent_record(
  target_organization_id uuid,
  target_primary_site_id uuid,
  new_display_name text,
  new_employee_number text default null,
  new_user_id uuid default null,
  new_active boolean default true,
  new_hired_on date default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_agent public.agents;
  resolved_employee_number text;
begin
  if not public.has_role(
    target_organization_id,
    target_primary_site_id,
    array['platform_admin', 'planning_admin', 'hr']::public.app_role[]
  ) then
    raise exception 'Autorisation insuffisante pour créer ce collaborateur'
      using errcode = 'P2003';
  end if;

  if not exists (
    select 1
    from public.sites site
    where site.id = target_primary_site_id
      and site.organization_id = target_organization_id
      and site.active
  ) then
    raise exception 'Organisation ou zone invalide'
      using errcode = 'P2002';
  end if;

  if new_user_id is not null and not exists (
    select 1
    from public.app_users app_user
    where app_user.id = new_user_id
  ) then
    raise exception 'Compte utilisateur introuvable'
      using errcode = 'P2002';
  end if;

  if char_length(pg_catalog.btrim(new_display_name)) not between 1 and 160 then
    raise exception 'Nom de collaborateur invalide'
      using errcode = 'P2001';
  end if;

  resolved_employee_number := coalesce(
    nullif(pg_catalog.btrim(new_employee_number), ''),
    'AG-' || upper(substr(replace(extensions.gen_random_uuid()::text, '-', ''), 1, 12))
  );

  if resolved_employee_number !~ '^[A-Za-z0-9._-]{1,32}$' then
    raise exception 'Matricule invalide'
      using errcode = 'P2001';
  end if;

  insert into public.agents (
    organization_id,
    primary_site_id,
    user_id,
    employee_number,
    display_name,
    active,
    hired_on
  ) values (
    target_organization_id,
    target_primary_site_id,
    new_user_id,
    resolved_employee_number,
    pg_catalog.btrim(new_display_name),
    coalesce(new_active, true),
    new_hired_on
  )
  returning * into saved_agent;

  return to_jsonb(saved_agent);
end;
$$;

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
  next_site_id uuid;
  next_employee_number text;
  next_display_name text;
  next_active boolean;
  next_hired_on date;
  next_left_on date;
begin
  select agent.*
  into target_agent
  from public.agents agent
  where agent.id = target_agent_id
    and agent.organization_id = target_organization_id
  for update;

  if target_agent.id is null then
    raise exception 'Collaborateur introuvable'
      using errcode = 'P2002';
  end if;

  if not public.has_role(
    target_agent.organization_id,
    target_agent.primary_site_id,
    array['platform_admin', 'planning_admin', 'hr']::public.app_role[]
  ) then
    raise exception 'Autorisation insuffisante pour ce collaborateur'
      using errcode = 'P2003';
  end if;

  if changes is null or jsonb_typeof(changes) <> 'object'
    or changes - array[
      'primarySiteId',
      'employeeNumber',
      'displayName',
      'active',
      'hiredOn',
      'leftOn'
    ] <> '{}'::jsonb then
    raise exception 'Champs de modification invalides'
      using errcode = 'P2001';
  end if;

  next_site_id := case
    when changes ? 'primarySiteId'
      then nullif(changes ->> 'primarySiteId', '')::uuid
    else target_agent.primary_site_id
  end;
  next_employee_number := case
    when changes ? 'employeeNumber'
      then pg_catalog.btrim(changes ->> 'employeeNumber')
    else target_agent.employee_number
  end;
  next_display_name := case
    when changes ? 'displayName'
      then pg_catalog.btrim(changes ->> 'displayName')
    else target_agent.display_name
  end;
  next_active := case
    when changes ? 'active'
      then (changes ->> 'active')::boolean
    else target_agent.active
  end;
  next_hired_on := case
    when changes ? 'hiredOn'
      then nullif(changes ->> 'hiredOn', '')::date
    else target_agent.hired_on
  end;
  next_left_on := case
    when changes ? 'leftOn'
      then nullif(changes ->> 'leftOn', '')::date
    else target_agent.left_on
  end;

  if next_site_id is null or not exists (
    select 1
    from public.sites site
    where site.id = next_site_id
      and site.organization_id = target_agent.organization_id
      and site.active
  ) then
    raise exception 'Organisation ou zone invalide'
      using errcode = 'P2002';
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
    or next_left_on is not null
      and next_hired_on is not null
      and next_left_on < next_hired_on then
    raise exception 'Données du collaborateur invalides'
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

  return to_jsonb(target_agent);
end;
$$;

-- Target overrides are tenant/site checked, serialize concurrent writes on one
-- subject/week, and always derive the author from auth.uid(). Global groups can
-- only receive a global override from an organization-level administrator.
create or replace function public.set_hour_target_override(
  target_organization_id uuid,
  target_site_id uuid,
  target_agent_id uuid,
  target_group_id uuid,
  target_week_start date,
  new_target_minutes integer,
  new_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_target public.hour_target_overrides;
  target_group public.agent_groups;
  actor_id uuid := (select auth.uid());
  scoped_site_id uuid;
begin
  if actor_id is null then
    raise exception 'Authentification requise'
      using errcode = 'P2003';
  end if;

  if (target_agent_id is not null)::integer
      + (target_group_id is not null)::integer <> 1
    or target_week_start is null
    or extract(isodow from target_week_start) <> 1
    or new_target_minutes not between 0 and 10080
    or char_length(pg_catalog.btrim(new_reason)) not between 3 and 500 then
    raise exception 'Objectif horaire invalide'
      using errcode = 'P2001';
  end if;

  if target_agent_id is not null then
    if not exists (
      select 1
      from public.agents agent
      where agent.id = target_agent_id
        and agent.organization_id = target_organization_id
        and agent.primary_site_id = target_site_id
    ) then
      raise exception 'Collaborateur hors périmètre'
        using errcode = 'P2002';
    end if;
    scoped_site_id := target_site_id;
  else
    select agent_group.*
    into target_group
    from public.agent_groups agent_group
    where agent_group.id = target_group_id
      and agent_group.organization_id = target_organization_id
      and agent_group.active;

    if target_group.id is null then
      raise exception 'Groupe hors périmètre'
        using errcode = 'P2002';
    end if;

    if target_group.site_id is null then
      scoped_site_id := null;
      if not public.has_organization_role(
        target_organization_id,
        array['platform_admin', 'planning_admin', 'hr']::public.app_role[]
      ) then
        raise exception 'Un objectif de groupe global exige un rôle organisationnel'
          using errcode = 'P2003';
      end if;
    else
      if target_site_id is distinct from target_group.site_id then
        raise exception 'Groupe hors périmètre'
          using errcode = 'P2002';
      end if;
      scoped_site_id := target_group.site_id;
    end if;
  end if;

  if target_agent_id is not null or scoped_site_id is not null then
    if not public.has_role(
      target_organization_id,
      scoped_site_id,
      array['platform_admin', 'planning_admin', 'planner', 'hr']::public.app_role[]
    ) then
      raise exception 'Autorisation insuffisante pour cet objectif'
        using errcode = 'P2003';
    end if;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'hour-target:'
        || coalesce(target_agent_id::text, target_group_id::text)
        || ':'
        || target_week_start::text,
      0
    )
  );

  insert into public.hour_target_overrides (
    organization_id,
    site_id,
    agent_id,
    group_id,
    week_start,
    target_minutes,
    reason,
    created_by
  ) values (
    target_organization_id,
    scoped_site_id,
    target_agent_id,
    target_group_id,
    target_week_start,
    new_target_minutes,
    pg_catalog.btrim(new_reason),
    actor_id
  )
  on conflict (agent_id, group_id, week_start) do update
  set organization_id = excluded.organization_id,
      site_id = excluded.site_id,
      target_minutes = excluded.target_minutes,
      reason = excluded.reason,
      created_by = actor_id,
      updated_at = now()
  returning * into saved_target;

  return to_jsonb(saved_target);
end;
$$;

do $$
declare
  command_signature text;
begin
  foreach command_signature in array array[
    'public.create_agent_record(uuid,uuid,text,text,uuid,boolean,date)',
    'public.update_agent_record(uuid,uuid,jsonb)',
    'public.set_hour_target_override(uuid,uuid,uuid,uuid,date,integer,text)'
  ] loop
    execute format(
      'revoke all on function %s from public, anon, authenticated',
      command_signature
    );
    execute format(
      'grant execute on function %s to authenticated',
      command_signature
    );
  end loop;
end;
$$;

revoke insert, update, delete on table
  public.agents,
  public.hour_target_overrides
from authenticated;

-- Bounded RLS-filtered read model used by the planning page.
create or replace function public.get_planning_workforce_conflicts(
  target_site_id uuid,
  range_starts_on date default null,
  range_ends_on date default null,
  include_resolved boolean default false,
  result_limit integer default 50
)
returns table (
  id uuid,
  organization_id uuid,
  site_id uuid,
  schedule_version_id uuid,
  planning_period_id uuid,
  planning_period_starts_on date,
  planning_shift_id uuid,
  shift_starts_at timestamptz,
  shift_ends_at timestamptz,
  agent_id uuid,
  agent_display_name text,
  conflict_kind text,
  summary text,
  details jsonb,
  status text,
  detected_at timestamptz,
  last_detected_at timestamptz,
  resolved_at timestamptz,
  resolution_note text,
  editable_schedule_version_id uuid
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    conflict.id,
    conflict.organization_id,
    conflict.site_id,
    conflict.schedule_version_id,
    schedule.planning_period_id,
    period.starts_on,
    conflict.planning_shift_id,
    shift.starts_at,
    shift.ends_at,
    conflict.agent_id,
    agent.display_name,
    conflict.conflict_kind,
    conflict.summary,
    conflict.details,
    conflict.status,
    conflict.detected_at,
    conflict.last_detected_at,
    conflict.resolved_at,
    conflict.resolution_note,
    editable.id
  from public.planning_workforce_conflicts conflict
  join public.planning_shifts shift on shift.id = conflict.planning_shift_id
  join public.schedule_versions schedule
    on schedule.id = conflict.schedule_version_id
  join public.planning_periods period
    on period.id = schedule.planning_period_id
  join public.agents agent on agent.id = conflict.agent_id
  left join lateral (
    select draft.id
    from public.schedule_versions draft
    where draft.planning_period_id = schedule.planning_period_id
      and draft.status in ('draft', 'validated')
      and draft.superseded_at is null
    order by draft.version_number desc
    limit 1
  ) editable on true
  where conflict.site_id = target_site_id
    and (include_resolved or conflict.status = 'open')
    and (
      range_starts_on is null
      or period.ends_on >= range_starts_on
    )
    and (
      range_ends_on is null
      or period.starts_on <= range_ends_on
    )
  order by
    case when conflict.status = 'open' then 0 else 1 end,
    shift.starts_at,
    conflict.id
  limit least(greatest(coalesce(result_limit, 50), 1), 100);
$$;

revoke all on function public.get_planning_workforce_conflicts(
  uuid, date, date, boolean, integer
) from public, anon, authenticated;
grant execute on function public.get_planning_workforce_conflicts(
  uuid, date, date, boolean, integer
) to authenticated;

create or replace function public.prepare_workforce_conflict_draft(
  target_conflict_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_conflict public.planning_workforce_conflicts;
  target_period public.planning_periods;
  editable_schedule_id uuid;
begin
  select conflict.*
  into target_conflict
  from public.planning_workforce_conflicts conflict
  where conflict.id = target_conflict_id
  for update;

  if target_conflict.id is null or target_conflict.status <> 'open' then
    raise exception 'Conflit de planning introuvable ou déjà résolu'
      using errcode = 'P2002';
  end if;

  if not public.has_role(
    target_conflict.organization_id,
    target_conflict.site_id,
    array['platform_admin', 'planning_admin', 'planner']::public.app_role[]
  ) then
    raise exception 'Autorisation insuffisante pour préparer le brouillon'
      using errcode = 'P2003';
  end if;

  select period.*
  into target_period
  from public.schedule_versions schedule
  join public.planning_periods period
    on period.id = schedule.planning_period_id
  where schedule.id = target_conflict.schedule_version_id;

  editable_schedule_id := public.ensure_editable_schedule_for_period(
    target_period.id
  );

  return jsonb_build_object(
    'conflictId', target_conflict.id,
    'draftScheduleVersionId', editable_schedule_id,
    'planningPeriodId', target_period.id,
    'weekStart', target_period.starts_on,
    'siteId', target_conflict.site_id
  );
end;
$$;

create or replace function public.resolve_planning_workforce_conflict(
  target_conflict_id uuid,
  resolution_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_conflict public.planning_workforce_conflicts;
begin
  select conflict.*
  into target_conflict
  from public.planning_workforce_conflicts conflict
  where conflict.id = target_conflict_id
  for update;

  if target_conflict.id is null then
    raise exception 'Conflit de planning introuvable'
      using errcode = 'P2002';
  end if;

  if not public.has_role(
    target_conflict.organization_id,
    target_conflict.site_id,
    array[
      'platform_admin',
      'planning_admin',
      'planner',
      'approver',
      'hr'
    ]::public.app_role[]
  ) then
    raise exception 'Autorisation insuffisante pour résoudre ce conflit'
      using errcode = 'P2003';
  end if;

  if char_length(pg_catalog.btrim(resolution_reason)) not between 3 and 500 then
    raise exception 'Un motif de résolution est requis'
      using errcode = 'P2001';
  end if;

  perform public.recompute_planning_workforce_conflicts(
    target_conflict.agent_id
  );

  select conflict.*
  into target_conflict
  from public.planning_workforce_conflicts conflict
  where conflict.id = target_conflict_id
  for update;

  if target_conflict.status = 'open' then
    raise exception 'Le conflit est toujours actif ; publiez d’abord un planning compatible'
      using errcode = 'P2060';
  end if;

  update public.planning_workforce_conflicts conflict
  set resolved_by = (select auth.uid()),
      resolution_note = pg_catalog.btrim(resolution_reason),
      resolved_at = coalesce(conflict.resolved_at, clock_timestamp())
  where conflict.id = target_conflict.id
  returning * into target_conflict;

  return to_jsonb(target_conflict);
end;
$$;

do $$
declare
  command_signature text;
begin
  foreach command_signature in array array[
    'public.prepare_workforce_conflict_draft(uuid)',
    'public.resolve_planning_workforce_conflict(uuid,text)'
  ] loop
    execute format(
      'revoke all on function %s from public, anon, authenticated',
      command_signature
    );
    execute format(
      'grant execute on function %s to authenticated',
      command_signature
    );
  end loop;
end;
$$;

comment on table public.planning_workforce_conflicts is
  'Idempotent open/resolved findings created when a HR fact invalidates a future published shift.';
comment on function public.recompute_planning_workforce_conflicts(uuid) is
  'Private transactional reconciliation of published workforce conflicts and their reliable outbox events.';
comment on function public.resolve_planning_workforce_conflict(uuid, text) is
  'Confirms resolution only after the underlying published incompatibility has actually disappeared.';
