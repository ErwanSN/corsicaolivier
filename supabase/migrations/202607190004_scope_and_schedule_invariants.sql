alter table public.sites
  add constraint sites_id_organization_unique unique (id, organization_id);

alter table public.agents
  add constraint agents_id_organization_unique unique (id, organization_id),
  add constraint agents_site_same_organization
    foreign key (primary_site_id, organization_id)
    references public.sites (id, organization_id) on delete restrict;

alter table public.agent_contract_versions
  add constraint agent_contracts_agent_same_organization
    foreign key (agent_id, organization_id)
    references public.agents (id, organization_id) on delete cascade;

alter table public.agent_groups
  add constraint agent_groups_id_organization_unique unique (id, organization_id),
  add constraint agent_groups_site_same_organization
    foreign key (site_id, organization_id)
    references public.sites (id, organization_id) on delete restrict;

alter table public.agent_group_memberships
  add constraint memberships_group_same_organization
    foreign key (group_id, organization_id)
    references public.agent_groups (id, organization_id) on delete cascade,
  add constraint memberships_agent_same_organization
    foreign key (agent_id, organization_id)
    references public.agents (id, organization_id) on delete cascade;

alter table public.hour_target_overrides
  add constraint hour_targets_site_same_organization
    foreign key (site_id, organization_id)
    references public.sites (id, organization_id) on delete restrict,
  add constraint hour_targets_agent_same_organization
    foreign key (agent_id, organization_id)
    references public.agents (id, organization_id) on delete cascade,
  add constraint hour_targets_group_same_organization
    foreign key (group_id, organization_id)
    references public.agent_groups (id, organization_id) on delete cascade;

alter table public.skills
  add constraint skills_id_organization_unique unique (id, organization_id);

alter table public.positions
  add constraint positions_id_organization_unique unique (id, organization_id),
  add constraint positions_site_same_organization
    foreign key (site_id, organization_id)
    references public.sites (id, organization_id) on delete restrict;

alter table public.position_skill_requirements
  add constraint position_requirements_position_same_organization
    foreign key (position_id, organization_id)
    references public.positions (id, organization_id) on delete cascade,
  add constraint position_requirements_skill_same_organization
    foreign key (skill_id, organization_id)
    references public.skills (id, organization_id) on delete cascade;

alter table public.agent_skills
  add constraint agent_skills_agent_same_organization
    foreign key (agent_id, organization_id)
    references public.agents (id, organization_id) on delete cascade,
  add constraint agent_skills_skill_same_organization
    foreign key (skill_id, organization_id)
    references public.skills (id, organization_id) on delete cascade;

alter table public.agent_position_preferences
  add constraint preferences_agent_same_organization
    foreign key (agent_id, organization_id)
    references public.agents (id, organization_id) on delete cascade,
  add constraint preferences_position_same_organization
    foreign key (position_id, organization_id)
    references public.positions (id, organization_id) on delete cascade;

alter table public.agent_position_restrictions
  add constraint restrictions_agent_same_organization
    foreign key (agent_id, organization_id)
    references public.agents (id, organization_id) on delete cascade,
  add constraint restrictions_position_same_organization
    foreign key (position_id, organization_id)
    references public.positions (id, organization_id) on delete cascade;

alter table public.agent_unavailability
  add constraint unavailability_site_same_organization
    foreign key (site_id, organization_id)
    references public.sites (id, organization_id) on delete restrict,
  add constraint unavailability_agent_same_organization
    foreign key (agent_id, organization_id)
    references public.agents (id, organization_id) on delete cascade;

alter table public.ports
  add constraint ports_id_organization_unique unique (id, organization_id);

alter table public.vessels
  add constraint vessels_id_organization_unique unique (id, organization_id);

alter table public.routes
  add constraint routes_id_organization_unique unique (id, organization_id),
  add constraint routes_site_same_organization
    foreign key (site_id, organization_id)
    references public.sites (id, organization_id) on delete restrict,
  add constraint routes_origin_same_organization
    foreign key (origin_port_id, organization_id)
    references public.ports (id, organization_id) on delete restrict,
  add constraint routes_destination_same_organization
    foreign key (destination_port_id, organization_id)
    references public.ports (id, organization_id) on delete restrict;

