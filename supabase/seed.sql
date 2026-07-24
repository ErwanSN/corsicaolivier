-- Données de référence issues du corpus opérationnel fourni pour le projet.
insert into public.organizations (id, slug, name)
values ('00000000-0000-4000-8000-000000000001', 'corsica-linea', 'Corsica Linea')
on conflict (id) do nothing;

insert into public.sites (id, organization_id, code, name, timezone)
values
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000001', 'MRS-JOL', 'Marseille Joliette', 'Europe/Paris'),
  ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000001', 'MRS-JAN', 'Marseille Janet', 'Europe/Paris')
on conflict (id) do nothing;

-- Postes structurants relevés dans les feuilles hebdomadaires du corpus.
-- Les codes préservent l’ordre de lecture historique du planning.
insert into public.positions (
  organization_id,
  site_id,
  code,
  name,
  description,
  color_token
)
values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'CA-01-CHEF-NAVIRE', 'Chefs de navire', 'Centre Autos Joliette', 'lime'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'CA-02-REFERENT', 'Agents référents', 'Centre Autos Joliette', 'lime'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'CA-03-GUICHETS', 'Guichets', 'Centre Autos Joliette', 'lime'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'CA-04-TOISES', 'Toises', 'Centre Autos Joliette', 'lime'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'CA-05-CONTROLES', 'Contrôles', 'Centre Autos Joliette', 'lime'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'CA-06-ALADDIN', 'Contrôles Aladdin', 'Centre Autos Joliette', 'lime'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'CA-07-GARE-MARITIME', 'Gare Maritime Joliette', 'Centre Autos Joliette', 'lime'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'CA-08-DEBARQ-CORSE', 'Débarquement Corse', 'Centre Autos Joliette', 'lime'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'CA-09-CONVOIS', 'Convois', 'Centre Autos Joliette', 'lime'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'CA-10-CHANTERAC', 'Chanterac', 'Centre Autos Joliette', 'lime'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'CA-11-PORTE-3A', 'Porte 3A', 'Centre Autos Joliette', 'lime'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'CA-12-STOCKAGE-M2', 'Stockage M2', 'Centre Autos Joliette', 'lime'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'CA-13-STOCKAGE-TPS', 'Stockage TPS', 'Centre Autos Joliette', 'lime'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'CA-14-STOCKAGE-DDL', 'Stockage DDL', 'Centre Autos Joliette', 'lime'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'CA-15-TRC', 'TRC', 'Centre Autos Joliette', 'lime'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'CA-16-POINT-2', 'Point 2 / barrières', 'Centre Autos Joliette', 'lime'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'CA-17-PORTE-3B', 'Porte 3B', 'Centre Autos Joliette', 'lime'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'CA-18-ENTREE-COFRAPEX', 'Entrée Cofrapex', 'Centre Autos Joliette', 'lime'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'CA-19-PRESTOCK-JANET', 'Pré-stock Cap Janet', 'Centre Autos Joliette', 'lime'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'CA-20-T0', 'T0', 'Centre Autos Joliette', 'lime'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'CA-21-STOCKAGE-H18', 'Stockage H18', 'Centre Autos Joliette', 'lime'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'CA-22-DEBARQ-AFN', 'Débarquement AFN', 'Centre Autos Joliette', 'lime'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'FRET-01-REFERENT', 'Agents référents fret', 'Fret Joliette', 'lime'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'FRET-02-PORTIQUE', 'Portique', 'Fret Joliette', 'lime'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'FRET-03-GUICHET', 'Guichet fret', 'Fret Joliette', 'lime'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'FRET-04-SUIVEURS', 'Suiveurs', 'Fret Joliette', 'lime'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'FRET-05-PC-PINEDE', 'PC Pinède', 'Fret Joliette', 'lime'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000102', 'JANET-01-GARAGE', 'Garage', 'Centre Autos Janet', 'lime'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000102', 'JANET-02-CIRCUITS', 'Circuits', 'Centre Autos Janet', 'lime'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000102', 'JANET-03-GUICHETS', 'Guichets', 'Centre Autos Janet', 'lime'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000102', 'JANET-04-CONTROLES', 'Contrôles', 'Centre Autos Janet', 'lime'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000102', 'JANET-05-DEBARQUEMENT', 'Débarquement', 'Centre Autos Janet', 'lime'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000102', 'JANET-06-ROND-POINT', 'Rond-point Cofrapex', 'Centre Autos Janet', 'lime'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000102', 'JANET-07-ENTREE', 'Entrée', 'Centre Autos Janet', 'lime'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000102', 'JANET-08-GUERITES', 'TH Guérites', 'Centre Autos Janet', 'lime'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000102', 'JANET-09-COFRAPEX', 'Cofrapex', 'Centre Autos Janet', 'lime'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000102', 'JANET-10-APRES-GUERITES', 'Après guérites', 'Centre Autos Janet', 'lime'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000102', 'JANET-11-PIF', 'PIF', 'Centre Autos Janet', 'lime'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000102', 'JANET-12-TO', 'TO', 'Centre Autos Janet', 'lime'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000102', 'JANET-13-AIGUILLAGE', 'Aiguillage / après JO', 'Centre Autos Janet', 'lime'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000102', 'JANET-14-STOCKAGE', 'Stockage', 'Centre Autos Janet', 'lime'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000102', 'JANET-15-PORTE-PIETONS', 'Porte piétons', 'Centre Autos Janet', 'lime')
on conflict (organization_id, code) do update
set site_id = excluded.site_id,
    name = excluded.name,
    description = excluded.description,
    color_token = excluded.color_token,
    active = true;

