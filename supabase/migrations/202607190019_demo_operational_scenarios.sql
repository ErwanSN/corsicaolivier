-- Clearly labelled, non-production scenarios used to exercise the complete
-- planning workflow against situations observed in the supplied corpus.

-- Repair a drift detected on the deployed instance: the foundational unique
-- constraint exists in source migrations but its index was missing remotely.
create unique index if not exists positions_organization_code
  on public.positions (organization_id, code);

-- The original generic trigger accessed fields that do not exist on the
-- planning_shifts row type, which made every shift insertion fail at runtime.
create or replace function public.protect_schedule_content()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_version_id uuid;
  target_shift_id uuid;
  version_status public.schedule_status;
begin
  if tg_table_name = 'planning_shifts' then
    target_version_id := case
      when tg_op = 'DELETE' then old.schedule_version_id
      else new.schedule_version_id
    end;
  else
    target_shift_id := case
      when tg_op = 'DELETE' then old.planning_shift_id
      else new.planning_shift_id
    end;

    select shift.schedule_version_id into target_version_id
    from public.planning_shifts shift
    where shift.id = target_shift_id;
  end if;

  select schedule.status into version_status
  from public.schedule_versions schedule
  where schedule.id = target_version_id;

  if version_status in ('published', 'archived') then
    raise exception 'Published or archived schedules are immutable';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

revoke all on function public.protect_schedule_content() from public;

create unique index if not exists staffing_requirements_generated_identity
  on public.staffing_requirements (
    planning_period_id,
    port_call_id,
    demand_profile_line_id
  )
  where demand_profile_line_id is not null;

