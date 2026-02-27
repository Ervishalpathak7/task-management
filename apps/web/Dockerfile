FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json package-lock.json* ./
COPY apps/web/package.json ./apps/web/
COPY packages/types/package.json ./packages/types/
RUN npm install --workspace=@task-management/web --workspace=@task-management/types --include-workspace-root

# Build shared types
FROM deps AS types-build
COPY packages/types/ ./packages/types/
COPY tsconfig.base.json ./
RUN npm run build --workspace=@task-management/types

# Build web
FROM types-build AS web-build
COPY apps/web/ ./apps/web/
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build --workspace=@task-management/web

# Production
FROM base AS runner
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=web-build /app/apps/web/.next/standalone ./
COPY --from=web-build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=web-build /app/apps/web/public ./apps/web/public 2>/dev/null || true

USER nextjs
WORKDIR /app/apps/web
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
