# Security Standards

## Baseline

- Zero secrets in Git.
- Least privilege for every service.
- Authentication and authorization are separate concerns.
- Authorization must be enforced server-side.
- All write operations are auditable.
- PII access must be logged and justified.

## Web and mobile

- Use secure storage for tokens on mobile.
- Browser authentication endpoints return user data only; the JWT remains exclusively in an
  HttpOnly, SameSite cookie and never enters React state.
- Use short-lived access tokens.
- Rotate refresh tokens.
- Access tokens expire after 15 minutes. Refresh tokens are opaque, hashed at rest,
  expire after 30 days, and rotate atomically on every use.
- Reusing a rotated refresh token revokes its session family. Logout and password
  changes revoke server-side sessions immediately.
- Browser credentials remain in `HttpOnly`, `SameSite=Strict` cookies; JavaScript
  never receives the web refresh token. Native clients use the platform secure store.
- Validate deep links.
- Apply CSRF protection where browser cookies are used.
- Web responses enforce CSP, frame isolation, MIME sniffing protection, a restricted permissions
  policy and production HSTS. New external resource origins require an explicit CSP review.

## Backend

- Rate-limit public endpoints.
- Login endpoints share a stricter five-attempts-per-minute budget keyed by normalized identifier
  and client IP, with a machine-readable 429 response and `Retry-After`.
- Unknown identifiers and malformed stored hashes execute the same bounded scrypt verification path
  as ordinary password failures to reduce account-enumeration timing signals.
- Password changes atomically increment a persisted session version: every previously issued JWT is
  rejected, while the initiating browser receives a rotated HttpOnly cookie.
- Administrative password and role changes apply the same revocation invariant and password policy.
- Dossier reads and ticket-control writes require `EMPLOYEE` or `ADMIN`; the verified session is
  always the source of the operator identity.
- Validate all inputs.
- Sanitize logs.
- Use timeouts for all network calls.
- Keep dependencies patched.