alter table public.port_calls
  add constraint port_calls_id_organization_unique unique (id, organization_id),
  add constraint port_calls_site_same_organization
    foreign key (site_id, organization_id)
    references public.sites (id, organization_id) on delete restrict,
  add constraint port_calls_vessel_same_organization
    foreign key (vessel_id, organization_id)
    references public.vessels (id, organization_id) on delete restrict,
  add constraint port_calls_route_same_organization
    foreign key (route_id, organization_id)
    references public.routes (id, organization_id) on delete restrict;

alter table public.port_call_revisions
  add constraint revisions_call_same_organization
    foreign key (port_call_id, organization_id)
    references public.port_calls (id, organization_id) on delete cascade,
  add constraint revisions_site_same_organization
    foreign key (site_id, organization_id)
    references public.sites (id, organization_id) on delete restrict;

alter table public.call_load_forecasts
  add constraint forecasts_call_same_organization
    foreign key (port_call_id, organization_id)
    references public.port_calls (id, organization_id) on delete cascade,
  add constraint forecasts_site_same_organization
    foreign key (site_id, organization_id)
    references public.sites (id, organization_id) on delete restrict;

alter table public.demand_profiles
  add constraint demand_profiles_id_organization_unique unique (id, organization_id),
  add constraint demand_profiles_site_same_organization
    foreign key (site_id, organization_id)
    references public.sites (id, organization_id) on delete restrict;

alter table public.demand_profile_lines
  add constraint demand_lines_profile_same_organization
    foreign key (demand_profile_id, organization_id)
    references public.demand_profiles (id, organization_id) on delete cascade,
  add constraint demand_lines_position_same_organization
    foreign key (position_id, organization_id)
    references public.positions (id, organization_id) on delete restrict,
  add constraint demand_lines_site_same_organization
    foreign key (site_id, organization_id)
    references public.sites (id, organization_id) on delete restrict;

alter table public.planning_periods
  add constraint planning_periods_id_organization_unique unique (id, organization_id),
  add constraint planning_periods_site_same_organization
    foreign key (site_id, organization_id)
    references public.sites (id, organization_id) on delete restrict;

alter table public.schedule_versions
  add constraint schedule_versions_id_organization_unique unique (id, organization_id),
  add constraint schedules_period_same_organization
    foreign key (planning_period_id, organization_id)
    references public.planning_periods (id, organization_id) on delete cascade,
  add constraint schedules_parent_same_organization
    foreign key (parent_version_id, organization_id)
    references public.schedule_versions (id, organization_id) on delete restrict,
  add constraint schedules_site_same_organization
    foreign key (site_id, organization_id)
    references public.sites (id, organization_id) on delete restrict;

alter table public.staffing_requirements
  add constraint requirements_period_same_organization
    foreign key (planning_period_id, organization_id)
    references public.planning_periods (id, organization_id) on delete cascade,
  add constraint requirements_call_same_organization
    foreign key (port_call_id, organization_id)
    references public.port_calls (id, organization_id) on delete cascade,
  add constraint requirements_position_same_organization
    foreign key (position_id, organization_id)
    references public.positions (id, organization_id) on delete restrict,
  add constraint requirements_site_same_organization
    foreign key (site_id, organization_id)
    references public.sites (id, organization_id) on delete restrict;

alter table public.planning_shifts
  add constraint planning_shifts_id_organization_unique unique (id, organization_id),
  add constraint shifts_schedule_same_organization
    foreign key (schedule_version_id, organization_id)
    references public.schedule_versions (id, organization_id) on delete cascade,
  add constraint shifts_agent_same_organization
    foreign key (agent_id, organization_id)
    references public.agents (id, organization_id) on delete restrict,
  add constraint shifts_site_same_organization
    foreign key (site_id, organization_id)
    references public.sites (id, organization_id) on delete restrict;

alter table public.shift_assignments
  add constraint assignments_shift_same_organization
    foreign key (planning_shift_id, organization_id)
    references public.planning_shifts (id, organization_id) on delete cascade,
  add constraint assignments_position_same_organization
    foreign key (position_id, organization_id)
    references public.positions (id, organization_id) on delete restrict,
  add constraint assignments_call_same_organization
    foreign key (port_call_id, organization_id)
    references public.port_calls (id, organization_id),
  add constraint assignments_site_same_organization
    foreign key (site_id, organization_id)
    references public.sites (id, organization_id) on delete restrict;

