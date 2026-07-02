# Security Policy

## Baseline

- No secrets in Git.
- No direct database access from clients.
- No PII in logs.
- All public endpoints require rate limiting and abuse controls.
- All data access must be authorized at the service layer.
- Payment data must remain outside this codebase unless handled through certified providers.

## Reporting

Report vulnerabilities privately to the repository maintainers. Do not open public issues for
security defects.
