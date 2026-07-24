create or replace function public.enforce_created_by_actor()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    new.created_by := (select auth.uid());
  end if;

  return new;
end;
$$;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'hour_target_overrides',
    'agent_position_preferences',
    'agent_position_restrictions',
    'agent_unavailability',
    'schedule_versions',
    'planning_shifts',
    'disruption_events',
    'replanning_scenarios'
  ] loop
    execute format(
      'create trigger %I before insert on public.%I for each row execute function public.enforce_created_by_actor()',
      target_table || '_enforce_actor',
      target_table
    );
  end loop;
end;
$$;

revoke all on function public.enforce_created_by_actor() from public;
