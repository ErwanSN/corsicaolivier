# Architecture Overview

## Runtime target

```txt
Web Next.js       Mobile Expo
     |                |
     +--------+-------+
              |
          Next.js web
              |
        NestJS/Fastify API
              |
        Prisma + SQLite
```

## Monorepo boundaries

- `apps/web`: public and authenticated web experience.
- `apps/mobile`: native iOS and Android experience.
- `apps/api`: synchronous HTTP API.
- `apps/workers`: asynchronous processing.
- `packages/contracts`: DTOs, validation schemas and API contracts.
- `packages/api-client`: generated or typed client used by apps.
- `packages/ui`: shared UI primitives only.

## Current deployment boundary

- SQLite is the supported local persistence layer and the source of truth for accounts, dossiers
  métier and port configuration.
- Dossiers, travelers and vehicles are owned by the API; staff screens consume validated shared
  contracts and never embed business records in the frontend bundle.
- The API is stateless except for its database and can be moved to a server database when the
  deployment topology requires horizontal writes.
- Workers currently provide lifecycle-safe processing scaffolding; no queue backend is implied.

## Scaling policy

- Cache public reads at the edge.
- Add a distributed cache only when measurements and documented consistency rules justify it.
- Keep writes idempotent.
- Use queues for notifications, document generation, webhooks, analytics and sync jobs.
- Select and document the production database topology before horizontal API scaling.
