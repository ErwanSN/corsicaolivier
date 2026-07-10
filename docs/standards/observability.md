# Observability Standards

## Required signals

- Logs for decisions and failures.
- Metrics for traffic, latency, errors and saturation.
- Traces across frontend, gateway, backend and database calls.

## Rules

- Every request gets a request ID.
- Valid upstream UUID request IDs are propagated through `X-Request-Id`; malformed values are
  replaced before logging.
- API request logs are structured JSON and redact authorization and cookie headers.
- `/api/metrics` exposes Prometheus process and HTTP counters/histograms; HTTP labels use route
  templates to prevent user-controlled cardinality.
- Production metric scraping requires the dedicated `METRICS_TOKEN` Bearer credential.
- Logs must not contain PII, secrets or payment data.
- W3C `traceparent`/`tracestate` context is accepted by the API and propagated by shared clients.
  Structured request logs include the active `traceId` and `spanId`; responses expose
  `X-Trace-Id` for support correlation.
- Node services use OpenTelemetry auto-instrumentation. Local tracing has no exporter by default;
  production exports batched OTLP/HTTP protobuf spans when
  `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` is configured.
- Telemetry SDK shutdown is part of graceful process termination so buffered spans are flushed.
- Alerts must map to user impact.
- Dashboards must track p95 and p99 latency for critical flows.

## Critical flows

- authentication
- booking lookup
- availability search
- payment
- ticket retrieval
- push notifications
