begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_temp;

select plan(6);

select ok(
  has_function_privilege(
    'authenticated',
    'public.get_latest_call_load_forecasts(uuid[])',
    'EXECUTE'
  ),
  'authenticated users can use the RLS-scoped export read model'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.get_latest_call_load_forecasts(uuid[])',
    'EXECUTE'
  ),
  'anonymous callers cannot use the export read model'
);
select lives_ok(
  $$select * from public.get_latest_call_load_forecasts(array[]::uuid[])$$,
  'an empty bounded request is valid'
);
select throws_ok(
  $$
    select *
    from public.get_latest_call_load_forecasts(
      array(
        select extensions.gen_random_uuid()
        from generate_series(1, 501)
      )
    )
  $$,
  '22023',
  null,
  'more than 500 calls are rejected'
);
select ok(
  (
    with requested as (
      select array_agg(call_id) as ids
      from (
        select distinct forecast.port_call_id as call_id
        from public.call_load_forecasts forecast
        order by forecast.port_call_id
        limit 5
      ) selected
    )
    select (
      select count(*)
      from public.get_latest_call_load_forecasts(
        coalesce(requested.ids, array[]::uuid[])
      ) result
    ) <= cardinality(coalesce(requested.ids, array[]::uuid[]))
    from requested
  ),
  'at most one row is returned per requested call'
);
select ok(
  not exists (
    with requested as (
      select array_agg(call_id) as ids
      from (
        select distinct forecast.port_call_id as call_id
        from public.call_load_forecasts forecast
        order by forecast.port_call_id
        limit 5
      ) selected
    )
    select 1
    from requested,
      lateral public.get_latest_call_load_forecasts(
        coalesce(requested.ids, array[]::uuid[])
      ) result
    where result.received_at <> (
      select max(candidate.received_at)
      from public.call_load_forecasts candidate
      where candidate.port_call_id = result.port_call_id
    )
  ),
  'each returned forecast is the newest revision of its call'
);

select * from finish();
rollback;
