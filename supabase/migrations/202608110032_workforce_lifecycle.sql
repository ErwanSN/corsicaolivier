-- Keep workforce history consistent while making day-to-day HR changes atomic.
-- The commands below deliberately expose EXECUTE only: authenticated users do
-- not need broad UPDATE rights on sensitive historical tables after migration
-- 030 tightened the database grants.

alter table public.agent_unavailability enable row level security;
alter table public.agent_unavailability force row level security;

grant select on table public.agent_unavailability to authenticated;

-- Historical data may predate the notion of a single primary group. Keep the
-- most recently created membership when two primary memberships start together,
-- then close every former primary membership before the following one begins.
with ranked_primary as (
  select
    membership.id,
    row_number() over (
      partition by membership.agent_id, membership.effective_from
      order by membership.created_at desc, membership.id desc
    ) as priority_rank
  from public.agent_group_memberships membership
  where membership.is_primary
)
update public.agent_group_memberships membership
set is_primary = false
from ranked_primary ranked
where ranked.id = membership.id
  and ranked.priority_rank > 1;

with primary_windows as (
  select
    membership.id,
    lead(membership.effective_from) over (
      partition by membership.agent_id
      order by membership.effective_from, membership.created_at, membership.id
    ) as next_effective_from
  from public.agent_group_memberships membership
  where membership.is_primary
)
update public.agent_group_memberships membership
set effective_until = primary_window.next_effective_from - 1
from primary_windows primary_window
where primary_window.id = membership.id
  and primary_window.next_effective_from is not null
  and (
    membership.effective_until is null
    or membership.effective_until >= primary_window.next_effective_from
  );

alter table public.agent_group_memberships
  add constraint agent_group_memberships_one_primary_per_period
  exclude using gist (
    agent_id with =,
    daterange(
      effective_from,
      coalesce(effective_until + 1, 'infinity'::date),
      '[)'
    ) with &&
  ) where (is_primary);

create or replace function public.assert_workforce_agent_access(
  target_agent_id uuid,
  allowed_roles public.app_role[]
)
returns public.agents
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_agent public.agents;
begin
  select agent.*
  into target_agent
  from public.agents agent
  where agent.id = target_agent_id;

  if target_agent.id is null then
    raise exception 'Agent introuvable'
      using errcode = 'P2002';
  end if;

  if not public.has_role(
    target_agent.organization_id,
    target_agent.primary_site_id,
    allowed_roles
  ) then
    raise exception 'Autorisation insuffisante pour ce collaborateur'
      using errcode = 'P2003';
  end if;

  return target_agent;
end;
$$;

revoke all on function public.assert_workforce_agent_access(
  uuid,
  public.app_role[]
) from public, anon, authenticated;

create or replace function public.replace_agent_contract(
  target_agent_id uuid,
  target_organization_id uuid,
  new_effective_from date,
  new_weekly_target_minutes integer,
  new_monthly_target_minutes integer default null,
  new_label text default null,
  new_full_time_equivalent numeric default 1,
  new_effective_until date default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_agent public.agents;
  next_effective_from date;
  bounded_effective_until date;
  saved_contract public.agent_contract_versions;
begin
  target_agent := public.assert_workforce_agent_access(
    target_agent_id,
    array['platform_admin', 'planning_admin', 'hr']::public.app_role[]
  );

  if target_agent.organization_id <> target_organization_id then
    raise exception 'Organisation incohérente pour ce collaborateur'
      using errcode = 'P2002';
  end if;

  if new_effective_from is null
    or new_weekly_target_minutes not between 0 and 10080
    or new_monthly_target_minutes is not null
      and new_monthly_target_minutes not between 0 and 44640
    or new_full_time_equivalent not between 0 and 2
    or new_effective_until is not null
      and new_effective_until < new_effective_from then
    raise exception 'Période ou quotité contractuelle invalide'
      using errcode = 'P2001';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('workforce-contract:' || target_agent_id::text, 0)
  );

  select min(contract.effective_from)
  into next_effective_from
  from public.agent_contract_versions contract
  where contract.agent_id = target_agent_id
    and contract.effective_from > new_effective_from;

  bounded_effective_until := case
    when next_effective_from is null then new_effective_until
    when new_effective_until is null then next_effective_from - 1
    else least(new_effective_until, next_effective_from - 1)
  end;

  update public.agent_contract_versions contract
  set effective_until = new_effective_from - 1,
      updated_at = now()
  where contract.agent_id = target_agent_id
    and contract.effective_from < new_effective_from
    and (
      contract.effective_until is null
      or contract.effective_until >= new_effective_from
    );

  insert into public.agent_contract_versions (
    organization_id,
    agent_id,
    effective_from,
    effective_until,
    weekly_target_minutes,
    monthly_target_minutes,
    full_time_equivalent,
    label
  ) values (
    target_organization_id,
    target_agent_id,
    new_effective_from,
    bounded_effective_until,
    new_weekly_target_minutes,
    new_monthly_target_minutes,
    new_full_time_equivalent,
    nullif(pg_catalog.btrim(new_label), '')
  )
  on conflict (agent_id, effective_from) do update
  set effective_until = excluded.effective_until,
      weekly_target_minutes = excluded.weekly_target_minutes,
      monthly_target_minutes = excluded.monthly_target_minutes,
      full_time_equivalent = excluded.full_time_equivalent,
      label = excluded.label,
      updated_at = now()
  returning * into saved_contract;

  return to_jsonb(saved_contract);
