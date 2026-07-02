# Observability Standards

## Required signals

- Logs for decisions and failures.
- Metrics for traffic, latency, errors and saturation.
- Traces across frontend, gateway, backend and database calls.

## Rules

- Every request gets a request ID.
- Logs must not contain PII, secrets or payment data.
- Alerts must map to user impact.
- Dashboards must track p95 and p99 latency for critical flows.

## Critical flows

- authentication
- booking lookup
- availability search
- payment
- ticket retrieval
- push notifications
