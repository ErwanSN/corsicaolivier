# syntax=docker/dockerfile:1@sha256:87999aa3d42bdc6bea60565083ee17e86d1f3339802f543c0d03998580f9cb89

FROM node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

FROM base AS deps
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter @corsica/planning-api...

FROM base AS build
WORKDIR /repo
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/api/node_modules ./apps/api/node_modules
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api ./apps/api
# `deploy` creates a self-contained production package. Copying the workspace
# root node_modules would otherwise retain root-only tooling such as the
# Supabase CLI in the runtime image.
RUN pnpm --filter @corsica/planning-api run build \
  && pnpm --filter @corsica/planning-api deploy --prod --legacy /prod/api

FROM base AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV API_PORT=3001
# The service starts directly with `node`; package managers are build-time tools.
# Removing npm/Corepack from the runtime image reduces both attack surface and
# vulnerabilities inherited from the upstream image's bundled npm CLI.
RUN addgroup -g 1001 -S nodejs \
  && adduser -S nestjs -u 1001 -G nodejs \
  && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /opt/yarn-v1.22.22 \
  && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
    /usr/local/bin/pnpm /usr/local/bin/pnpx /usr/local/bin/yarn /usr/local/bin/yarnpkg
COPY --from=build --chown=nestjs:nodejs /prod/api/node_modules ./node_modules
COPY --from=build --chown=nestjs:nodejs /repo/apps/api/dist ./dist
COPY --from=build --chown=nestjs:nodejs /prod/api/package.json ./package.json
USER nestjs
EXPOSE 3001
CMD ["node", "dist/main.js"]