end;
$$;

create or replace function public.replace_agent_skill(
  target_agent_id uuid,
  target_organization_id uuid,
  target_skill_id uuid,
  new_level integer,
  new_valid_from date default current_date,
  new_valid_until date default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_agent public.agents;
  next_valid_from date;
  bounded_valid_until date;
  saved_skill public.agent_skills;
begin
  target_agent := public.assert_workforce_agent_access(
    target_agent_id,
    array['platform_admin', 'planning_admin', 'hr']::public.app_role[]
  );

  if target_agent.organization_id <> target_organization_id
    or not exists (
      select 1
      from public.skills skill
      where skill.id = target_skill_id
        and skill.organization_id = target_organization_id
        and skill.active
    ) then
    raise exception 'Compétence ou organisation incohérente'
      using errcode = 'P2002';
  end if;

  if new_level not between 1 and 5
    or new_valid_from is null
    or new_valid_until is not null and new_valid_until < new_valid_from then
    raise exception 'Niveau ou période de compétence invalide'
      using errcode = 'P2001';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'workforce-skill:' || target_agent_id::text || ':' || target_skill_id::text,
      0
    )
  );

  select min(agent_skill.valid_from)
  into next_valid_from
  from public.agent_skills agent_skill
  where agent_skill.agent_id = target_agent_id
    and agent_skill.skill_id = target_skill_id
    and agent_skill.valid_from > new_valid_from;

  bounded_valid_until := case
    when next_valid_from is null then new_valid_until
    when new_valid_until is null then next_valid_from - 1
    else least(new_valid_until, next_valid_from - 1)
  end;

  update public.agent_skills agent_skill
  set valid_until = new_valid_from - 1,
      updated_at = now()
  where agent_skill.agent_id = target_agent_id
    and agent_skill.skill_id = target_skill_id
    and agent_skill.valid_from < new_valid_from
    and (
      agent_skill.valid_until is null
      or agent_skill.valid_until >= new_valid_from
    );

  insert into public.agent_skills (
    organization_id,
    agent_id,
    skill_id,
    level,
    valid_from,
    valid_until,
    verified_by
  ) values (
    target_organization_id,
    target_agent_id,
    target_skill_id,
    new_level,
    new_valid_from,
    bounded_valid_until,
    (select auth.uid())
  )
  on conflict (agent_id, skill_id, valid_from) do update
  set level = excluded.level,
      valid_until = excluded.valid_until,
      verified_by = excluded.verified_by,
      updated_at = now()
  returning * into saved_skill;

  return to_jsonb(saved_skill);
end;
$$;