-- Recalculate generated requirements in place. Deleting and recreating them
-- would attempt to null published assignment foreign keys and break the
-- immutability guarantee.
create or replace function public.generate_staffing_requirements(
  target_planning_period_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_period public.planning_periods;
  generated_count integer := 0;
begin
  select * into target_period
  from public.planning_periods
  where id = target_planning_period_id
  for update;

  if target_period.id is null then
    raise exception 'Planning period not found';
  end if;

  if not public.has_role(
    target_period.organization_id,
    target_period.site_id,
    array['platform_admin', 'planning_admin', 'planner']::public.app_role[]
  ) then
    raise exception 'Insufficient permissions';
  end if;

  insert into public.staffing_requirements (
    organization_id,
    site_id,
    planning_period_id,
    port_call_id,
    demand_profile_line_id,
    position_id,
    starts_at,
    ends_at,
    required_agents,
    source_revision
  )
  select
    target_period.organization_id,
    target_period.site_id,
    target_period.id,
    port_call.id,
    profile_line.id,
    profile_line.position_id,
    anchor.anchor_at + make_interval(mins => profile_line.starts_offset_minutes),
    anchor.anchor_at
      + make_interval(mins => profile_line.starts_offset_minutes + profile_line.duration_minutes),
    greatest(
      1,
      least(
        coalesce(profile_line.maximum_agents, 100),
        greatest(
          profile_line.minimum_agents,
          profile_line.base_agents
            + case
                when profile_line.passengers_per_extra_agent is null then 0
                else ceil(
                  coalesce(load.passenger_count, 0)::numeric
                  / profile_line.passengers_per_extra_agent
                )::integer
              end
            + case
                when profile_line.vehicles_per_extra_agent is null then 0
                else ceil(
                  coalesce(load.vehicle_count, 0)::numeric
                  / profile_line.vehicles_per_extra_agent
                )::integer
              end
        )
      )
    ),
    concat_ws(':', port_call.source_revision, load.source_revision, profile.version)
  from public.port_calls port_call
  join public.demand_profiles profile on profile.id = port_call.demand_profile_id
  join public.demand_profile_lines profile_line
    on profile_line.demand_profile_id = profile.id
  cross join lateral (
    select case profile_line.anchor
      when 'arrival' then coalesce(
        port_call.estimated_arrival_at,
        port_call.scheduled_arrival_at
      )
      when 'departure' then coalesce(
        port_call.estimated_departure_at,
        port_call.scheduled_departure_at
      )
    end as anchor_at
  ) anchor
  left join lateral (
    select forecast.*
    from public.call_load_forecasts forecast
    where forecast.port_call_id = port_call.id
    order by forecast.received_at desc
    limit 1
  ) load on true
  where port_call.site_id = target_period.site_id
    and port_call.status <> 'cancelled'
    and profile.active = true
    and anchor.anchor_at is not null
    and (anchor.anchor_at at time zone target_period.timezone)::date
      between target_period.starts_on and target_period.ends_on
  on conflict (
    planning_period_id,
    port_call_id,
    demand_profile_line_id
  ) where demand_profile_line_id is not null
  do update set
    position_id = excluded.position_id,
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at,
    required_agents = excluded.required_agents,
    source_revision = excluded.source_revision,
    updated_at = now();

  get diagnostics generated_count = row_count;

  delete from public.staffing_requirements obsolete
  where obsolete.planning_period_id = target_period.id
    and obsolete.demand_profile_line_id is not null
    and not exists (
      select 1
      from public.port_calls port_call
      join public.demand_profiles profile
        on profile.id = port_call.demand_profile_id
      join public.demand_profile_lines profile_line
        on profile_line.demand_profile_id = profile.id
      where port_call.id = obsolete.port_call_id
        and profile_line.id = obsolete.demand_profile_line_id
        and port_call.status <> 'cancelled'
        and profile.active = true
    )
    and not exists (
      select 1
      from public.shift_assignments assignment
      where assignment.staffing_requirement_id = obsolete.id
    );

  insert into public.outbox_events (
    organization_id,
    site_id,
    topic,
    aggregate_type,
    aggregate_id,
    payload,
    idempotency_key
  ) values (
    target_period.organization_id,
    target_period.site_id,
    'planning.requirements.generated',
    'planning_period',
    target_period.id,
    jsonb_build_object(
      'planningPeriodId', target_period.id,
      'generatedCount', generated_count,
      'generatedAt', now()
    ),
    'requirements-' || target_period.id::text || '-'
      || extensions.gen_random_uuid()::text
  );

  return jsonb_build_object(
    'planningPeriodId', target_period.id,
    'generatedCount', generated_count
  );
end;
$$;

revoke all on function public.generate_staffing_requirements(uuid) from public;
grant execute on function public.generate_staffing_requirements(uuid) to authenticated;

do $$
#variable_conflict use_variable
declare
  organization_id constant uuid := '00000000-0000-4000-8000-000000000001';
  joliette_site_id constant uuid := '00000000-0000-4000-8000-000000000101';
  janet_site_id constant uuid := '00000000-0000-4000-8000-000000000102';
  actor_id uuid;
  group_id uuid;
  profile_id uuid;
  period_id uuid;
  schedule_id uuid;
  vizzavona_call_id uuid;
  jean_nicoli_call_id uuid;
  galeotta_call_id uuid;
  cancelled_call_id uuid;
begin
  -- Fail closed: demonstration data is never loaded by a normal migration
  -- run, including production. A disposable environment must opt in before
  -- applying this migration with SET app.load_demo_data = 'true'.
  if coalesce(current_setting('app.load_demo_data', true), '') <> 'true' then
    return;
  end if;

  select users.id into actor_id
  from auth.users users
  where lower(users.email) = 'demo.operator@example.invalid'
  order by users.created_at
  limit 1;

  -- Demo scenarios are optional: a clean environment has no identity account
  -- yet, and migrations must not fail because of non-production data.
  if actor_id is null then
    return;
  end if;

  insert into public.app_users (id, email, display_name, status)
  values (
    actor_id,
    'demo.operator@example.invalid',
    'Opérateur Démo',
    'active'
  )
  on conflict (id) do update
  set email = excluded.email,
      display_name = excluded.display_name,
      status = 'active',
      updated_at = now();

  if not exists (
    select 1 from public.user_role_assignments assignment
    where assignment.user_id = actor_id
      and assignment.organization_id = organization_id
      and assignment.site_id = joliette_site_id
      and assignment.role = 'planning_admin'
      and assignment.valid_until is null
  ) then
    insert into public.user_role_assignments (
      user_id,
      organization_id,
      site_id,
      role,
      valid_from,
      granted_by
    ) values (
      actor_id,
      organization_id,
      joliette_site_id,
      'planning_admin',
      '2026-01-01 00:00:00+01',
      actor_id
    );
  end if;

  if not exists (
    select 1 from public.user_role_assignments assignment
    where assignment.user_id = actor_id
      and assignment.organization_id = organization_id
      and assignment.site_id = joliette_site_id
      and assignment.role = 'approver'
      and assignment.valid_until is null
  ) then
    insert into public.user_role_assignments (
      user_id,
      organization_id,
      site_id,
      role,
      valid_from,
      granted_by
    ) values (
      actor_id,
      organization_id,
      joliette_site_id,
      'approver',
      '2026-01-01 00:00:00+01',
      actor_id
    );
  end if;

  perform set_config('request.jwt.claim.sub', actor_id::text, true);

  insert into public.positions (
    organization_id,
    site_id,
    code,
    name,
    description,
    color_token
  ) values
    (organization_id, joliette_site_id, 'CA-01-CHEF-NAVIRE', 'Chefs de navire', 'Centre Autos Joliette', 'lime'),
    (organization_id, joliette_site_id, 'CA-03-GUICHETS', 'Guichets', 'Centre Autos Joliette', 'lime'),
    (organization_id, joliette_site_id, 'CA-04-TOISES', 'Toises', 'Centre Autos Joliette', 'lime'),
    (organization_id, joliette_site_id, 'CA-05-CONTROLES', 'Contrôles', 'Centre Autos Joliette', 'lime'),
    (organization_id, joliette_site_id, 'FRET-02-PORTIQUE', 'Portique', 'Fret Joliette', 'lime'),
    (organization_id, janet_site_id, 'JANET-03-GUICHETS', 'Guichets', 'Centre Autos Janet', 'lime')
  on conflict on constraint positions_organization_id_code_key do update
  set site_id = excluded.site_id,
      name = excluded.name,
      description = excluded.description,
      color_token = excluded.color_token,
      active = true,
      updated_at = now();

  insert into public.skills (organization_id, code, name, description)
  values (
    organization_id,
    'DEMO-CHEF-ESCALE',
    '[DEMO] Coordination d’escale',
    'Habilitation fictive utilisée par les scénarios de démonstration.'
  )
  on conflict on constraint skills_organization_id_code_key do update
  set name = excluded.name,
      description = excluded.description,
      active = true,
      updated_at = now();

  insert into public.agents (
    organization_id,
    primary_site_id,
    employee_number,
    display_name,
    active,
    hired_on
  ) values
    (organization_id, joliette_site_id, 'DEMO-001', '[DEMO] Alice Martin', true, '2024-02-01'),
    (organization_id, joliette_site_id, 'DEMO-002', '[DEMO] Karim Benali', true, '2023-09-15'),
    (organization_id, joliette_site_id, 'DEMO-003', '[DEMO] Sarah Blanc', true, '2022-04-11'),
    (organization_id, joliette_site_id, 'DEMO-004', '[DEMO] Malik Morel', true, '2025-01-06'),
    (organization_id, joliette_site_id, 'DEMO-005', '[DEMO] Hugo Perez', true, '2021-07-19'),
    (organization_id, joliette_site_id, 'DEMO-006', '[DEMO] Léa Rossi', true, '2024-11-04'),
    (organization_id, janet_site_id, 'DEMO-007', '[DEMO] Inès Ferri', true, '2025-03-10')
  on conflict on constraint agents_organization_id_employee_number_key do update
  set primary_site_id = excluded.primary_site_id,
      display_name = excluded.display_name,
      active = true,
      hired_on = excluded.hired_on,
      left_on = null,
      updated_at = now();

  insert into public.agent_contract_versions (
    organization_id,
    agent_id,
    effective_from,
    weekly_target_minutes,
    monthly_target_minutes,
    full_time_equivalent,
    label
  )
  select
    organization_id,
    agent.id,
    '2026-01-01'::date,
    contract.weekly_minutes,
    contract.monthly_minutes,
    contract.fte,
    '[DEMO] Contrat fictif'
  from (
    values
      ('DEMO-001', 2100, 9100, 1.0000::numeric),
      ('DEMO-002', 2100, 9100, 1.0000::numeric),
      ('DEMO-003', 1680, 7280, 0.8000::numeric),
      ('DEMO-004', 1200, 5200, 0.5714::numeric),
      ('DEMO-005', 2100, 9100, 1.0000::numeric),
      ('DEMO-006', 1680, 7280, 0.8000::numeric),
      ('DEMO-007', 2100, 9100, 1.0000::numeric)
  ) contract(employee_number, weekly_minutes, monthly_minutes, fte)
  join public.agents agent
    on agent.organization_id = organization_id
    and agent.employee_number = contract.employee_number
  on conflict (agent_id, effective_from) do update
  set weekly_target_minutes = excluded.weekly_target_minutes,
      monthly_target_minutes = excluded.monthly_target_minutes,
      full_time_equivalent = excluded.full_time_equivalent,
      label = excluded.label,
      updated_at = now();

  insert into public.agent_groups (
    id,
    organization_id,
    site_id,
    code,
    name,
    description,
    active
  ) values (
    'd0000000-0000-4000-8000-000000000010',
    organization_id,
    null,
    'DEMO-EQUIPE-MIXTE',
    '[DEMO] Équipe mixte matin',
    'Groupe fictif indépendant des zones, avec des membres de Joliette et Janet.',
    true
  )
  on conflict do nothing
  returning id into group_id;

  if group_id is null then
    select existing_group.id into group_id
    from public.agent_groups existing_group
    where existing_group.organization_id = organization_id
      and existing_group.site_id is null
      and existing_group.code = 'DEMO-EQUIPE-MIXTE';
  end if;

  insert into public.agent_group_memberships (
    organization_id,
    group_id,
    agent_id,
    effective_from,
    is_primary
  )
  select
    organization_id,
    group_id,
    agent.id,
    '2026-01-01'::date,
    true
  from public.agents agent
  where agent.organization_id = organization_id
    and agent.employee_number in ('DEMO-001', 'DEMO-002', 'DEMO-007')
  on conflict on constraint agent_group_memberships_group_id_agent_id_effective_from_key do update
  set effective_until = null,
      is_primary = true;

  insert into public.hour_target_overrides (
    organization_id,
    site_id,
    group_id,
    week_start,
    target_minutes,
    reason,
    created_by
  ) values (
    organization_id,
    null,
    group_id,
    '2026-07-20',
    2100,
    '[DEMO] Objectif hebdomadaire du groupe',
    actor_id
  )
  on conflict do nothing;

  insert into public.hour_target_overrides (
    organization_id,
    site_id,
    agent_id,
    week_start,
    target_minutes,
    reason,
    created_by
  )
  select
    organization_id,
    joliette_site_id,
    agent.id,
    '2026-07-20',
    1680,
    '[DEMO] Dérogation individuelle à 28 h',
    actor_id
  from public.agents agent
  where agent.organization_id = organization_id
    and agent.employee_number = 'DEMO-003'
  on conflict do nothing;

  insert into public.position_skill_requirements (
    organization_id,
    position_id,
    skill_id,
    minimum_level,
    mandatory
  )
  select organization_id, position.id, skill.id, 3, true
  from public.positions position
  cross join public.skills skill
  where position.organization_id = organization_id
    and position.code = 'CA-01-CHEF-NAVIRE'
    and skill.organization_id = organization_id
    and skill.code = 'DEMO-CHEF-ESCALE'
  on conflict (position_id, skill_id) do update
  set minimum_level = excluded.minimum_level,
      mandatory = true;

  insert into public.agent_skills (
    organization_id,
    agent_id,
    skill_id,
    level,
    valid_from,
    verified_by
  )
  select organization_id, agent.id, skill.id, 4, '2026-01-01', actor_id
  from public.agents agent
  cross join public.skills skill
  where agent.organization_id = organization_id
    and agent.employee_number = 'DEMO-003'
    and skill.organization_id = organization_id
    and skill.code = 'DEMO-CHEF-ESCALE'
  on conflict (agent_id, skill_id, valid_from) do update
  set level = excluded.level,
      valid_until = null,
      verified_by = excluded.verified_by,
      updated_at = now();

  insert into public.agent_position_preferences (
    organization_id,
    agent_id,
    position_id,
    level,
    priority,
    note,
    valid_from,
    created_by
  )
  select
    organization_id,
    agent.id,
    position.id,
    preference.level::public.position_preference_level,
    preference.priority,
    preference.note,
    '2026-01-01',
    actor_id
  from (
    values
      ('DEMO-001', 'CA-03-GUICHETS', 'preferred', 1, '[DEMO] Préférence forte'),
      ('DEMO-002', 'CA-04-TOISES', 'avoid', 2, '[DEMO] Poste à éviter si possible')
  ) preference(employee_number, position_code, level, priority, note)
  join public.agents agent
    on agent.organization_id = organization_id
    and agent.employee_number = preference.employee_number
  join public.positions position
    on position.organization_id = organization_id
    and position.code = preference.position_code
  on conflict (agent_id, position_id, valid_from) do update
  set level = excluded.level,
      priority = excluded.priority,
      note = excluded.note,
      valid_until = null,
      updated_at = now();

  insert into public.agent_position_restrictions (
    organization_id,
    agent_id,
    position_id,
    reason,
    valid_from,
    created_by
  )
  select
    organization_id,
    agent.id,
    position.id,
    '[DEMO] Habilitation temporairement absente',
    '2026-01-01',
    actor_id
  from public.agents agent
  cross join public.positions position
  where agent.organization_id = organization_id
    and agent.employee_number = 'DEMO-006'
    and position.organization_id = organization_id
    and position.code = 'FRET-02-PORTIQUE'
  on conflict (agent_id, position_id, valid_from) do update
  set reason = excluded.reason,
      valid_until = null,
      updated_at = now();

  insert into public.agent_unavailability (
    id,
    organization_id,
    site_id,
    agent_id,
    kind,
    starts_at,
    ends_at,
    note,
    created_by
  )
  select
    'd0000000-0000-4000-8000-000000000020',
    organization_id,
    joliette_site_id,
    agent.id,
    'training',
    '2026-07-22 04:00:00+02',
    '2026-07-22 13:00:00+02',
    '[DEMO] Formation sécurité',
    actor_id
  from public.agents agent
  where agent.organization_id = organization_id
    and agent.employee_number = 'DEMO-005'
  on conflict (id) do update
  set starts_at = excluded.starts_at,
      ends_at = excluded.ends_at,
      note = excluded.note,
      updated_at = now();

  insert into public.demand_profiles (
    id,
    organization_id,
    site_id,
    code,
    name,
    version,
    active
  ) values (
    'd0000000-0000-4000-8000-000000000030',
    organization_id,
    joliette_site_id,
    'DEMO-CA-HAUTE-CHARGE',
    '[DEMO] Centre Autos haute charge',
    1,
    true
  )
  on conflict (site_id, code, version) do update
  set name = excluded.name,
      active = true,
      updated_at = now()
  returning id into profile_id;

  delete from public.demand_profile_lines line
  where line.demand_profile_id = profile_id;

  insert into public.demand_profile_lines (
    organization_id,
    site_id,
    demand_profile_id,
    position_id,
    anchor,
    starts_offset_minutes,
    duration_minutes,
    base_agents,
    passengers_per_extra_agent,
    vehicles_per_extra_agent,
    minimum_agents,
    maximum_agents
  )
  select
    organization_id,
    joliette_site_id,
    profile_id,
    position.id,
    rule.anchor::public.demand_anchor,
    rule.start_offset,
    rule.duration,
    rule.base_agents,
    rule.passenger_ratio,
    rule.vehicle_ratio,
    rule.minimum_agents,
    rule.maximum_agents
  from (
    values
      ('CA-01-CHEF-NAVIRE', 'arrival', -60, 180, 1, null::integer, null::integer, 1, 2),
      ('CA-03-GUICHETS', 'departure', -240, 360, 1, 250, null::integer, 1, 4),
      ('CA-04-TOISES', 'departure', -240, 300, 1, null::integer, 150, 1, 4),
      ('CA-05-CONTROLES', 'departure', -210, 240, 1, null::integer, 200, 1, 4),
      ('FRET-02-PORTIQUE', 'departure', -180, 240, 1, null::integer, null::integer, 1, 3)
  ) rule(
    position_code,
    anchor,
    start_offset,
    duration,
    base_agents,
    passenger_ratio,
    vehicle_ratio,
    minimum_agents,
    maximum_agents
  )
  join public.positions position
    on position.organization_id = organization_id
    and position.code = rule.position_code;

  insert into public.port_calls (
    id,
    organization_id,
    site_id,
    vessel_id,
    external_reference,
    status,
    scheduled_arrival_at,
    scheduled_departure_at,
    source,
    source_revision,
    demand_profile_id
  )
  select
    call.id,
    organization_id,
    joliette_site_id,
    vessel.id,
    call.external_reference,
    'scheduled',
    call.arrival_at,
    call.departure_at,
    'demo-corpus',
    call.source_revision,
    profile_id
  from (
    values
      ('d0000000-0000-4000-8000-000000000101'::uuid, 'PASCAL-PAOLI', 'DEMO-ROT-0720', '2026-07-20 06:30:00+02'::timestamptz, '2026-07-20 08:00:00+02'::timestamptz, 'demo-create-0720'),
      ('d0000000-0000-4000-8000-000000000102'::uuid, 'JEAN-NICOLI', 'DEMO-ROT-0721', '2026-07-21 18:00:00+02'::timestamptz, '2026-07-21 20:00:00+02'::timestamptz, 'demo-create-0721'),
      ('d0000000-0000-4000-8000-000000000103'::uuid, 'VIZZAVONA', 'DEMO-ROT-0722', '2026-07-22 07:00:00+02'::timestamptz, '2026-07-22 09:00:00+02'::timestamptz, 'demo-create-0722'),
      ('d0000000-0000-4000-8000-000000000104'::uuid, 'A-GALEOTTA', 'DEMO-ROT-0723', null::timestamptz, '2026-07-23 19:00:00+02'::timestamptz, 'demo-create-0723'),
      ('d0000000-0000-4000-8000-000000000105'::uuid, 'PAGLIA-ORBA', 'DEMO-ROT-0724', '2026-07-24 18:00:00+02'::timestamptz, '2026-07-24 20:00:00+02'::timestamptz, 'demo-create-0724'),
      ('d0000000-0000-4000-8000-000000000106'::uuid, 'PASCAL-PAOLI', 'DEMO-ROT-0725', '2026-07-25 07:00:00+02'::timestamptz, '2026-07-25 09:00:00+02'::timestamptz, 'demo-create-0725'),
      ('d0000000-0000-4000-8000-000000000107'::uuid, 'D-CASANOVA', 'DEMO-ROT-0726', '2026-07-26 09:00:00+02'::timestamptz, '2026-07-26 11:00:00+02'::timestamptz, 'demo-create-0726')
  ) call(id, vessel_code, external_reference, arrival_at, departure_at, source_revision)
  join public.vessels vessel
    on vessel.organization_id = organization_id
    and vessel.code = call.vessel_code
  on conflict (site_id, external_reference) do update
  set vessel_id = excluded.vessel_id,
      status = 'scheduled',
      scheduled_arrival_at = excluded.scheduled_arrival_at,
      scheduled_departure_at = excluded.scheduled_departure_at,
      estimated_arrival_at = null,
      estimated_departure_at = null,
      source = excluded.source,
      source_revision = excluded.source_revision,
      demand_profile_id = excluded.demand_profile_id,
      updated_at = now();

  select id into jean_nicoli_call_id from public.port_calls
  where site_id = joliette_site_id and external_reference = 'DEMO-ROT-0721';
  select id into vizzavona_call_id from public.port_calls
  where site_id = joliette_site_id and external_reference = 'DEMO-ROT-0722';
  select id into galeotta_call_id from public.port_calls
  where site_id = joliette_site_id and external_reference = 'DEMO-ROT-0723';
  select id into cancelled_call_id from public.port_calls
  where site_id = joliette_site_id and external_reference = 'DEMO-ROT-0725';

  insert into public.call_load_forecasts (
    organization_id,
    site_id,
    port_call_id,
    passenger_count,
    passenger_quota,
    vehicle_count,
    freight_unit_count,
    coach_count,
    source,
    source_revision,
    received_at
  )
  select
    organization_id,
    joliette_site_id,
    call.id,
    forecast.passengers,
    forecast.pedestrians,
    forecast.vehicles,
    forecast.freight_units,
    forecast.coaches,
    'demo-corpus',
    forecast.source_revision,
    '2026-07-19 09:00:00+02'::timestamptz
  from (
    values
      ('DEMO-ROT-0720', 570, 38, 461, 12, 2, 'demo-load-0720'),
      ('DEMO-ROT-0721', 314, 76, 122, 35, 1, 'demo-load-0721'),
      ('DEMO-ROT-0722', 507, 255, 123, 18, 3, 'demo-load-0722'),
      ('DEMO-ROT-0723', 290, 41, 142, 86, 0, 'demo-load-0723'),
      ('DEMO-ROT-0724', 489, 36, 405, 22, 4, 'demo-load-0724'),
      ('DEMO-ROT-0725', 345, 103, 139, 10, 1, 'demo-load-0725'),
      ('DEMO-ROT-0726', 273, 68, 114, 16, 0, 'demo-load-0726')
  ) forecast(
    external_reference,
    passengers,
    pedestrians,
    vehicles,
    freight_units,
    coaches,
    source_revision
  )
  join public.port_calls call
    on call.site_id = joliette_site_id
    and call.external_reference = forecast.external_reference
  on conflict (port_call_id, source, received_at) do update
  set passenger_count = excluded.passenger_count,
      passenger_quota = excluded.passenger_quota,
      vehicle_count = excluded.vehicle_count,
      freight_unit_count = excluded.freight_unit_count,
      coach_count = excluded.coach_count,
      source_revision = excluded.source_revision;

  insert into public.planning_periods (
    id,
    organization_id,
    site_id,
    name,
    starts_on,
    ends_on,
    timezone
  ) values (
    'd0000000-0000-4000-8000-000000000200',
    organization_id,
    joliette_site_id,
    '[DEMO] Semaine inspirée du corpus',
    '2026-07-20',
    '2026-07-26',
    'Europe/Paris'
  )
  on conflict (site_id, starts_on, ends_on) do update
  set name = excluded.name,
      timezone = excluded.timezone,
      updated_at = now()
  returning id into period_id;

  perform public.generate_staffing_requirements(period_id);

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
  ) values (
    'd0000000-0000-4000-8000-000000000201',
    organization_id,
    joliette_site_id,
    period_id,
    1,
    'draft',
    '[DEMO] Planning initial publié',
    'Jeu de données fictif pour audit',
    actor_id
  )
  on conflict (planning_period_id, version_number) do nothing
  returning id into schedule_id;

  if schedule_id is null then
    select version.id into schedule_id
    from public.schedule_versions version
    where version.planning_period_id = period_id
      and version.version_number = 1;

    if not exists (
      select 1 from public.schedule_versions version
      where version.id = schedule_id
        and version.label like '[DEMO]%'
    ) then
      raise exception 'Refusing to overwrite a non-demo schedule';
    end if;
  end if;

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
    note,
    created_by
  )
  select
    seed.id,
    organization_id,
    joliette_site_id,
    schedule_id,
    agent.id,
    seed.starts_at,
    seed.ends_at,
    0,
    'manual',
    seed.note,
    actor_id
  from (
    values
      ('d0000000-0000-4000-8000-000000000301'::uuid, 'DEMO-001', 'CA-03-GUICHETS', 'DEMO-ROT-0720', '2026-07-20 04:30:00+02'::timestamptz, '2026-07-20 11:30:00+02'::timestamptz, '[DEMO] Service du matin'),
      ('d0000000-0000-4000-8000-000000000302'::uuid, 'DEMO-001', 'CA-03-GUICHETS', 'DEMO-ROT-0721', '2026-07-21 13:00:00+02'::timestamptz, '2026-07-21 20:00:00+02'::timestamptz, '[DEMO] Escale avancée'),
      ('d0000000-0000-4000-8000-000000000303'::uuid, 'DEMO-001', 'CA-03-GUICHETS', 'DEMO-ROT-0722', '2026-07-22 07:00:00+02'::timestamptz, '2026-07-22 14:00:00+02'::timestamptz, '[DEMO] Escale retardée'),
      ('d0000000-0000-4000-8000-000000000304'::uuid, 'DEMO-001', 'CA-03-GUICHETS', 'DEMO-ROT-0723', '2026-07-23 13:00:00+02'::timestamptz, '2026-07-23 20:00:00+02'::timestamptz, '[DEMO] Départ sans arrivée'),
      ('d0000000-0000-4000-8000-000000000305'::uuid, 'DEMO-001', 'CA-03-GUICHETS', 'DEMO-ROT-0724', '2026-07-24 13:00:00+02'::timestamptz, '2026-07-24 20:00:00+02'::timestamptz, '[DEMO] Haute charge'),
      ('d0000000-0000-4000-8000-000000000311'::uuid, 'DEMO-002', 'CA-04-TOISES', 'DEMO-ROT-0720', '2026-07-20 04:30:00+02'::timestamptz, '2026-07-20 11:30:00+02'::timestamptz, '[DEMO] Poste à éviter accepté manuellement'),
      ('d0000000-0000-4000-8000-000000000312'::uuid, 'DEMO-002', 'CA-04-TOISES', 'DEMO-ROT-0721', '2026-07-21 13:00:00+02'::timestamptz, '2026-07-21 20:00:00+02'::timestamptz, '[DEMO] Escale avancée'),
      ('d0000000-0000-4000-8000-000000000313'::uuid, 'DEMO-002', 'CA-04-TOISES', 'DEMO-ROT-0722', '2026-07-22 07:00:00+02'::timestamptz, '2026-07-22 14:00:00+02'::timestamptz, '[DEMO] Escale retardée'),
      ('d0000000-0000-4000-8000-000000000314'::uuid, 'DEMO-002', 'CA-04-TOISES', 'DEMO-ROT-0723', '2026-07-23 13:00:00+02'::timestamptz, '2026-07-23 20:00:00+02'::timestamptz, '[DEMO] Départ retardé'),
      ('d0000000-0000-4000-8000-000000000315'::uuid, 'DEMO-002', 'CA-04-TOISES', 'DEMO-ROT-0724', '2026-07-24 13:00:00+02'::timestamptz, '2026-07-24 20:00:00+02'::timestamptz, '[DEMO] Haute charge'),
      ('d0000000-0000-4000-8000-000000000321'::uuid, 'DEMO-003', 'CA-01-CHEF-NAVIRE', 'DEMO-ROT-0720', '2026-07-20 05:30:00+02'::timestamptz, '2026-07-20 12:30:00+02'::timestamptz, '[DEMO] Cheffe habilitée'),
      ('d0000000-0000-4000-8000-000000000322'::uuid, 'DEMO-003', 'CA-01-CHEF-NAVIRE', 'DEMO-ROT-0722', '2026-07-22 06:00:00+02'::timestamptz, '2026-07-22 13:00:00+02'::timestamptz, '[DEMO] Cheffe habilitée'),
      ('d0000000-0000-4000-8000-000000000323'::uuid, 'DEMO-003', 'CA-01-CHEF-NAVIRE', 'DEMO-ROT-0724', '2026-07-24 17:00:00+02'::timestamptz, '2026-07-25 00:00:00+02'::timestamptz, '[DEMO] Shift traversant minuit'),
      ('d0000000-0000-4000-8000-000000000331'::uuid, 'DEMO-004', 'CA-05-CONTROLES', 'DEMO-ROT-0721', '2026-07-21 15:00:00+02'::timestamptz, '2026-07-21 20:00:00+02'::timestamptz, '[DEMO] Temps partiel'),
      ('d0000000-0000-4000-8000-000000000332'::uuid, 'DEMO-004', 'CA-05-CONTROLES', 'DEMO-ROT-0723', '2026-07-23 15:00:00+02'::timestamptz, '2026-07-23 20:00:00+02'::timestamptz, '[DEMO] Temps partiel'),
      ('d0000000-0000-4000-8000-000000000333'::uuid, 'DEMO-004', 'CA-05-CONTROLES', 'DEMO-ROT-0725', '2026-07-25 05:00:00+02'::timestamptz, '2026-07-25 10:00:00+02'::timestamptz, '[DEMO] Escale annulée'),
      ('d0000000-0000-4000-8000-000000000341'::uuid, 'DEMO-005', 'CA-05-CONTROLES', 'DEMO-ROT-0720', '2026-07-20 04:30:00+02'::timestamptz, '2026-07-20 11:30:00+02'::timestamptz, '[DEMO] Disponible'),
      ('d0000000-0000-4000-8000-000000000342'::uuid, 'DEMO-005', 'CA-05-CONTROLES', 'DEMO-ROT-0724', '2026-07-24 13:00:00+02'::timestamptz, '2026-07-24 20:00:00+02'::timestamptz, '[DEMO] Formation le mercredi'),
      ('d0000000-0000-4000-8000-000000000351'::uuid, 'DEMO-006', 'CA-03-GUICHETS', 'DEMO-ROT-0721', '2026-07-21 13:00:00+02'::timestamptz, '2026-07-21 20:00:00+02'::timestamptz, '[DEMO] Restriction portique respectée'),
      ('d0000000-0000-4000-8000-000000000352'::uuid, 'DEMO-006', 'CA-03-GUICHETS', 'DEMO-ROT-0724', '2026-07-24 13:00:00+02'::timestamptz, '2026-07-24 20:00:00+02'::timestamptz, '[DEMO] Restriction portique respectée')
  ) seed(id, employee_number, position_code, call_reference, starts_at, ends_at, note)
  join public.agents agent
    on agent.organization_id = organization_id
    and agent.employee_number = seed.employee_number
  on conflict (id) do nothing;

  insert into public.shift_assignments (
    organization_id,
    site_id,
    planning_shift_id,
    position_id,
    staffing_requirement_id,
    port_call_id,
    starts_at,
    ends_at
  )
  select
    organization_id,
    joliette_site_id,
    seed.id,
    position.id,
    requirement.id,
    call.id,
    seed.starts_at,
    seed.ends_at
  from (
    values
      ('d0000000-0000-4000-8000-000000000301'::uuid, 'CA-03-GUICHETS', 'DEMO-ROT-0720', '2026-07-20 04:30:00+02'::timestamptz, '2026-07-20 11:30:00+02'::timestamptz),
      ('d0000000-0000-4000-8000-000000000302'::uuid, 'CA-03-GUICHETS', 'DEMO-ROT-0721', '2026-07-21 13:00:00+02'::timestamptz, '2026-07-21 20:00:00+02'::timestamptz),
      ('d0000000-0000-4000-8000-000000000303'::uuid, 'CA-03-GUICHETS', 'DEMO-ROT-0722', '2026-07-22 07:00:00+02'::timestamptz, '2026-07-22 14:00:00+02'::timestamptz),
      ('d0000000-0000-4000-8000-000000000304'::uuid, 'CA-03-GUICHETS', 'DEMO-ROT-0723', '2026-07-23 13:00:00+02'::timestamptz, '2026-07-23 20:00:00+02'::timestamptz),
      ('d0000000-0000-4000-8000-000000000305'::uuid, 'CA-03-GUICHETS', 'DEMO-ROT-0724', '2026-07-24 13:00:00+02'::timestamptz, '2026-07-24 20:00:00+02'::timestamptz),
      ('d0000000-0000-4000-8000-000000000311'::uuid, 'CA-04-TOISES', 'DEMO-ROT-0720', '2026-07-20 04:30:00+02'::timestamptz, '2026-07-20 11:30:00+02'::timestamptz),
      ('d0000000-0000-4000-8000-000000000312'::uuid, 'CA-04-TOISES', 'DEMO-ROT-0721', '2026-07-21 13:00:00+02'::timestamptz, '2026-07-21 20:00:00+02'::timestamptz),
      ('d0000000-0000-4000-8000-000000000313'::uuid, 'CA-04-TOISES', 'DEMO-ROT-0722', '2026-07-22 07:00:00+02'::timestamptz, '2026-07-22 14:00:00+02'::timestamptz),
      ('d0000000-0000-4000-8000-000000000314'::uuid, 'CA-04-TOISES', 'DEMO-ROT-0723', '2026-07-23 13:00:00+02'::timestamptz, '2026-07-23 20:00:00+02'::timestamptz),
      ('d0000000-0000-4000-8000-000000000315'::uuid, 'CA-04-TOISES', 'DEMO-ROT-0724', '2026-07-24 13:00:00+02'::timestamptz, '2026-07-24 20:00:00+02'::timestamptz),
      ('d0000000-0000-4000-8000-000000000321'::uuid, 'CA-01-CHEF-NAVIRE', 'DEMO-ROT-0720', '2026-07-20 05:30:00+02'::timestamptz, '2026-07-20 12:30:00+02'::timestamptz),
      ('d0000000-0000-4000-8000-000000000322'::uuid, 'CA-01-CHEF-NAVIRE', 'DEMO-ROT-0722', '2026-07-22 06:00:00+02'::timestamptz, '2026-07-22 13:00:00+02'::timestamptz),
      ('d0000000-0000-4000-8000-000000000323'::uuid, 'CA-01-CHEF-NAVIRE', 'DEMO-ROT-0724', '2026-07-24 17:00:00+02'::timestamptz, '2026-07-25 00:00:00+02'::timestamptz),
      ('d0000000-0000-4000-8000-000000000331'::uuid, 'CA-05-CONTROLES', 'DEMO-ROT-0721', '2026-07-21 15:00:00+02'::timestamptz, '2026-07-21 20:00:00+02'::timestamptz),
      ('d0000000-0000-4000-8000-000000000332'::uuid, 'CA-05-CONTROLES', 'DEMO-ROT-0723', '2026-07-23 15:00:00+02'::timestamptz, '2026-07-23 20:00:00+02'::timestamptz),
      ('d0000000-0000-4000-8000-000000000333'::uuid, 'CA-05-CONTROLES', 'DEMO-ROT-0725', '2026-07-25 05:00:00+02'::timestamptz, '2026-07-25 10:00:00+02'::timestamptz),
      ('d0000000-0000-4000-8000-000000000341'::uuid, 'CA-05-CONTROLES', 'DEMO-ROT-0720', '2026-07-20 04:30:00+02'::timestamptz, '2026-07-20 11:30:00+02'::timestamptz),
      ('d0000000-0000-4000-8000-000000000342'::uuid, 'CA-05-CONTROLES', 'DEMO-ROT-0724', '2026-07-24 13:00:00+02'::timestamptz, '2026-07-24 20:00:00+02'::timestamptz),
      ('d0000000-0000-4000-8000-000000000351'::uuid, 'CA-03-GUICHETS', 'DEMO-ROT-0721', '2026-07-21 13:00:00+02'::timestamptz, '2026-07-21 20:00:00+02'::timestamptz),
      ('d0000000-0000-4000-8000-000000000352'::uuid, 'CA-03-GUICHETS', 'DEMO-ROT-0724', '2026-07-24 13:00:00+02'::timestamptz, '2026-07-24 20:00:00+02'::timestamptz)
  ) seed(id, position_code, call_reference, starts_at, ends_at)
  join public.positions position
    on position.organization_id = organization_id
    and position.code = seed.position_code
  join public.port_calls call
    on call.site_id = joliette_site_id
    and call.external_reference = seed.call_reference
  left join lateral (
    select staffing.id
    from public.staffing_requirements staffing
    where staffing.planning_period_id = period_id
      and staffing.port_call_id = call.id
      and staffing.position_id = position.id
    order by staffing.starts_at
    limit 1
  ) requirement on true
  where exists (
    select 1 from public.planning_shifts shift where shift.id = seed.id
  );

  perform public.publish_schedule_version(
    schedule_id,
    '[DEMO] Publication du planning fictif pour audit'
  );

  perform public.update_port_call_timing(
    jean_nicoli_call_id,
    '2026-07-21 17:15:00+02',
    '2026-07-21 19:15:00+02',
    'advanced',
    'demo-maritime-feed',
    'demo-update-advance-0721'
  );

  perform public.update_port_call_timing(
    vizzavona_call_id,
    '2026-07-22 08:30:00+02',
    '2026-07-22 10:30:00+02',
    'delayed',
    'demo-maritime-feed',
    'demo-update-delay-0722'
  );

  perform public.update_port_call_timing(
    galeotta_call_id,
    null,
    '2026-07-23 20:15:00+02',
    'delayed',
    'demo-maritime-feed',
    'demo-update-departure-only-0723'
  );

  perform public.update_port_call_timing(
    cancelled_call_id,
    '2026-07-25 07:00:00+02',
    '2026-07-25 09:00:00+02',
    'cancelled',
    'demo-maritime-feed',
    'demo-update-cancel-0725'
  );
end;
$$;
