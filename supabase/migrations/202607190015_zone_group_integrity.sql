create or replace function public.enforce_group_membership_zone()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  group_zone_id uuid;
  agent_zone_id uuid;
begin
  select agent_group.site_id
  into group_zone_id
  from public.agent_groups agent_group
  where agent_group.id = new.group_id
    and agent_group.organization_id = new.organization_id;

  select agent.primary_site_id
  into agent_zone_id
  from public.agents agent
  where agent.id = new.agent_id
    and agent.organization_id = new.organization_id;

  if group_zone_id is null or agent_zone_id is null then
    raise exception 'Unknown group or agent in organization'
      using errcode = '23503';
  end if;

  if group_zone_id <> agent_zone_id then
    raise exception 'A group can only contain agents from its zone'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger memberships_same_zone
before insert or update of organization_id, group_id, agent_id
on public.agent_group_memberships
for each row execute function public.enforce_group_membership_zone();

create or replace function public.protect_active_group_zone_on_agent_move()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.primary_site_id is distinct from old.primary_site_id
    and exists (
      select 1
      from public.agent_group_memberships membership
      join public.agent_groups agent_group on agent_group.id = membership.group_id
      where membership.agent_id = new.id
        and membership.effective_from <= current_date
        and (membership.effective_until is null or membership.effective_until > current_date)
        and agent_group.site_id <> new.primary_site_id
    ) then
    raise exception 'End active group memberships before moving the agent to another zone'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger agents_protect_active_group_zone
before update of primary_site_id on public.agents
for each row execute function public.protect_active_group_zone_on_agent_move();