create or replace function public.replace_agent_position_preference(
  target_agent_id uuid,
  target_organization_id uuid,
  target_position_id uuid,
  new_level public.position_preference_level,
  new_priority integer,
  new_valid_from date default current_date,
  new_note text default null,
  new_valid_until date default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_agent public.agents;
  next_valid_from date;
  bounded_valid_until date;
  saved_preference public.agent_position_preferences;
begin
  target_agent := public.assert_workforce_agent_access(
    target_agent_id,
    array['platform_admin', 'planning_admin', 'planner', 'hr']::public.app_role[]
  );

  if target_agent.organization_id <> target_organization_id
    or not exists (
      select 1
      from public.positions position
      where position.id = target_position_id
        and position.organization_id = target_organization_id
        and position.active
        and (
          position.site_id is null
          or position.site_id = target_agent.primary_site_id
        )
    ) then
    raise exception 'Poste ou organisation incohérente'
      using errcode = 'P2002';
  end if;

  if new_priority not between 1 and 5
    or new_valid_from is null
    or new_valid_until is not null and new_valid_until < new_valid_from then
    raise exception 'Préférence ou période invalide'
      using errcode = 'P2001';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'workforce-position:' || target_agent_id::text || ':' || target_position_id::text,
      0
    )
  );

  select min(boundary.valid_from)
  into next_valid_from
  from (
    select preference.valid_from
    from public.agent_position_preferences preference
    where preference.agent_id = target_agent_id
      and preference.position_id = target_position_id
      and preference.valid_from > new_valid_from
    union all
    select restriction.valid_from
    from public.agent_position_restrictions restriction
    where restriction.agent_id = target_agent_id
      and restriction.position_id = target_position_id
      and restriction.valid_from > new_valid_from
  ) boundary;

  bounded_valid_until := case
    when next_valid_from is null then new_valid_until
    when new_valid_until is null then next_valid_from - 1
    else least(new_valid_until, next_valid_from - 1)
  end;

  update public.agent_position_preferences preference
  set valid_until = new_valid_from - 1,
      updated_at = now()
  where preference.agent_id = target_agent_id
    and preference.position_id = target_position_id
    and preference.valid_from < new_valid_from
    and (
      preference.valid_until is null
      or preference.valid_until >= new_valid_from
    );

  update public.agent_position_restrictions restriction
  set valid_until = new_valid_from - 1,
      updated_at = now()
  where restriction.agent_id = target_agent_id
    and restriction.position_id = target_position_id
    and restriction.valid_from < new_valid_from
    and (
      restriction.valid_until is null
      or restriction.valid_until >= new_valid_from
    );

  delete from public.agent_position_restrictions restriction
  where restriction.agent_id = target_agent_id
    and restriction.position_id = target_position_id
    and restriction.valid_from = new_valid_from;

  insert into public.agent_position_preferences (
    organization_id,
    agent_id,
    position_id,
    level,
    priority,
    note,
    valid_from,
    valid_until,
    created_by
  ) values (
    target_organization_id,
    target_agent_id,
    target_position_id,
    new_level,
    new_priority,
    nullif(pg_catalog.btrim(new_note), ''),
    new_valid_from,
    bounded_valid_until,
    (select auth.uid())
  )
  on conflict (agent_id, position_id, valid_from) do update
  set level = excluded.level,
      priority = excluded.priority,
      note = excluded.note,
      valid_until = excluded.valid_until,
      created_by = excluded.created_by,
      updated_at = now()
  returning * into saved_preference;

  return to_jsonb(saved_preference);
end;
$$;

