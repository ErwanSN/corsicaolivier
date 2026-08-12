# Plateforme Planning Corsica Linea

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

- Node.js 22 ou plus récent ;
- pnpm 10 ou plus récent (`corepack enable` si nécessaire) ;
- Docker Desktop pour exécuter Supabase en local, ou un projet Supabase distant de développement.

## Installation

```powershell
pnpm install
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env
```

Le web et l’API métier utilisent exclusivement la clé Supabase publiable. La clé
privilégiée est réservée au worker outbox isolé ; elle ne doit jamais être injectée
dans ces deux runtimes ni préfixée par `NEXT_PUBLIC_`.

## Base de données locale

```powershell
pnpm db:start
pnpm db:reset
pnpm db:types       # régénère les types TypeScript depuis le schéma public local
pnpm db:types:check # vérifie sans écrire que les types committés sont à jour
pnpm db:lint
```

Les types de `apps/api/src/database/database.types.ts` sont une sortie Supabase
reproductible : ils ne doivent jamais être édités à la main. La CI les régénère après
un `db:reset` et refuse toute migration dont la mise à jour de types aurait été oubliée.

Les migrations de référence ne chargent aucun compte ni scénario de démonstration par
défaut. Le jeu préfixé `[DEMO]` est fail-closed et réservé à un environnement jetable
explicitement configuré avant l’application des migrations. Le fichier
`supabase/seed.sql` ne contient que trois agents et trois postes explicitement fictifs.
Les documents opérationnels sources restent dans un stockage métier contrôlé : le
répertoire `corpus/` est interdit dans Git et dans les images de déploiement.

## Développement et contrôles

```powershell
pnpm dev          # Web : http://localhost:3000, API : http://localhost:3001/api
pnpm check        # syntaxe SQL, garde-fous sécurité, lint, types et tests
pnpm format:check
pnpm build
pnpm start
```

Les parcours navigateur publics s’exécutent en Chromium contre un build Next réel et
des services locaux déterministes, sans contacter la production :

```bash
pnpm --filter @corsica/planning-web exec playwright install chromium
pnpm test:e2e
```

La suite par défaut reste entièrement simulée, avec des identifiants `.invalid`
strictement fictifs. La CI l’exécute d’abord, puis démarre et réinitialise un Supabase
local avant de lancer uniquement `authenticated.spec.ts` contre sa vraie Auth et son
vrai TOTP. Un provisionneur réservé à GitHub Actions crée un compte éphémère, masque ses
identifiants et le supprime systématiquement. La clé d’administration locale reste dans
ce seul processus : elle n’est ni exportée vers Playwright, ni injectée dans le build ou
le runtime web. La trace, la vidéo et les captures sont désactivées pour ce parcours
réel afin de ne pas persister les secrets de connexion.

En production, `docker-compose.coolify.yml` exécute trois services distincts : web,
API HTTP et worker outbox. Le worker ne publie aucun port et expose uniquement un
heartbeat local au healthcheck du conteneur. Le web rejoint en plus un réseau Docker
interne dédié avec le seul service GoTrue afin d’appliquer des buckets Auth/MFA par
identité ; sa création et les prérequis GoTrue/Traefik/Kong sont détaillés dans le
[guide d’exploitation](docs/EXPLOITATION.md#limitation-authmfa-gotrue-21860).

Le endpoint public de disponibilité est `GET /health` sur le service web ; il contrôle
le endpoint interne `GET /api/health` de l’API et ses dépendances Supabase. Tous les
autres endpoints API requièrent un access token Supabase dans
`Authorization: Bearer <token>`.

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
