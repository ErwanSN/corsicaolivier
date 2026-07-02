# Contribution Guide

## Non-negotiable rules

- Keep business logic out of React components and NestJS controllers.
- Keep frontends isolated from databases and internal services.
- Add contracts before adding a new API surface.
- Add tests with every behavior change.
- Add observability for every production path.
- Never commit secrets, generated credentials, dumps or local `.env` files.

## Workflow

1. Create a focused branch.
2. Keep changes scoped to one intent.
3. Run `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build`.
4. Open a PR with risk, test evidence and rollback notes.

## Commit format

Use Conventional Commits:

```txt
feat(scope): add booking search contract
fix(api): handle expired payment intent
security(auth): harden refresh token rotation
```
