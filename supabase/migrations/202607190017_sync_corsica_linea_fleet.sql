-- Structural referential data required from here on. It previously lived only in
-- supabase/seed.sql, but Supabase applies every migration before the seed, so this
-- migration and 202607190019 aborted on a clean database. The identifiers match
-- seed.sql, which stays idempotent.
insert into public.organizations (id, slug, name)
values ('00000000-0000-4000-8000-000000000001', 'corsica-linea', 'Corsica Linea')
on conflict (id) do nothing;

insert into public.sites (id, organization_id, code, name, timezone)
values
  (
    '00000000-0000-4000-8000-000000000101',
    '00000000-0000-4000-8000-000000000001',
    'MRS-JOL',
    'Marseille Joliette',
    'Europe/Paris'
  ),
  (
    '00000000-0000-4000-8000-000000000102',
    '00000000-0000-4000-8000-000000000001',
    'MRS-JAN',
    'Marseille Janet',
    'Europe/Paris'
  )
on conflict (id) do nothing;

do $$
declare
  corsica_organization_id uuid;
begin
  select organization.id
  into corsica_organization_id
  from public.organizations organization
  where organization.slug in ('corsica-linea', 'corsicalinea')
    or lower(organization.name) = 'corsica linea'
  order by organization.created_at
  limit 1;

  if corsica_organization_id is null then
    raise exception 'Corsica Linea organization not found';
  end if;

  update public.vessels
  set active = false,
      updated_at = now()
  where organization_id = corsica_organization_id;

  insert into public.vessels (
    organization_id,
    code,
    name,
    active
  )
  select
    corsica_organization_id,
    fleet.code,
    fleet.name,
    true
  from (
    values
      ('A-GALEOTTA', 'A Galeotta'),
      ('CAPU-DI-MURU', 'Capu di Muru'),
      ('CAPU-ROSSU', 'Capu Rossu'),
      ('D-CASANOVA', 'Danielle Casanova'),
      ('JEAN-NICOLI', 'Jean Nicoli'),
      ('MEDITERRANEE', 'Méditerranée'),
      ('PAGLIA-ORBA', 'Paglia Orba'),
      ('PASCAL-PAOLI', 'Pascal Paoli'),
      ('VIZZAVONA', 'Vizzavona')
  ) as fleet(code, name)
  on conflict (organization_id, code)
  do update set
    name = excluded.name,
    active = true,
    updated_at = now();
end;
$$;
