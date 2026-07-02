# Code Standards

## TypeScript

- Strict mode is mandatory.
- Avoid `any`; use `unknown` at unsafe boundaries.
- Prefer pure functions for domain rules.
- Prefer explicit return types on public functions.
- No implicit cross-package imports.

## Organization

- One module owns one concept.
- Avoid shared dumping grounds.
- Keep naming domain-driven and boring.
- Delete dead code immediately.

## Review bar

Code is not ready when it is only correct locally. It must also be observable, testable,
documented where needed and reversible.
