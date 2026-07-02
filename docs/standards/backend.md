# Backend Standards

## NestJS

- Controllers contain routing only.
- Services contain orchestration only.
- Pure domain logic lives in `packages/domain`.
- Validation lives at boundaries with shared schemas.
- Infrastructure adapters are isolated from domain code.

## Runtime

- Services are stateless.
- Shutdown must be graceful.
- External calls require timeouts, retries and circuit-breaking where appropriate.
- Logs must include request identifiers.

## Performance

- Do not add database calls in loops.
- Avoid synchronous work in request paths.
- Cache only with explicit TTL and invalidation rules.
- Add load tests before launch for critical routes.
