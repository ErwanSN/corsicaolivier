# Corsica Linea Tools Panel

Monorepo de la plateforme interne Corsica Linea et de son premier outil, Planning.

Le parcours fonctionnel couvre les agents, contrats, compétences, préférences et
restrictions, les groupes et objectifs horaires, les référentiels de postes/navires, les
escales et charges ainsi que les profils de besoins. Le calendrier hebdomadaire
est l’unique interface de création, modification, publication, export et
replanification contrôlée après perturbation maritime.

- `apps/web` : Next.js App Router, React Server Components, Supabase SSR et Tailwind CSS ;
- `apps/api` : NestJS sur Fastify, validation des JWT Supabase et accès métier sous RLS ;
- `supabase` : configuration locale, migrations SQL, RLS, audit et données de référence sans PII ;
- `docs` : cadrage produit et décisions d’architecture/sécurité.

## Prérequis

- Node.js 20.9 ou plus récent ;
- pnpm 10 ou plus récent (`corepack enable` si nécessaire) ;
- Docker Desktop pour exécuter Supabase en local, ou un projet Supabase distant de développement.

## Installation

```powershell
pnpm install
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env
```

Le web et l’API métier utilisent exclusivement la clé Supabase publiable. Une clé
privilégiée n’est nécessaire que pour un futur worker système isolé ; elle ne doit jamais
être injectée dans ces deux runtimes ni préfixée par `NEXT_PUBLIC_`.

## Base de données locale

```powershell
pnpm db:start
pnpm db:reset
pnpm db:lint
```

Les migrations créent les référentiels et un jeu de scénarios clairement préfixé
`[DEMO]`. Le fichier `supabase/seed.sql` contient aussi, à la demande du métier, les noms
relevés dans le corpus avec des matricules techniques `DOC-*`. Ces noms doivent être
considérés comme des données personnelles : ne pas exécuter ce seed hors d'un
environnement autorisé et ne pas le promouvoir en production sans validation DPO.

## Développement et contrôles

```powershell
pnpm dev          # Web : http://localhost:3000, API : http://localhost:3001/api
pnpm check        # syntaxe SQL, garde-fous sécurité, lint, types et tests
pnpm format:check
pnpm build
pnpm start
```

Le endpoint public de disponibilité est `GET /api/health`. Tous les autres endpoints
requièrent un access token Supabase dans `Authorization: Bearer <token>`.

Les mutations à rôle explicite utilisent aussi les en-têtes de périmètre
`x-organization-id` et, si nécessaire, `x-site-id`. La RLS PostgreSQL vérifie de nouveau
ce périmètre avec l’identité contenue dans le JWT.

## Règles non négociables

- Le navigateur utilise Supabase uniquement pour la session ; les opérations métier passent par NestJS.
- Le client privilégié Supabase n’est utilisé que par les traitements système contrôlés.
- Les composants Next sont des Server Components par défaut.
- Tailwind est le système de style principal et la prop JSX `style` est interdite.
- Les versions publiées du planning sont immuables ; toute correction crée une nouvelle version.
- Toutes les tables métier sont sous RLS et les mutations sont journalisées en base.
- Aucun fichier du corpus ne doit être servi ou copié dans un build applicatif.

Voir [le cadrage Planning](docs/CADRAGE_PLANNING.md) et
[l'architecture sécurité](docs/ARCHITECTURE_SECURITE.md), puis le
[guide d'exploitation](docs/EXPLOITATION.md). Le résultat de l'audit par scénarios est
consigné dans [l'audit du 19 juillet 2026](docs/AUDIT_PLATEFORME_2026-07-19.md) et le jeu
fictif est décrit dans [les scénarios de démonstration](docs/SCENARIOS_DEMO.md).
