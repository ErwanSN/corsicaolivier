# API Standards

## Public contract

- Every endpoint must have a documented contract.
- Breaking changes require a new API version.
- Requests and responses must be validated at boundaries.
- Errors must use a stable machine-readable shape.

## HTTP rules

- `GET` is safe and cacheable when documented.
- `POST`, `PUT`, `PATCH` and `DELETE` must be idempotent where business risk requires it.
- Mutation endpoints must accept idempotency keys for payment, booking and ticket flows.
- Pagination is required for unbounded collections.

## Error shape

```json
{
  "code": "BOOKING_NOT_FOUND",
  "message": "Booking not found",
  "requestId": "req_..."
}
```
