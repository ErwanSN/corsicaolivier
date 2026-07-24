alter table public.agent_group_memberships
  add column is_primary boolean not null default true;

create unique index memberships_one_current_primary_group
  on public.agent_group_memberships (agent_id)
  where is_primary = true and effective_until is null;

create or replace function public.get_agent_hour_balance(
  target_agent_id uuid,
  target_week_start date,
  target_schedule_version_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_agent public.agents;
  target_site public.sites;
  target_contract public.agent_contract_versions;
  individual_target public.hour_target_overrides;
  group_target public.hour_target_overrides;
  selected_schedule_id uuid;
  weekly_target_minutes integer := 0;
  monthly_target_minutes integer;
  scheduled_week_minutes integer := 0;
  scheduled_month_minutes integer := 0;
  worked_month_minutes integer := 0;
  target_source text := 'none';
  month_start date;
  month_end date;
begin
  if extract(isodow from target_week_start) <> 1 then
    raise exception 'Week start must be a Monday';
  end if;

  select * into target_agent
  from public.agents
  where id = target_agent_id;

  if target_agent.id is null then
    raise exception 'Agent not found';
  end if;

  if target_agent.user_id is distinct from (select auth.uid()) and not public.has_role(
    target_agent.organization_id,
    target_agent.primary_site_id,
    array['platform_admin', 'planning_admin', 'planner', 'approver', 'supervisor', 'hr', 'auditor']::public.app_role[]
  ) then
    raise exception 'Insufficient permissions';
  end if;

  select * into target_site
  from public.sites
  where id = target_agent.primary_site_id;

  select * into target_contract
  from public.agent_contract_versions contract
  where contract.agent_id = target_agent.id
    and contract.effective_from <= target_week_start
    and (contract.effective_until is null or contract.effective_until >= target_week_start)
  order by contract.effective_from desc
  limit 1;

  weekly_target_minutes := coalesce(target_contract.weekly_target_minutes, 0);
  monthly_target_minutes := target_contract.monthly_target_minutes;
  if target_contract.id is not null then
    target_source := 'contract';
  end if;

  select * into group_target
  from public.hour_target_overrides target
  join public.agent_group_memberships membership on membership.group_id = target.group_id
  where membership.agent_id = target_agent.id
    and membership.is_primary = true
    and membership.effective_from <= target_week_start
    and (membership.effective_until is null or membership.effective_until >= target_week_start)
    and target.week_start = target_week_start
  order by membership.effective_from desc, target.created_at desc
  limit 1;

  if group_target.id is not null then
    weekly_target_minutes := group_target.target_minutes;
    target_source := 'group_override';
  end if;

  select * into individual_target
  from public.hour_target_overrides target
  where target.agent_id = target_agent.id
    and target.week_start = target_week_start
  order by target.created_at desc
  limit 1;

  if individual_target.id is not null then
    weekly_target_minutes := individual_target.target_minutes;
    target_source := 'agent_override';
  end if;

  selected_schedule_id := target_schedule_version_id;

  if selected_schedule_id is null then
    select schedule.id into selected_schedule_id
    from public.schedule_versions schedule
    join public.planning_periods period on period.id = schedule.planning_period_id
    where schedule.site_id = target_agent.primary_site_id
      and schedule.status = 'published'
      and target_week_start between period.starts_on and period.ends_on
    order by schedule.version_number desc
    limit 1;
  end if;

  month_start := date_trunc('month', target_week_start)::date;
  month_end := (date_trunc('month', target_week_start) + interval '1 month')::date;

  select coalesce(sum(
    floor(extract(epoch from (shift.ends_at - shift.starts_at)) / 60)::integer
    - shift.break_minutes
  ), 0)::integer into scheduled_week_minutes
  from public.planning_shifts shift
  where shift.agent_id = target_agent.id
    and shift.schedule_version_id = selected_schedule_id
    and (shift.starts_at at time zone target_site.timezone)::date >= target_week_start
    and (shift.starts_at at time zone target_site.timezone)::date < target_week_start + 7;

  select coalesce(sum(
    floor(extract(epoch from (shift.ends_at - shift.starts_at)) / 60)::integer
    - shift.break_minutes
  ), 0)::integer into scheduled_month_minutes
  from public.planning_shifts shift
  where shift.agent_id = target_agent.id
    and shift.schedule_version_id = selected_schedule_id
    and (shift.starts_at at time zone target_site.timezone)::date >= month_start
    and (shift.starts_at at time zone target_site.timezone)::date < month_end;

  select coalesce(sum(
    coalesce(ledger.worked_minutes, ledger.planned_minutes) + ledger.adjustment_minutes
  ), 0)::integer into worked_month_minutes
  from public.time_ledger_entries ledger
  where ledger.agent_id = target_agent.id
    and ledger.work_date >= month_start
    and ledger.work_date < month_end;

  return jsonb_build_object(
    'agentId', target_agent.id,
    'weekStart', target_week_start,
    'scheduleVersionId', selected_schedule_id,
    'weeklyTargetMinutes', weekly_target_minutes,
    'weeklyTargetSource', target_source,
    'scheduledWeekMinutes', scheduled_week_minutes,
    'weeklyVarianceMinutes', scheduled_week_minutes - weekly_target_minutes,
    'monthlyTargetMinutes', monthly_target_minutes,
    'scheduledMonthMinutes', scheduled_month_minutes,
    'workedMonthMinutes', worked_month_minutes,
    'monthlyVarianceMinutes', case
      when monthly_target_minutes is null then null
      else scheduled_month_minutes - monthly_target_minutes
    end
  );
end;
$$;

revoke all on function public.get_agent_hour_balance(uuid, date, uuid) from public;
grant execute on function public.get_agent_hour_balance(uuid, date, uuid) to authenticated;
