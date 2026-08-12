-- Candidate recommendations are deliberately read-only. They reuse the
-- authoritative planning-rule assertion and only rank agents that the shift
-- command could accept for the complete multi-position service.

create or replace function public.planning_agent_satisfies_fundamental_rules(
  target_schedule_version_id uuid,
  target_agent_id uuid,
  candidate_starts_at timestamptz,
  candidate_ends_at timestamptz,
  excluded_shift_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  violation_state text;
begin
  perform public.assert_agent_planning_rules(
    target_schedule_version_id,
    target_agent_id,
    candidate_starts_at,
    candidate_ends_at,
    excluded_shift_id
  );

  return true;
exception
  when others then
    get stacked diagnostics violation_state = returned_sqlstate;

    -- P20xx is the application's stable family of planning-rule failures.
    -- Unexpected database failures must remain visible instead of silently
    -- turning every agent into an ineligible candidate.
    if violation_state like 'P20%' then
      return false;
    end if;

    raise;
end;
$$;

revoke all on function public.planning_agent_satisfies_fundamental_rules(
  uuid,
  uuid,
  timestamptz,
  timestamptz,
  uuid
) from public, anon, authenticated;

create or replace function public.get_planning_agent_candidates(
  target_schedule_version_id uuid,
  shift_starts_at timestamptz,
  shift_ends_at timestamptz,
  shift_segments jsonb,
  shift_breaks jsonb default '[]'::jsonb,
  excluded_shift_id uuid default null,
  search_query text default null,
  result_limit integer default 20,
  result_offset integer default 0
)
returns table (
  agent_id uuid,
  employee_number text,
  display_name text,
  recommendation_rank bigint,
  preference_level text,
  weekly_target_minutes integer,
  scheduled_week_minutes integer,
  projected_week_minutes integer,
  weekly_deficit_minutes integer,
  recent_load_minutes integer,
  explanation text,
  total_count bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_schedule public.schedule_versions;
  target_period public.planning_periods;
  normalized_query text;
  target_week_start date;
  week_start_at timestamptz;
  week_end_at timestamptz;
  candidate_paid_minutes integer;
  excluded_agent_id uuid;
  excluded_week_minutes integer := 0;
  invalid_timeline boolean;
begin
  if not public.is_current_app_user_active() then
    raise exception using
      errcode = 'P2080',
      message = 'Un compte actif est requis.';
  end if;

  select schedule.* into target_schedule
  from public.schedule_versions schedule
  where schedule.id = target_schedule_version_id;

  if target_schedule.id is null then
    raise exception using
      errcode = 'P2081',
      message = 'Planning introuvable.';
  end if;

  if not public.has_role(
    target_schedule.organization_id,
    target_schedule.site_id,
    array[
      'platform_admin',
      'planning_admin',
      'planner'
    ]::public.app_role[]
  ) then
    raise exception using
      errcode = 'P2082',
      message = 'Autorisation insuffisante pour rechercher des candidats.';
  end if;

  if target_schedule.status <> 'draft'
    or target_schedule.superseded_at is not null then
    raise exception using
      errcode = 'P2083',
      message = 'Les recommandations sont réservées au brouillon courant.';
  end if;

  select period.* into target_period
  from public.planning_periods period
  where period.id = target_schedule.planning_period_id;

  if shift_starts_at is null
    or shift_ends_at is null
    or shift_ends_at <= shift_starts_at
    or not public.shift_is_within_planning_period(
      target_period.id,
      shift_starts_at,
      shift_ends_at
    ) then
    raise exception using
      errcode = 'P2084',
      message = 'Le service doit être positif et rester dans cette période.';
  end if;

  if result_limit not between 1 and 50
    or result_offset not between 0 and 500 then
    raise exception using
      errcode = 'P2085',
      message = 'La pagination demandée dépasse les limites autorisées.';
  end if;

  normalized_query := nullif(lower(btrim(search_query)), '');
  if normalized_query is not null
    and char_length(normalized_query) not between 2 and 80 then
    raise exception using
      errcode = 'P2085',
      message = 'La recherche doit contenir entre 2 et 80 caractères.';
  end if;

  if coalesce(jsonb_typeof(shift_segments), 'null') <> 'array'
    or jsonb_array_length(shift_segments) not between 1 and 100
    or exists (
      select 1
      from jsonb_array_elements(shift_segments) item
      where jsonb_typeof(item) <> 'object'
        or nullif(item ->> 'positionId', '') is null
        or nullif(item ->> 'startsAt', '') is null
        or nullif(item ->> 'endsAt', '') is null
    ) then
    raise exception using
      errcode = 'P2084',
      message = 'Entre 1 et 100 segments de poste valides sont requis.';
  end if;

  if coalesce(jsonb_typeof(shift_breaks), 'null') <> 'array'
    or jsonb_array_length(shift_breaks) > 20
    or exists (
      select 1
      from jsonb_array_elements(shift_breaks) item
      where jsonb_typeof(item) <> 'object'
        or nullif(item ->> 'startsAt', '') is null
        or nullif(item ->> 'endsAt', '') is null
    ) then
    raise exception using
      errcode = 'P2084',
      message = 'Les pauses doivent former un tableau de 20 intervalles au maximum.';
  end if;

  with parsed_segments as (
    select
      item.ordinality,
      (item.value ->> 'positionId')::uuid as position_id,
      (item.value ->> 'startsAt')::timestamptz as starts_at,
      (item.value ->> 'endsAt')::timestamptz as ends_at,
      lag((item.value ->> 'endsAt')::timestamptz) over (
        order by
          (item.value ->> 'startsAt')::timestamptz,
          (item.value ->> 'endsAt')::timestamptz,
          item.ordinality
      ) as previous_ends_at,
      row_number() over (
        order by
          (item.value ->> 'startsAt')::timestamptz,
          (item.value ->> 'endsAt')::timestamptz,
          item.ordinality
      ) as segment_number,
      count(*) over () as segment_count
    from jsonb_array_elements(shift_segments)
      with ordinality as item(value, ordinality)
  )
  select exists (
    select 1
    from parsed_segments segment
    where segment.ends_at <= segment.starts_at
      or segment.starts_at < shift_starts_at
      or segment.ends_at > shift_ends_at
      or (segment.segment_number = 1
        and segment.starts_at <> shift_starts_at)
      or (segment.previous_ends_at is not null
        and segment.starts_at <> segment.previous_ends_at)
      or (segment.segment_number = segment.segment_count
        and segment.ends_at <> shift_ends_at)
  ) into invalid_timeline;

  if invalid_timeline then
    raise exception using
      errcode = 'P2084',
      message = 'Les segments doivent couvrir le service sans vide ni chevauchement.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(shift_segments) item
    left join public.positions position
      on position.id = (item ->> 'positionId')::uuid
      and position.organization_id = target_schedule.organization_id
      and (position.site_id is null
        or position.site_id = target_schedule.site_id)
      and position.active
    where position.id is null
  ) then
    raise exception using
      errcode = 'P2084',
      message = 'Un segment référence un poste inactif ou hors périmètre.';
  end if;

  with parsed_breaks as (
    select
      item.ordinality,
      (item.value ->> 'startsAt')::timestamptz as starts_at,
      (item.value ->> 'endsAt')::timestamptz as ends_at,
      lag((item.value ->> 'endsAt')::timestamptz) over (
        order by
          (item.value ->> 'startsAt')::timestamptz,
          (item.value ->> 'endsAt')::timestamptz,
          item.ordinality
      ) as previous_ends_at
    from jsonb_array_elements(shift_breaks)
      with ordinality as item(value, ordinality)
  )
  select exists (
    select 1
    from parsed_breaks pause
    where pause.ends_at <= pause.starts_at
      or pause.starts_at < shift_starts_at
      or pause.ends_at > shift_ends_at
      or pause.previous_ends_at > pause.starts_at
      or mod(
        extract(epoch from (pause.ends_at - pause.starts_at))::numeric,
        60
      ) <> 0
  ) into invalid_timeline;

  if invalid_timeline then
    raise exception using
      errcode = 'P2084',
      message = 'Les pauses doivent être entières, bornées et sans chevauchement.';
  end if;

  select greatest(
    0,
    floor(extract(epoch from (shift_ends_at - shift_starts_at)) / 60)::integer
      - coalesce(sum(
        extract(epoch from (
          (item.value ->> 'endsAt')::timestamptz
            - (item.value ->> 'startsAt')::timestamptz
        )) / 60
      ), 0)::integer
  )
  into candidate_paid_minutes
  from jsonb_array_elements(shift_breaks) item;

  if candidate_paid_minutes <= 0 then
    raise exception using
      errcode = 'P2084',
      message = 'Les pauses ne peuvent pas couvrir tout le service.';
  end if;

  if excluded_shift_id is not null then
    select shift.agent_id
    into excluded_agent_id
    from public.planning_shifts shift
    where shift.id = excluded_shift_id
      and shift.schedule_version_id = target_schedule.id;

    if excluded_agent_id is null then
      raise exception using
        errcode = 'P2084',
        message = 'Le service exclu ne fait pas partie de ce planning.';
    end if;
  end if;

  target_week_start :=
    (shift_starts_at at time zone target_period.timezone)::date
      - (extract(isodow from (
        shift_starts_at at time zone target_period.timezone
      ))::integer - 1);
  week_start_at := target_week_start::timestamp
    at time zone target_period.timezone;
  week_end_at := (target_week_start + 7)::timestamp
    at time zone target_period.timezone;

  if excluded_shift_id is not null then
    select coalesce(round(
      (
        extract(epoch from (
          least(shift.ends_at, week_end_at)
            - greatest(shift.starts_at, week_start_at)
        )) / 60
      ) * (
        greatest(
          0,
          extract(epoch from (shift.ends_at - shift.starts_at)) / 60
            - shift.break_minutes
        ) / nullif(
          extract(epoch from (shift.ends_at - shift.starts_at)) / 60,
          0
        )
      )
    ), 0)::integer
    into excluded_week_minutes
    from public.planning_shifts shift
    where shift.id = excluded_shift_id
      and shift.starts_at < week_end_at
      and shift.ends_at > week_start_at;
  end if;

  return query
  with parsed_segments as materialized (
    select
      (item.value ->> 'positionId')::uuid as position_id,
      (item.value ->> 'startsAt')::timestamptz as starts_at,
      (item.value ->> 'endsAt')::timestamptz as ends_at,
      greatest(
        1,
        floor(extract(epoch from (
          (item.value ->> 'endsAt')::timestamptz
            - (item.value ->> 'startsAt')::timestamptz
        )) / 60)::integer
      ) as duration_minutes
    from jsonb_array_elements(shift_segments) item
  ),
  base_agents as materialized (
    select agent.*
    from public.agents agent
    where agent.organization_id = target_schedule.organization_id
      and agent.primary_site_id = target_schedule.site_id
      and agent.active
      and (normalized_query is null
        or position(normalized_query in lower(agent.display_name)) > 0
        or position(normalized_query in lower(agent.employee_number)) > 0)
      and (agent.hired_on is null
        or agent.hired_on <= (
          shift_starts_at at time zone target_period.timezone
        )::date)
      and (agent.left_on is null
        or agent.left_on >= (
          (shift_ends_at - interval '1 microsecond')
            at time zone target_period.timezone
        )::date)
      and exists (
        select 1
        from public.agent_contract_versions contract
        where contract.agent_id = agent.id
          and contract.organization_id = target_schedule.organization_id
          and contract.effective_from <= (
            shift_starts_at at time zone target_period.timezone
          )::date
          and (contract.effective_until is null
            or contract.effective_until >= (
              (shift_ends_at - interval '1 microsecond')
                at time zone target_period.timezone
            )::date)
      )
      and not exists (
        select 1
        from public.agent_unavailability unavailable
        where unavailable.agent_id = agent.id
          and unavailable.organization_id = target_schedule.organization_id
          and tstzrange(unavailable.starts_at, unavailable.ends_at, '[)')
            && tstzrange(shift_starts_at, shift_ends_at, '[)')
      )
      and not exists (
        select 1
        from parsed_segments segment
        join public.agent_position_restrictions restriction
          on restriction.agent_id = agent.id
          and restriction.position_id = segment.position_id
          and restriction.organization_id = target_schedule.organization_id
          and restriction.valid_from <= (
            (segment.ends_at - interval '1 microsecond')
              at time zone target_period.timezone
          )::date
          and (restriction.valid_until is null
            or restriction.valid_until >= (
              segment.starts_at at time zone target_period.timezone
            )::date)
      )
      and not exists (
        select 1
        from parsed_segments segment
        join public.position_skill_requirements requirement
          on requirement.position_id = segment.position_id
          and requirement.organization_id = target_schedule.organization_id
          and requirement.mandatory
        where not exists (
          select 1
          from public.agent_skills agent_skill
          where agent_skill.agent_id = agent.id
            and agent_skill.skill_id = requirement.skill_id
            and agent_skill.organization_id = target_schedule.organization_id
            and agent_skill.level >= requirement.minimum_level
            and agent_skill.valid_from <= (
              segment.starts_at at time zone target_period.timezone
            )::date
            and (agent_skill.valid_until is null
              or agent_skill.valid_until >= (
                (segment.ends_at - interval '1 microsecond')
                  at time zone target_period.timezone
              )::date)
        )
      )
  ),
  eligible_agents as materialized (
    select agent.*
    from base_agents agent
    where public.planning_agent_satisfies_fundamental_rules(
      target_schedule.id,
      agent.id,
      shift_starts_at,
      shift_ends_at,
      excluded_shift_id
    )
  ),
  candidate_metrics as (
    select
      agent.id as agent_id,
      agent.employee_number,
      agent.display_name,
      coalesce(preference.score, 0)::bigint as preference_score,
      coalesce(
        (balance.value ->> 'weeklyTargetMinutes')::integer,
        0
      ) as weekly_target_minutes,
      greatest(
        0,
        coalesce(
          (balance.value ->> 'scheduledWeekMinutes')::integer,
          0
        ) - case
          when agent.id = excluded_agent_id then excluded_week_minutes
          else 0
        end
      )::integer as scheduled_week_minutes,
      coalesce(recent.minutes, 0)::integer as recent_load_minutes
    from eligible_agents agent
    cross join lateral (
      select public.get_agent_hour_balance(
        agent.id,
        target_week_start,
        target_schedule.id
      ) as value
    ) balance
    left join lateral (
      select sum(
        segment.duration_minutes::bigint * case preference.level
          when 'preferred'::public.position_preference_level
            then 6 - preference.priority
          when 'avoid'::public.position_preference_level
            then -(6 - preference.priority)
          else 0
        end
      ) as score
      from parsed_segments segment
      join public.agent_position_preferences preference
        on preference.agent_id = agent.id
        and preference.position_id = segment.position_id
        and preference.organization_id = target_schedule.organization_id
        and preference.valid_from <= (
          segment.starts_at at time zone target_period.timezone
        )::date
        and (preference.valid_until is null
          or preference.valid_until >= (
            (segment.ends_at - interval '1 microsecond')
              at time zone target_period.timezone
          )::date)
    ) preference on true
    left join lateral (
      select coalesce(sum(
        greatest(
          0,
          floor(extract(epoch from (
            previous_shift.ends_at - previous_shift.starts_at
          )) / 60)::integer - previous_shift.break_minutes
        )
      ), 0)::integer as minutes
      from public.planning_shifts previous_shift
      join public.schedule_versions previous_version
        on previous_version.id = previous_shift.schedule_version_id
      where previous_shift.agent_id = agent.id
        and previous_shift.id is distinct from excluded_shift_id
        and previous_version.organization_id = target_schedule.organization_id
        and previous_version.site_id = target_schedule.site_id
        and (previous_version.status = 'published'
          or previous_version.id = target_schedule.id)
        and (previous_shift.starts_at at time zone target_period.timezone)::date
          >= (shift_starts_at at time zone target_period.timezone)::date - 28
        and (previous_shift.starts_at at time zone target_period.timezone)::date
          < (shift_starts_at at time zone target_period.timezone)::date
    ) recent on true
  ),
  ranked as (
    select
      metric.*,
      row_number() over (
        order by
          metric.preference_score desc,
          (metric.weekly_target_minutes - metric.scheduled_week_minutes) desc,
          metric.recent_load_minutes asc,
          lower(metric.display_name),
          metric.employee_number,
          metric.agent_id
      ) as recommendation_rank,
      count(*) over () as total_count
    from candidate_metrics metric
  )
  select
    ranked.agent_id,
    ranked.employee_number,
    ranked.display_name,
    ranked.recommendation_rank,
    case
      when ranked.preference_score > 0 then 'preferred'
      when ranked.preference_score < 0 then 'avoid'
      else 'neutral'
    end as preference_level,
    ranked.weekly_target_minutes,
    ranked.scheduled_week_minutes,
    ranked.scheduled_week_minutes + candidate_paid_minutes
      as projected_week_minutes,
    ranked.weekly_target_minutes - ranked.scheduled_week_minutes
      as weekly_deficit_minutes,
    ranked.recent_load_minutes,
    concat_ws(
      ' · ',
      case
        when ranked.preference_score > 0 then 'Poste apprécié'
        when ranked.preference_score < 0 then 'Poste à éviter'
      end,
      case
        when ranked.weekly_target_minutes - ranked.scheduled_week_minutes > 0
          then replace(
            round((
              ranked.weekly_target_minutes - ranked.scheduled_week_minutes
            ) / 60.0, 1)::text,
            '.',
            ','
          ) || ' h sous l’objectif'
        when ranked.preference_score = 0
          then replace(
            round(ranked.recent_load_minutes / 60.0, 1)::text,
            '.',
            ','
          ) || ' h sur les 28 derniers jours'
        else null
      end
    ) as explanation,
    ranked.total_count
  from ranked
  where ranked.recommendation_rank > result_offset
    and ranked.recommendation_rank <= result_offset + result_limit
  order by ranked.recommendation_rank;
end;
$$;

revoke all on function public.get_planning_agent_candidates(
  uuid,
  timestamptz,
  timestamptz,
  jsonb,
  jsonb,
  uuid,
  text,
  integer,
  integer
) from public, anon, authenticated;

grant execute on function public.get_planning_agent_candidates(
  uuid,
  timestamptz,
  timestamptz,
  jsonb,
  jsonb,
  uuid,
  text,
  integer,
  integer
) to authenticated;

comment on function public.get_planning_agent_candidates(
  uuid,
  timestamptz,
  timestamptz,
  jsonb,
  jsonb,
  uuid,
  text,
  integer,
  integer
) is
  'Read-only, bounded decision aid: excludes every hard ineligibility before deterministic preference, target-deficit and recent-load ranking.';
