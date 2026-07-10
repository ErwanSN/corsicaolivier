# Production readiness

## Supported topology

The current Prisma adapter uses SQLite and the authentication limiter is process-local. The only
supported topology is therefore one API process with one writable database file. Set
`API_INSTANCE_COUNT=1`; startup rejects any higher value while `DATABASE_URL` starts with `file:`.

Horizontal scaling requires a dedicated ADR, a server database migration and a distributed rate
limiter. Postgres or Redis containers alone do not constitute support and are intentionally not
shipped as inactive scaffolding.

## Required production configuration

- `AUTH_JWT_SECRET`: non-placeholder secret of at least 32 characters.
- `METRICS_TOKEN`: independent non-placeholder token of at least 32 characters.
- `DATABASE_URL`: explicit SQLite file URL for the supported single-instance topology.
- `APP_PUBLIC_URL` and `API_PUBLIC_URL`: absolute HTTPS URLs.
- `CORS_ORIGIN`: comma-separated HTTPS origins; every browser origin must be explicit.
- `TRUST_PROXY`: `true` only when the immediate trusted ingress supplies forwarding headers.

The API validates these invariants before creating the NestJS application and exits with one
aggregated diagnostic when configuration is unsafe.

## Deployment gate

Run `pnpm ci`, `pnpm db:recovery-test` and a restore drill against the deployment artifact. Confirm
that `/api/health` reports a reachable database and that `/api/metrics` rejects requests without
the monitoring bearer token.
