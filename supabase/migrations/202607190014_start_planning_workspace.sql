-- Start a complete planning workspace in one transaction. The period,
-- calculated requirements and initial draft either all exist or none do.

create or replace function public.start_planning_workspace(
  target_organization_id uuid,
  target_site_id uuid,
  period_name text,
  period_starts_on date,
  period_ends_on date,
  period_timezone text default 'Europe/Paris'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_site public.sites;
  created_period public.planning_periods;
  requirements_result jsonb;
  version_result jsonb;
begin
  select * into target_site
  from public.sites
  where id = target_site_id
    and organization_id = target_organization_id
    and active = true;

  if target_site.id is null then
    raise exception 'Active site not found in organization';
  end if;

  if not public.has_role(
    target_organization_id,
    target_site_id,
    array['platform_admin', 'planning_admin', 'planner']::public.app_role[]
  ) then
    raise exception 'Insufficient permissions';
  end if;

  if period_name is null or char_length(period_name) not between 2 and 120 then
    raise exception 'A valid period name is required';
  end if;

  if period_starts_on is null
    or period_ends_on is null
    or period_ends_on < period_starts_on
    or period_ends_on - period_starts_on > 31 then
    raise exception 'Invalid planning period dates';
  end if;

  insert into public.planning_periods (
    organization_id,
    site_id,
    name,
    starts_on,
    ends_on,
    timezone
  ) values (
    target_organization_id,
    target_site_id,
    period_name,
    period_starts_on,
    period_ends_on,
    period_timezone
  )
  returning * into created_period;

  requirements_result := public.generate_staffing_requirements(created_period.id);
  version_result := public.create_schedule_version(
    created_period.id,
    'Planning initial',
    'Création du planning'
  );

  return jsonb_build_object(
    'planningPeriodId', created_period.id,
    'scheduleVersionId', version_result ->> 'id',
    'generatedRequirements', coalesce(
      (requirements_result ->> 'generatedCount')::integer,
      0
    )
  );
end;
$$;

revoke all on function public.start_planning_workspace(
  uuid,
  uuid,
  text,
  date,
  date,
  text
) from public;

grant execute on function public.start_planning_workspace(
  uuid,
  uuid,
  text,
  date,
  date,
  text
) to authenticated;
