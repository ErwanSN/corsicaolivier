# Database Standards

## PostgreSQL

- All schema changes go through migrations.
- Every foreign key and high-cardinality query must be reviewed.
- Every production query added to a hot path needs an index plan.
- Use transactions around business invariants.
- Avoid storing derived data unless the refresh model is explicit.

## Data ownership

- Tables are owned by backend domains, not by frontend screens.
- No application may write directly to another domain's tables.
- PII must be classified before storage.

## Scale

- Start with a single writer.
- Add read replicas for read-heavy workloads.
- Use partitioning only after query patterns prove the need.
