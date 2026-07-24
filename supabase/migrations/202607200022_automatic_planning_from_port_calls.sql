create or replace function public.ensure_planning_workspace_for_port_call(
  target_port_call_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_call public.port_calls;
  target_site public.sites;
  target_period public.planning_periods;
  target_version public.schedule_versions;
  effective_anchor timestamptz;
  call_date date;
  week_start date;
  week_end date;
  requirements_result jsonb;
  version_result jsonb;
begin
  select * into target_call
  from public.port_calls
  where id = target_port_call_id;

  if target_call.id is null then
    raise exception 'Port call not found';
  end if;

  select * into target_site
  from public.sites
  where id = target_call.site_id
    and active = true;

  if target_site.id is null then
    raise exception 'Active site not found';
  end if;

  if not public.has_role(
    target_call.organization_id,
    target_call.site_id,
    array['platform_admin', 'planning_admin', 'planner']::public.app_role[]
  ) then
    raise exception 'Insufficient permissions';
  end if;

  effective_anchor := coalesce(
    target_call.estimated_arrival_at,
    target_call.scheduled_arrival_at,
    target_call.estimated_departure_at,
    target_call.scheduled_departure_at
  );

  if effective_anchor is null then
    return jsonb_build_object(
      'created', false,
      'portCallId', target_call.id,
      'reason', 'missing_timing'
    );
  end if;

  call_date := (effective_anchor at time zone target_site.timezone)::date;
  week_start := call_date - (extract(isodow from call_date)::integer - 1);
  week_end := week_start + 6;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      target_call.site_id::text || ':' || week_start::text,
      0
    )
  );

  select * into target_period
  from public.planning_periods period
  where period.site_id = target_call.site_id
    and period.starts_on = week_start
    and period.ends_on = week_end
  order by period.created_at
  limit 1;

  if target_period.id is null and target_call.status = 'cancelled' then
    return jsonb_build_object(
      'created', false,
      'portCallId', target_call.id,
      'reason', 'cancelled'
    );
  end if;

  if target_period.id is null then
    insert into public.planning_periods (
      organization_id,
      site_id,
      name,
      starts_on,
      ends_on,
      timezone
    ) values (
      target_call.organization_id,
      target_call.site_id,
      'Semaine du ' || to_char(week_start, 'DD/MM/YYYY'),
      week_start,
      week_end,
      target_site.timezone
    )
    returning * into target_period;
  end if;

  requirements_result := public.generate_staffing_requirements(target_period.id);

  select * into target_version
  from public.schedule_versions version
  where version.planning_period_id = target_period.id
  order by
    case version.status
      when 'draft' then 0
      when 'published' then 1
      else 2
    end,
    version.version_number desc
  limit 1;

  if target_version.id is null and target_call.status <> 'cancelled' then
    version_result := public.create_schedule_version(
      target_period.id,
      'Planning automatique',
      'Initialisation automatique à partir des escales'
    );
  end if;

  return jsonb_build_object(
    'created', target_version.id is null and target_call.status <> 'cancelled',
    'portCallId', target_call.id,
    'planningPeriodId', target_period.id,
    'scheduleVersionId', coalesce(
      version_result ->> 'id',
      target_version.id::text
    ),
    'generatedRequirements', coalesce(
      (requirements_result ->> 'generatedCount')::integer,
      0
    )
  );
end;
$$;

create or replace function public.sync_planning_from_port_call()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_site public.sites;
  previous_period public.planning_periods;
  previous_anchor timestamptz;
  current_anchor timestamptz;
  previous_date date;
  current_date_value date;
begin
  perform public.ensure_planning_workspace_for_port_call(new.id);

  if tg_op = 'UPDATE' then
    select * into target_site
    from public.sites
    where id = new.site_id;

    previous_anchor := coalesce(
      old.estimated_arrival_at,
      old.scheduled_arrival_at,
      old.estimated_departure_at,
      old.scheduled_departure_at
    );
    current_anchor := coalesce(
      new.estimated_arrival_at,
      new.scheduled_arrival_at,
      new.estimated_departure_at,
      new.scheduled_departure_at
    );

    if previous_anchor is not null and current_anchor is not null then
      previous_date := (previous_anchor at time zone target_site.timezone)::date;
      current_date_value := (current_anchor at time zone target_site.timezone)::date;

      if previous_date is distinct from current_date_value then
        select * into previous_period
        from public.planning_periods period
        where period.site_id = new.site_id
          and previous_date between period.starts_on and period.ends_on
        order by period.starts_on desc
        limit 1;

        if previous_period.id is not null then
          perform public.generate_staffing_requirements(previous_period.id);
        end if;
      end if;
    end if;
  end if;

  return new;
end;
$$;

create trigger port_calls_sync_planning
after insert or update of
  scheduled_arrival_at,
  scheduled_departure_at,
  estimated_arrival_at,
  estimated_departure_at,
  status,
  demand_profile_id
on public.port_calls
for each row execute function public.sync_planning_from_port_call();

create or replace function public.sync_planning_from_load_forecast()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.ensure_planning_workspace_for_port_call(old.port_call_id);
    return old;
  end if;
  perform public.ensure_planning_workspace_for_port_call(new.port_call_id);
  return new;
end;
$$;

create trigger call_load_forecasts_sync_planning
after insert or update or delete on public.call_load_forecasts
for each row execute function public.sync_planning_from_load_forecast();

revoke all on function public.ensure_planning_workspace_for_port_call(uuid) from public;
revoke all on function public.sync_planning_from_port_call() from public;
revoke all on function public.sync_planning_from_load_forecast() from public;

grant execute on function public.ensure_planning_workspace_for_port_call(uuid)
to authenticated;
