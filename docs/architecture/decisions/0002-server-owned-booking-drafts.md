# ADR 0002: Server-owned booking drafts and quotes

## Status

Accepted

## Context

The first reservation prototype stored contact data and calculated prices in the browser. That is
not an acceptable authority boundary for inventory, pricing, personal data or payment.

## Decision

- The API owns booking drafts and quotes.
- Drafts use opaque UUID identifiers, expire after 20 minutes and carry an optimistic version.
- Creation requires an idempotency key bound to a SHA-256 request fingerprint. Concurrent retries
  return the original draft; reusing a key for different input fails with `409 Conflict`.
- Updates require `expectedVersion`; stale writes fail with `409 Conflict`.
- Creation and updates append an audit event in the same database transaction as the state change.
- Inputs and outputs are validated by shared Zod contracts.
- The browser may calculate previews for responsiveness, but only an API quote is authoritative.
- Quotes expose their currency and expiry. Payment may only use a non-expired server quote.
- Card data will never transit through Corsica applications; a tokenized payment provider is
  required before payment activation.

## Current persistence

Drafts are persisted in SQLite for the supported single-instance runtime. The model is deliberately
portable, but production payment activation requires the database topology ADR described in the
architecture roadmap.

## Consequences

- Contact details can move out of browser persistence.
- Concurrent tabs cannot silently overwrite one another.
- Pricing rules now have a server authority boundary.
- Inventory reservation, idempotency keys, audit events and payment intents remain separate future
  increments and are not implied by this ADR.
