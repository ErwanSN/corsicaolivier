# Release Standards

## Environments

- local
- preview
- staging
- production

## Release rules

- Deploy backend before clients when contracts are backward-compatible.
- Use feature flags for risky user-facing behavior.
- Keep database migrations backward-compatible during rolling deploys.
- Monitor errors, latency and business KPIs after release.

## Rollback

Every release must define:

- code rollback path
- data rollback or forward-fix path
- feature flag kill switch when relevant
