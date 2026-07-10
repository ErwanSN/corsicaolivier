# Corsica Linea Platform

Monorepo produit pour les expériences client, employé et administrateur de Corsica Linea.
Il comprend l'authentification locale, la cartographie du port et ses itinéraires, ainsi que les
fondations web, mobile, API et workers.

## Stack

- Web: Next.js
- Mobile: Expo React Native, pinned to Expo SDK 54 for current Expo Go compatibility
- Backend: NestJS
- Workers: NestJS context workers
- Database: Prisma avec SQLite pour l'environnement local
- Monorepo: pnpm workspaces and Turborepo

## Structure

```txt
apps/
  api/       NestJS HTTP API
  mobile/    Expo React Native app
  web/       Next.js web app
  workers/   async workers
packages/
  api-client/ typed API client
  assets/    source and optimized brand assets
  contracts/  API contracts and schemas
  ui/         shared UI primitives
docs/
  architecture/
  standards/
```

## Commands

```bash
pnpm install
pnpm db:setup
pnpm assets:optimize
pnpm dev
pnpm dev:mobile:phone
pnpm lint
pnpm typecheck
pnpm test
pnpm e2e
pnpm build
pnpm audit --prod --audit-level moderate
```

## Mobile on a physical iPhone

```bash
pnpm dev:mobile:phone
```

This starts Expo Go through a tunnel. Use `pnpm dev:mobile:phone:lan` when the phone and computer
are on the same unrestricted private network. The mobile app is intentionally pinned to Expo SDK 54
until the team chooses a custom dev client or a newer Expo Go-compatible SDK.

## Local database

```bash
pnpm db:setup
```

Development uses a local SQLite database at `apps/api/prisma/local.db`. The file is generated,
ignored by Git and managed exclusively through Prisma migrations in
`apps/api/prisma/migrations-sqlite`.

Create a consistent and integrity-checked backup with `pnpm db:backup`. Validate the complete
backup and restore path with `pnpm db:recovery-test`. The guarded restore command and operational
procedure are documented in `docs/runbooks/sqlite-recovery.md`.

## Product surfaces

- `/`: public web experience.
- `/port`: client port map and active boarding route.
- `/port/admin`: administrator editor for draggable points of interest and calculated routes.
- Account access is exposed through the connection and registration dialogs in the public header.
- `/compte`: role-aware account experience for clients, employees and administrators.

Route configuration is validated by shared Zod contracts, persisted through the API and editable
only by administrators. Web sessions use an HttpOnly, SameSite cookie; the mobile application uses
its platform-secure session storage.

## Quality gates

The CI pipeline installs from the lockfile, audits production dependencies, checks formatting and
lint rules without warnings, type-checks, runs unit and Playwright browser tests, audits WCAG A/AA
and builds every workspace. Security headers, strict CORS origins, request rate limiting and
graceful worker shutdown are part of the runtime baseline.
