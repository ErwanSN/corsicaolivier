# ADR 0001: Initial Stack

## Status

Accepted

## Decision

Use:

- Next.js for web.
- Expo React Native for mobile.
- NestJS for backend services and workers.
- PostgreSQL as the transactional database.
- Redis or Valkey for cache, rate limiting and job coordination.
- pnpm and Turborepo for the monorepo.

## Rationale

This keeps one TypeScript ecosystem for frontends, backend contracts and tooling while preserving
independent deployments and runtime boundaries.

## Consequences

- Strong shared typing is required.
- The backend must remain stateless to scale horizontally.
- Heavy workloads must move to workers.
- Performance-sensitive services may be split later if measurements justify it.
