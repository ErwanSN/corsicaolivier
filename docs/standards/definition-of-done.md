# Definition of Done

A change is done only when:

- The behavior is implemented.
- The contract is documented.
- The risk is understood.
- Tests cover the meaningful path.
- Observability is present for production behavior.
- Security and privacy impact are checked.
- Rollback is possible.
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm e2e` and `pnpm build` pass.
- User-facing pages have no automated WCAG A/AA violation in the supported desktop and mobile
  viewport coverage.
- Production dependencies pass `pnpm audit --prod --audit-level moderate`.
