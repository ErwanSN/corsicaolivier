drop trigger if exists memberships_same_zone on public.agent_group_memberships;
drop trigger if exists agents_protect_active_group_zone on public.agents;

drop function if exists public.enforce_group_membership_zone();
drop function if exists public.protect_active_group_zone_on_agent_move();

alter table public.agent_groups
  alter column site_id drop not null;

update public.agent_groups
set site_id = null
where site_id is not null;

alter table public.hour_target_overrides
  alter column site_id drop not null;

update public.hour_target_overrides
set site_id = null
where group_id is not null;

alter table public.hour_target_overrides
  add constraint hour_targets_agent_requires_zone
  check (agent_id is null or site_id is not null);
