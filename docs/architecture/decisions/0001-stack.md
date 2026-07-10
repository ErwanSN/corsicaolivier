# ADR 0001: Initial Stack

## Status

Accepted

## Decision

Use:

- Next.js for web.
- Expo React Native for mobile.
- NestJS for backend services and workers.
- Prisma with SQLite as the local transactional database.
- In-process rate limiting for the current single-node local runtime.
- pnpm and Turborepo for the monorepo.

## Rationale

This keeps one TypeScript ecosystem for frontends, backend contracts and tooling while preserving
independent deployments and runtime boundaries.

## Consequences

- Strong shared typing is required.
- The backend must remain stateless to scale horizontally.
- Heavy workloads must move to workers once a queue backend is selected and documented.
- Performance-sensitive services may be split later if measurements justify it.
- A production server database and distributed rate-limit store require a dedicated ADR before
  multi-instance deployment.
