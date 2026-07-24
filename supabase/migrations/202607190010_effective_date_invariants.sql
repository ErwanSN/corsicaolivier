alter table public.agent_contract_versions
  add constraint agent_contract_versions_no_overlap
  exclude using gist (
    agent_id with =,
    daterange(
      effective_from,
      coalesce(effective_until + 1, 'infinity'::date),
      '[)'
    ) with &&
  );

alter table public.agent_group_memberships
  add constraint agent_group_memberships_no_overlap
  exclude using gist (
    group_id with =,
    agent_id with =,
    daterange(
      effective_from,
      coalesce(effective_until + 1, 'infinity'::date),
      '[)'
    ) with &&
  );

alter table public.agent_skills
  add constraint agent_skills_no_overlap
  exclude using gist (
    agent_id with =,
    skill_id with =,
    daterange(
      valid_from,
      coalesce(valid_until + 1, 'infinity'::date),
      '[)'
    ) with &&
  );

alter table public.agent_position_preferences
  add constraint agent_position_preferences_no_overlap
  exclude using gist (
    agent_id with =,
    position_id with =,
    daterange(
      valid_from,
      coalesce(valid_until + 1, 'infinity'::date),
      '[)'
    ) with &&
  );

alter table public.agent_position_restrictions
  add constraint agent_position_restrictions_no_overlap
  exclude using gist (
    agent_id with =,
    position_id with =,
    daterange(
      valid_from,
      coalesce(valid_until + 1, 'infinity'::date),
      '[)'
    ) with &&
  );
