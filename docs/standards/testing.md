# Testing Standards

## Test pyramid

- Unit tests for pure domain rules.
- Contract tests for API boundaries.
- Integration tests for database and external adapters.
- End-to-end tests for critical journeys.
- Load tests before public launch.

## Rules

- Test behavior, not implementation details.
- Tests must be deterministic.
- Critical bug fixes need regression tests.
- Mock only what is outside the boundary under test.
