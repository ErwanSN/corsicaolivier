# Git Standards

## Branches

- `main` must always be releasable.
- Feature branches should stay short-lived.
- One pull request should carry one product or technical intent.

## Commits

Use Conventional Commits. Examples:

```txt
feat(booking): add search request contract
fix(api): reject expired idempotency keys
security(auth): rotate refresh token family on reuse
```

## Pull requests

Every PR must include:

- summary
- risk
- test evidence
- rollback notes
