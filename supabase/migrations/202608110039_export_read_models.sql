-- Export only the newest forecast of every requested call. This avoids both a
-- hidden global row cap and loading an unbounded revision history into the API.
create or replace function public.get_latest_call_load_forecasts(
  target_port_call_ids uuid[]
)
returns setof public.call_load_forecasts
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if target_port_call_ids is null
    or cardinality(target_port_call_ids) > 500 then
    raise exception 'Between 0 and 500 port call ids are accepted'
      using errcode = '22023';
  end if;

  return query
  select distinct on (forecast.port_call_id) forecast.*
  from public.call_load_forecasts forecast
  where forecast.port_call_id = any(target_port_call_ids)
  order by
    forecast.port_call_id,
    forecast.received_at desc,
    forecast.created_at desc,
    forecast.id desc;
end;
$$;

revoke all on function public.get_latest_call_load_forecasts(uuid[])
from public, anon, authenticated;
grant execute on function public.get_latest_call_load_forecasts(uuid[])
to authenticated;

comment on function public.get_latest_call_load_forecasts(uuid[]) is
  'RLS-scoped bounded read model returning exactly the newest load forecast per requested port call.';
