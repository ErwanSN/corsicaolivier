-- Jeu local strictement fictif. Aucun nom, matricule ou document opérationnel
-- réel ne doit être ajouté à ce fichier ni au dépôt Git.
insert into public.organizations (id, slug, name)
values (
  'de000000-0000-4000-8000-000000000001',
  'corsica-demo',
  'Organisation de démonstration'
)
on conflict (id) do nothing;

insert into public.sites (id, organization_id, code, name, timezone)
values
  (
    'de000000-0000-4000-8000-000000000002',
    'de000000-0000-4000-8000-000000000001',
    'DEMO-A',
    'Escale Démo Nord',
    'Europe/Paris'
  ),
  (
    'de000000-0000-4000-8000-000000000003',
    'de000000-0000-4000-8000-000000000001',
    'DEMO-B',
    'Escale Démo Sud',
    'Europe/Paris'
  )
on conflict (id) do nothing;

insert into public.positions (
  organization_id,
  site_id,
  code,
  name,
  description,
  color_token
)
values
  (
    'de000000-0000-4000-8000-000000000001',
    'de000000-0000-4000-8000-000000000002',
    'ACCUEIL-DEMO',
    'Accueil démonstration',
    'Poste fictif pour les tests locaux',
    'blue'
  ),
  (
    'de000000-0000-4000-8000-000000000001',
    'de000000-0000-4000-8000-000000000002',
    'QUAI-DEMO',
    'Quai démonstration',
    'Poste fictif pour les tests locaux',
    'amber'
  ),
  (
    'de000000-0000-4000-8000-000000000001',
    'de000000-0000-4000-8000-000000000003',
    'FRET-DEMO',
    'Fret démonstration',
    'Poste fictif pour les tests locaux',
    'emerald'
  )
on conflict (organization_id, code) do update
set site_id = excluded.site_id,
    name = excluded.name,
    description = excluded.description,
    color_token = excluded.color_token,
    active = true;

insert into public.agents (
  organization_id,
  primary_site_id,
  employee_number,
  display_name,
  active
)
values
  (
    'de000000-0000-4000-8000-000000000001',
    'de000000-0000-4000-8000-000000000002',
    'DEMO-001',
    'Agent Démo Alpha',
    true
  ),
  (
    'de000000-0000-4000-8000-000000000001',
    'de000000-0000-4000-8000-000000000002',
    'DEMO-002',
    'Agent Démo Bravo',
    true
  ),
  (
    'de000000-0000-4000-8000-000000000001',
    'de000000-0000-4000-8000-000000000003',
    'DEMO-003',
    'Agent Démo Charlie',
    true
  )
on conflict (organization_id, employee_number) do update
set primary_site_id = excluded.primary_site_id,
    display_name = excluded.display_name,
    active = true;
