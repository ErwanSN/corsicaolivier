# Architecture Overview

## Runtime target

```txt
Web Next.js       Mobile Expo
     |                |
     +--------+-------+
              |
        CDN / WAF / Edge
              |
       API Gateway / BFF
              |
        NestJS services
              |
   +----------+----------+
   |          |          |
PostgreSQL  Redis     Event queues
```

## Monorepo boundaries

- `apps/web`: public and authenticated web experience.
- `apps/mobile`: native iOS and Android experience.
- `apps/api`: synchronous HTTP API.
- `apps/workers`: asynchronous processing.
- `packages/contracts`: DTOs, validation schemas and API contracts.
- `packages/domain`: domain vocabulary and pure rules.
- `packages/api-client`: generated or typed client used by apps.
- `packages/ui`: shared UI primitives only.

## Scaling policy

- Cache public reads at the edge.
- Cache hot authenticated reads in Redis only when consistency rules are documented.
- Keep writes idempotent.
- Use queues for notifications, document generation, webhooks, analytics and sync jobs.
- Protect PostgreSQL with connection pooling and read replicas before adding new databases.