create or replace function public.replace_agent_position_restriction(
  target_agent_id uuid,
  target_organization_id uuid,
  target_position_id uuid,
  new_reason text,
  new_valid_from date default current_date,
  new_valid_until date default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_agent public.agents;
  next_valid_from date;
  bounded_valid_until date;
  saved_restriction public.agent_position_restrictions;
begin
  target_agent := public.assert_workforce_agent_access(
    target_agent_id,
    array['platform_admin', 'planning_admin', 'hr']::public.app_role[]
  );

  if target_agent.organization_id <> target_organization_id
    or not exists (
      select 1
      from public.positions position
      where position.id = target_position_id
        and position.organization_id = target_organization_id
        and position.active
        and (
          position.site_id is null
          or position.site_id = target_agent.primary_site_id
        )
    ) then
    raise exception 'Poste ou organisation incohérente'
      using errcode = 'P2002';
  end if;

  if char_length(pg_catalog.btrim(new_reason)) not between 3 and 500
    or new_valid_from is null
    or new_valid_until is not null and new_valid_until < new_valid_from then
    raise exception 'Motif ou période de restriction invalide'
      using errcode = 'P2001';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'workforce-position:' || target_agent_id::text || ':' || target_position_id::text,
      0
    )
  );

  select min(boundary.valid_from)
  into next_valid_from
  from (
    select preference.valid_from
    from public.agent_position_preferences preference
    where preference.agent_id = target_agent_id
      and preference.position_id = target_position_id
      and preference.valid_from > new_valid_from
    union all
    select restriction.valid_from
    from public.agent_position_restrictions restriction
    where restriction.agent_id = target_agent_id
      and restriction.position_id = target_position_id
      and restriction.valid_from > new_valid_from
  ) boundary;

  bounded_valid_until := case
    when next_valid_from is null then new_valid_until
    when new_valid_until is null then next_valid_from - 1
    else least(new_valid_until, next_valid_from - 1)
  end;

  update public.agent_position_restrictions restriction
  set valid_until = new_valid_from - 1,
      updated_at = now()
  where restriction.agent_id = target_agent_id
    and restriction.position_id = target_position_id
    and restriction.valid_from < new_valid_from
    and (
      restriction.valid_until is null
      or restriction.valid_until >= new_valid_from
    );

  update public.agent_position_preferences preference
  set valid_until = new_valid_from - 1,
      updated_at = now()
  where preference.agent_id = target_agent_id
    and preference.position_id = target_position_id
    and preference.valid_from < new_valid_from
    and (
      preference.valid_until is null
      or preference.valid_until >= new_valid_from
    );

  delete from public.agent_position_preferences preference
  where preference.agent_id = target_agent_id
    and preference.position_id = target_position_id
    and preference.valid_from = new_valid_from;

  insert into public.agent_position_restrictions (
    organization_id,
    agent_id,
    position_id,
    reason,
    valid_from,
    valid_until,
    created_by
  ) values (
    target_organization_id,
    target_agent_id,
    target_position_id,
    pg_catalog.btrim(new_reason),
    new_valid_from,
    bounded_valid_until,
    (select auth.uid())
  )
  on conflict (agent_id, position_id, valid_from) do update
  set reason = excluded.reason,
      valid_until = excluded.valid_until,
      created_by = excluded.created_by,
      updated_at = now()
  returning * into saved_restriction;

  return to_jsonb(saved_restriction);
end;
$$;

create or replace function public.replace_agent_group_membership(
  target_group_id uuid,
  target_agent_id uuid,
  target_organization_id uuid,
  new_effective_from date,
  new_is_primary boolean default true,
  new_effective_until date default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_agent public.agents;
  next_effective_from date;
  bounded_effective_until date;
  saved_membership public.agent_group_memberships;
begin
  target_agent := public.assert_workforce_agent_access(
    target_agent_id,
    array['platform_admin', 'planning_admin', 'planner', 'hr']::public.app_role[]
  );

  if target_agent.organization_id <> target_organization_id
    or not exists (
      select 1
      from public.agent_groups agent_group
      where agent_group.id = target_group_id
        and agent_group.organization_id = target_organization_id
        and agent_group.active
    ) then
    raise exception 'Groupe ou organisation incohérente'
      using errcode = 'P2002';
  end if;

  if new_effective_from is null
    or new_effective_until is not null
      and new_effective_until < new_effective_from then
    raise exception 'Période de rattachement invalide'
      using errcode = 'P2001';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('workforce-group:' || target_agent_id::text, 0)
  );

  select min(boundary.effective_from)
  into next_effective_from
  from (
    select membership.effective_from
    from public.agent_group_memberships membership
    where membership.agent_id = target_agent_id
      and membership.group_id = target_group_id
      and membership.effective_from > new_effective_from
    union all
    select membership.effective_from
    from public.agent_group_memberships membership
    where new_is_primary
      and membership.agent_id = target_agent_id
      and membership.is_primary
      and membership.effective_from > new_effective_from
  ) boundary;

  bounded_effective_until := case
    when next_effective_from is null then new_effective_until
    when new_effective_until is null then next_effective_from - 1
    else least(new_effective_until, next_effective_from - 1)
  end;

  update public.agent_group_memberships membership
  set effective_until = new_effective_from - 1
  where membership.agent_id = target_agent_id
    and membership.group_id = target_group_id
    and membership.effective_from < new_effective_from
    and (
      membership.effective_until is null
      or membership.effective_until >= new_effective_from
    );

  if new_is_primary then
    update public.agent_group_memberships membership
    set effective_until = new_effective_from - 1
    where membership.agent_id = target_agent_id
      and membership.is_primary
      and membership.effective_from < new_effective_from
      and (
        membership.effective_until is null
        or membership.effective_until >= new_effective_from
      );

    update public.agent_group_memberships membership
    set is_primary = false
    where membership.agent_id = target_agent_id
      and membership.group_id <> target_group_id
      and membership.is_primary
      and membership.effective_from = new_effective_from;
  end if;

  insert into public.agent_group_memberships (
    organization_id,
    group_id,
    agent_id,
    effective_from,
    effective_until,
    is_primary
  ) values (
    target_organization_id,
    target_group_id,
    target_agent_id,
    new_effective_from,
    bounded_effective_until,
    new_is_primary
  )
  on conflict (group_id, agent_id, effective_from) do update
  set effective_until = excluded.effective_until,
      is_primary = excluded.is_primary
  returning * into saved_membership;

  return to_jsonb(saved_membership);
