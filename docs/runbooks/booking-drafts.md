# Booking drafts operations

## Scope and invariants

The API owns booking drafts and prices. Browser storage contains only the opaque draft identifier;
it must never contain contact or passenger data. Drafts expire after 20 minutes. Creation requires
an `Idempotency-Key` between 16 and 128 characters, and updates require the last observed version.

SQLite supports one API instance only. Do not scale the booking API horizontally until the
database and rate limiter migrations described in the production-readiness runbook are complete.

## Signals

The protected `/api/metrics` endpoint exposes
`corsica_api_booking_draft_events_total{event}`. The `event` label is a closed, low-cardinality set:
`created`, `replayed`, `updated`, `conflict`, `expired`, and `not_found`. It never contains customer
or booking identifiers.

Use five-minute rates as initial operational signals:

```promql
sum by (event) (rate(corsica_api_booking_draft_events_total[5m]))
```

```promql
sum(rate(corsica_api_booking_draft_events_total{event="conflict"}[5m]))
/
clamp_min(sum(rate(corsica_api_booking_draft_events_total{event=~"created|updated"}[5m])), 0.001)
```

Alert initially when the conflict ratio exceeds 5% for 15 minutes, or when `created` drops to zero
for 15 minutes during expected traffic while HTTP requests remain non-zero. Tune these provisional
thresholds only from retained production baselines.

## Triage

1. Correlate the event increase with normalized route/status HTTP metrics and application logs.
2. A rise in `replayed` with successful responses usually means client retries and is safe.
3. A rise in `conflict` can indicate multiple tabs, stale clients, or an idempotency key reused for a
   different payload. Confirm the HTTP error code before changing server behavior.
4. A rise in `expired` indicates users taking longer than the quote lifetime or abandoned tabs. Do
   not extend quote validity without product and inventory approval.
5. A rise in `not_found` can indicate stale browser identifiers, database restoration, or clients
   targeting the wrong environment.

Never log request bodies, passenger/contact details, idempotency keys, or draft identifiers during
triage. Use trace identifiers and aggregate metrics.

## Recovery and rollback

If booking draft writes fail, stop the rollout and retain the database file and logs. Verify
`/api/health`, filesystem capacity and write permissions, then run the documented recovery test
against a copy. Never repair the live SQLite file manually.

Application rollback is safe only to a version that understands every applied migration. Database
migrations are forward-only; restore a verified pre-deployment backup when an older binary cannot
read the current schema. After recovery, verify create, idempotent replay, read and optimistic update
before reopening traffic.

## Verification

Run the booking draft Playwright scenario, the API unit suite and `pnpm db:recovery-test`. Confirm
that a repeated create returns the original identifier, a stale update returns HTTP 409, an expired
draft returns HTTP 410, and no sensitive payload is present in browser storage or metrics.
