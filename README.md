# Corsica Linea Platform

Source vierge pour une plateforme client mobile, web et backend a fort trafic.

## Stack

- Web: Next.js
- Mobile: Expo React Native, pinned to Expo SDK 54 for current Expo Go compatibility
- Backend: NestJS
- Workers: NestJS context workers
- Database: PostgreSQL
- Cache and queues: Redis or Valkey
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
  config/     shared configuration helpers
  contracts/  API contracts and schemas
  domain/     domain primitives
  ui/         shared UI primitives
docs/
  architecture/
  standards/
```

## Commands

```bash
pnpm install
pnpm assets:optimize
pnpm dev
pnpm dev:mobile:phone
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Mobile on a physical iPhone

```bash
pnpm dev:mobile:phone
```

This starts Expo Go through a tunnel. Use `pnpm dev:mobile:phone:lan` when the phone and computer
are on the same unrestricted private network. The mobile app is intentionally pinned to Expo SDK 54
until the team chooses a custom dev client or a newer Expo Go-compatible SDK.

## Local infrastructure

```bash
docker compose up -d postgres redis
```

## Source policy

This repository intentionally contains no product feature. Only technical bootstraps, contracts,
tooling and standards are allowed until product scope is defined.
