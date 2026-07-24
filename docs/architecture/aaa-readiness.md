# AAA readiness baseline

This document tracks architecture evidence, not aspirations.

| Capability        | Current evidence                                                  | State       | Exit requirement                                 |
| ----------------- | ----------------------------------------------------------------- | ----------- | ------------------------------------------------ |
| Authentication    | Rotating refresh sessions, revocation tests, CSRF and roles       | Ready       | Maintain all security gates                      |
| Booking contracts | Shared Zod draft and quote schemas                                | In progress | Versioned domain modules and contract tests      |
| Booking authority | Expiring drafts, API quotes, idempotent creation and audit events | In progress | Inventory and payment idempotency                |
| Privacy           | HttpOnly auth; booking migration started                          | In progress | Remove PII from browser persistence              |
| Persistence       | SQLite recovery and single-writer guard                           | Limited     | Production database ADR and HA topology          |
| Async work        | Worker lifecycle scaffold                                         | Missing     | Broker ADR, retries, DLQ and job telemetry       |
| Observability     | HTTP metrics, request and trace correlation                       | In progress | Booking/payment SLIs and alerts                  |
| CI/CD             | Parallel gates, cancellation, E2E and bounded load smoke          | In progress | Coverage gates and deployment promotion          |
| Operations        | SQLite recovery runbook                                           | In progress | Booking, payment, incident and rollback runbooks |

## Highest risks

1. Activating payment before inventory and idempotency exist.
2. Treating browser calculations as authoritative.
3. Retaining personal booking data in `localStorage`.
4. Horizontally scaling the SQLite and in-memory rate-limit runtime.
5. Introducing asynchronous workflows without durable delivery semantics.

The goal is not complete while any `Missing` capability remains or a transaction-critical capability
is only `In progress`.
