# Testing Standards

## Test pyramid

- Unit tests for pure domain rules.
- Contract tests for API boundaries.
- Integration tests for database and external adapters.
- End-to-end tests for critical journeys.
- Automated WCAG A/AA checks on representative user-facing pages.
- Load tests before public launch.

## Rules

- Test behavior, not implementation details.
- Tests must be deterministic.
- Critical bug fixes need regression tests.
- Mock only what is outside the boundary under test.
- Browser failures retain traces, screenshots and videos as CI artifacts for diagnosis.
- Public critical paths run on Chromium and Firefox; mobile viewport behavior runs on Chromium.
- API performance smoke tests enforce a p95 latency budget under bounded concurrency.
- `pnpm load:test` runs a sustained health/database probe with configurable concurrency, request
  timeout, error-rate and latency budgets. Retain its JSON report as release evidence.
