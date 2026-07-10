# Database Standards

## Persistence

- All schema changes go through migrations.
- SQLite is the supported local database; production topology must be recorded in an ADR before
  deployment.
- Every foreign key and high-cardinality query must be reviewed.
- Every production query added to a hot path needs an index plan.
- Use transactions around business invariants.
- Avoid storing derived data unless the refresh model is explicit.
- SQLite backups must use the online backup path (`VACUUM INTO`), include a SHA-256 manifest and
  pass both integrity and foreign-key checks before being accepted.
- Restore drills run in CI against an isolated target. Restoring over an active database requires
  an explicit force flag and creates a rollback copy.

## Data ownership

- Tables are owned by backend domains, not by frontend screens.
- Dossiers, travelers and vehicles use normalized relational tables and indexed normalized search
  keys; frontend bundles must not contain business-record fixtures.
- No application may write directly to another domain's tables.
- PII must be classified before storage.

## Scale

- Start with a single writer.
- Move to a server database only when availability or concurrency requirements demand it.
- Add replicas or partitioning only after measured query patterns prove the need.
