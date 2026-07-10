# Frontend Standards

## Next.js

- Server/client boundaries must be intentional.
- Do not call internal services from browser code.
- Keep page modules thin.
- Fetch through typed clients or server-side BFF functions.

## React Native

- Keep native-only behavior behind adapters.
- Design for offline access to critical travel documents.
- Do not put secrets in the app bundle.
- Validate deep links and external inputs.

## UI

- The base font is Inter.
- The base palette is `#000000`, `#FFFFFF` and `#D3222A`.
- Shared UI primitives live in `packages/ui`.
- Product flows stay inside the app that owns them.
- Accessibility is part of the feature, not a follow-up.
- Production browser tests enforce delivery budgets for JavaScript, total transferred bytes,
  requests, DOM size and DOMContentLoaded.