-- Agents relevés dans les listes et plannings du corpus.
-- Les documents ne contiennent pas de matricules : un identifiant technique
-- stable préfixé DOC- est dérivé du site et du nom sans prétendre le remplacer.
with corpus_agents (primary_site_id, display_name) as (
  select '00000000-0000-4000-8000-000000000102'::uuid, name
  from unnest(array[
    'ABDERRAHMANE',
    'ABDESSADEK',
    'ALFENY',
    'AMIROUCHE F.',
    'AMROUEN',
    'AOURI',
    'ARNAL',
    'ATAILIA',
    'AULINO',
    'BEAUSSART S.',
    'BECHINI',
    'BIANCO',
    'BONANNO',
    'BONFIGLIO',
    'BOUCHET',
    'BOURA',
    'BROCAS',
    'BUSONERA',
    'CANO',
    'CHIKHOUNE',
    'CORTICCHIATO',
    'DALLA COSTA',
    'DENIS',
    'DIPAS',
    'DUFOUR',
    'ESPOSITO',
    'GALIE',
    'GIGON',
    'GIORICO',
    'GIOVANNINI',
    'GRAZIANI',
    'HAMROUNI',
    'HENRIC',
    'HUSS',
    'KHERROUR',
    'LANFRANCHI',
    'LE STER',
    'LEONARDI',
    'LEPRE',
    'LEU',
    'LIBOUREL',
    'LIOTAUD',
    'MANOLI',
    'MAROUANE',
    'MECONI A.',
    'MECONI B.',
    'MEDJKANE',
    'NIELI A.',
    'OTMANE',
    'PIEYRE',
    'PORTEFAIX',
    'PUHA',
    'RABIA',
    'ROSSI',
    'RUBI',
    'SADALI',
    'SADELLI',
    'SANTINI',
    'SULTAN',
    'TEKIKI',
    'TEXIER',
    'TOURRE',
    'VINCENTI',
    'WAGENER J.',
    'WAGENER K.',
    'WAGNER',
    'ZAMORA'
  ]::text[]) as janet_agents(name)

  union all

  select '00000000-0000-4000-8000-000000000101'::uuid, name
  from unnest(array[
    'ALBERTO',
    'AMEZIANE',
    'AMIROUCHE',
    'ARNIAUD',
    'ATTA',
    'BARDIN',
    'BARKAOUI',
    'BAZZALI',
    'BEAUSSART C.',
    'BERRAH',
    'BESSAN',
    'BOCCHECIAMPE',
    'CORTEGGIANI',
    'DEVINAR',
    'DI FRANCESCO',
    'DI MAGGIO',
    'FEKAIR',
    'FERRAGGIOLI',
    'FILIPPINI',
    'GENNA',
    'GILLARDO',
    'HALLAH',
    'HOARAU',
    'HUREL',
    'IBOUROI',
    'JACQUINOT',
    'KACZMAREK',
    'KOITA',
    'LMAZGUELDI',
    'LOUHADJ',
    'MAKE',
    'MAURIZE',
    'MICHEL',
    'MINEO',
    'NEGREL.L',
    'NEMS',
    'OMAR ZAID',
    'PAUL',
    'RIVIER',
    'ROLIN',
    'TARBI',
    'TRAIKOVITCH',
    'VACCARO',
    'VAN MEER',
    'VANCAU',
    'VIDAL',
    'VIRTOV',
    'VITALI',
    'ZAAZOU',
    'ZERDOUM',
    'ZOGHLAMI'
  ]::text[]) as joliette_agents(name)
)
insert into public.agents (
  organization_id,
  primary_site_id,
  employee_number,
  display_name,
  active
)
select
  '00000000-0000-4000-8000-000000000001'::uuid,
  primary_site_id,
  'DOC-' || upper(substr(md5(primary_site_id::text || ':' || display_name), 1, 16)),
  display_name,
  true
from corpus_agents
on conflict (organization_id, employee_number) do update
set primary_site_id = excluded.primary_site_id,
    display_name = excluded.display_name,
    active = true;
