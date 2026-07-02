# Apps

Deployable runtimes live here. Each app owns its runtime, scripts and framework config.

## Boundaries

- `web`: Next.js web application.
- `mobile`: Expo React Native iOS and Android application.
- `api`: NestJS HTTP API.
- `workers`: asynchronous NestJS worker context.

Apps may import from `packages/*`. Apps must not import from other apps.