end;
$$;

create or replace function public.create_agent_unavailability(
  target_agent_id uuid,
  target_organization_id uuid,
  target_site_id uuid,
  new_kind public.unavailability_kind,
  new_starts_at timestamptz,
  new_ends_at timestamptz,
  new_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_agent public.agents;
  saved_unavailability public.agent_unavailability;
begin
  target_agent := public.assert_workforce_agent_access(
    target_agent_id,
    array['platform_admin', 'planning_admin', 'planner', 'hr']::public.app_role[]
  );

  if target_agent.organization_id <> target_organization_id
    or target_agent.primary_site_id <> target_site_id then
    raise exception 'Organisation ou zone incohérente pour ce collaborateur'
      using errcode = 'P2002';
  end if;

  if new_starts_at is null
    or new_ends_at is null
    or new_ends_at <= new_starts_at
    or new_note is not null and char_length(new_note) > 500 then
    raise exception 'Période d’indisponibilité invalide'
      using errcode = 'P2001';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('workforce-unavailability:' || target_agent_id::text, 0)
  );

  if exists (
    select 1
    from public.agent_unavailability unavailable
    where unavailable.agent_id = target_agent_id
      and tstzrange(unavailable.starts_at, unavailable.ends_at, '[)')
        && tstzrange(new_starts_at, new_ends_at, '[)')
  ) then
    raise exception 'Une indisponibilité existe déjà sur cette période'
      using errcode = 'P2001';
  end if;

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
    target_organization_id,
    target_site_id,
    target_agent_id,
    new_kind,
    new_starts_at,
    new_ends_at,
    nullif(pg_catalog.btrim(new_note), ''),
    (select auth.uid())
  )
  returning * into saved_unavailability;

  return to_jsonb(saved_unavailability);
end;
$$;

create or replace function public.end_agent_unavailability(
  target_unavailability_id uuid,
  target_agent_id uuid,
  new_ends_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_unavailability public.agent_unavailability;
  target_agent public.agents;
begin
  select unavailable.*
  into target_unavailability
  from public.agent_unavailability unavailable
  where unavailable.id = target_unavailability_id
    and unavailable.agent_id = target_agent_id
  for update;

  if target_unavailability.id is null then
    raise exception 'Indisponibilité introuvable'
      using errcode = 'P2002';
  end if;

  target_agent := public.assert_workforce_agent_access(
    target_unavailability.agent_id,
    array['platform_admin', 'planning_admin', 'planner', 'hr']::public.app_role[]
  );

  if new_ends_at is null or new_ends_at <= target_unavailability.starts_at then
    raise exception 'La date de fin doit suivre le début de l’indisponibilité'
      using errcode = 'P2001';
  end if;

  update public.agent_unavailability unavailable
  set ends_at = least(new_ends_at, unavailable.ends_at),
      updated_at = now()
  where unavailable.id = target_unavailability_id
  returning * into target_unavailability;

  return to_jsonb(target_unavailability);
end;
$$;

do $$
declare
  command_signature text;
begin
  foreach command_signature in array array[
    'public.replace_agent_contract(uuid,uuid,date,integer,integer,text,numeric,date)',
    'public.replace_agent_skill(uuid,uuid,uuid,integer,date,date)',
    'public.replace_agent_position_preference(uuid,uuid,uuid,public.position_preference_level,integer,date,text,date)',
    'public.replace_agent_position_restriction(uuid,uuid,uuid,text,date,date)',
    'public.replace_agent_group_membership(uuid,uuid,uuid,date,boolean,date)',
    'public.create_agent_unavailability(uuid,uuid,uuid,public.unavailability_kind,timestamptz,timestamptz,text)',
    'public.end_agent_unavailability(uuid,uuid,timestamptz)'
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
