# Code Standards

## Measured limits

Enforced by ESLint (`eslint.config.mjs`), CI fails on any violation:

- Max 300 lines per file (blank lines and comments excluded).
- Max 100 lines per function (blank lines and comments excluded); unlimited in test files.
- Max cyclomatic complexity 10, cognitive complexity 15.
- Max nesting depth 3, max nested callbacks 3 (5 in test files).
- Max 4 parameters per function, max 20 statements per function.
- Zero lint warnings tolerated (`--max-warnings=0`).
- Unused locals and parameters are compile errors (`tsc`).

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
