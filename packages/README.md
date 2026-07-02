# Packages

Shared libraries live here. Packages must stay framework-light and must not become hidden apps.

## Boundaries

- `api-client`: typed API client for frontends and internal tools.
- `assets`: source and optimized brand/product assets with typed metadata.
- `config`: shared configuration helpers and environment validation.
- `contracts`: API contracts, DTOs and validation schemas.
- `domain`: pure domain vocabulary and rules.
- `ui`: shared UI primitives only.

Packages must not depend on `apps/*`.