alter table public.time_ledger_entries
  add constraint ledger_agent_same_organization
    foreign key (agent_id, organization_id)
    references public.agents (id, organization_id) on delete restrict,
  add constraint ledger_shift_same_organization
    foreign key (planning_shift_id, organization_id)
    references public.planning_shifts (id, organization_id),
  add constraint ledger_site_same_organization
    foreign key (site_id, organization_id)
    references public.sites (id, organization_id) on delete restrict;

alter table public.disruption_events
  add constraint disruptions_id_organization_unique unique (id, organization_id),
  add constraint disruptions_call_same_organization
    foreign key (port_call_id, organization_id)
    references public.port_calls (id, organization_id) on delete cascade,
  add constraint disruptions_site_same_organization
    foreign key (site_id, organization_id)
    references public.sites (id, organization_id) on delete restrict;

alter table public.replanning_scenarios
  add constraint scenarios_id_organization_unique unique (id, organization_id),
  add constraint scenarios_disruption_same_organization
    foreign key (disruption_event_id, organization_id)
    references public.disruption_events (id, organization_id) on delete cascade,
  add constraint scenarios_base_schedule_same_organization
    foreign key (base_schedule_version_id, organization_id)
    references public.schedule_versions (id, organization_id) on delete restrict,
  add constraint scenarios_candidate_schedule_same_organization
    foreign key (candidate_schedule_version_id, organization_id)
    references public.schedule_versions (id, organization_id) on delete restrict,
  add constraint scenarios_site_same_organization
    foreign key (site_id, organization_id)
    references public.sites (id, organization_id) on delete restrict;

alter table public.replanning_impacts
  add constraint impacts_scenario_same_organization
    foreign key (scenario_id, organization_id)
    references public.replanning_scenarios (id, organization_id) on delete cascade,
  add constraint impacts_agent_same_organization
    foreign key (agent_id, organization_id)
    references public.agents (id, organization_id),
  add constraint impacts_shift_same_organization
    foreign key (planning_shift_id, organization_id)
    references public.planning_shifts (id, organization_id),
  add constraint impacts_site_same_organization
    foreign key (site_id, organization_id)
    references public.sites (id, organization_id) on delete restrict;

alter table public.agent_notifications
  add constraint notifications_agent_same_organization
    foreign key (agent_id, organization_id)
    references public.agents (id, organization_id) on delete cascade,
  add constraint notifications_scenario_same_organization
    foreign key (scenario_id, organization_id)
    references public.replanning_scenarios (id, organization_id),
  add constraint notifications_site_same_organization
    foreign key (site_id, organization_id)
    references public.sites (id, organization_id) on delete restrict;

create or replace function public.protect_schedule_version_state()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.organization_id <> old.organization_id
    or new.site_id <> old.site_id
    or new.planning_period_id <> old.planning_period_id
    or new.version_number <> old.version_number then
    raise exception 'Schedule identity and scope are immutable';
  end if;

  if old.status = 'archived' then
    raise exception 'Archived schedules are immutable';
  end if;

  if old.status = 'published' and new.status <> 'archived' then
    raise exception 'Published schedules can only be archived';
  end if;

  if new.status = 'published' and old.status <> 'published' and not public.has_role(
    new.organization_id,
    new.site_id,
    array['platform_admin', 'planning_admin', 'approver']::public.app_role[]
  ) then
    raise exception 'Only an approver can publish a schedule';
  end if;

  return new;
end;
$$;

create trigger schedule_versions_protect_state
before update on public.schedule_versions
for each row execute function public.protect_schedule_version_state();

create or replace function public.validate_shift_assignment_bounds()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent_shift public.planning_shifts;
begin
  select * into parent_shift
  from public.planning_shifts
  where id = new.planning_shift_id;

  if parent_shift.id is null then
    raise exception 'Planning shift not found';
  end if;

  if new.starts_at < parent_shift.starts_at or new.ends_at > parent_shift.ends_at then
    raise exception 'A position assignment must stay within its planning shift';
  end if;

  if new.site_id <> parent_shift.site_id then
    raise exception 'Assignment and shift must belong to the same site';
  end if;

  return new;
end;
$$;

create trigger shift_assignments_validate_bounds
before insert or update on public.shift_assignments
for each row execute function public.validate_shift_assignment_bounds();

revoke all on function public.protect_schedule_version_state() from public;
revoke all on function public.validate_shift_assignment_bounds() from public;
