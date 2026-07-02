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
- Use short-lived access tokens.
- Rotate refresh tokens.
- Validate deep links.
- Apply CSRF protection where browser cookies are used.

## Backend

- Rate-limit public endpoints.
- Validate all inputs.
- Sanitize logs.
- Use timeouts for all network calls.
- Keep dependencies patched.
