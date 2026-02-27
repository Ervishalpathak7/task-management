FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/
COPY packages/types/package.json ./packages/types/
RUN npm install --workspace=@task-management/api --workspace=@task-management/types --include-workspace-root

# Build shared types
FROM deps AS types-build
COPY packages/types/ ./packages/types/
COPY tsconfig.base.json ./
RUN npm run build --workspace=@task-management/types

# Build API
FROM types-build AS api-build
COPY apps/api/ ./apps/api/
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma
RUN npm run build --workspace=@task-management/api

# Production
FROM base AS runner
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 fastify

# Copy root node_modules (includes .prisma client + all deps)
COPY --from=api-build /app/node_modules ./node_modules
COPY --from=api-build /app/packages/types/dist ./packages/types/dist
COPY --from=api-build /app/packages/types/package.json ./packages/types/package.json
COPY --from=api-build /app/apps/api/dist ./apps/api/dist
COPY --from=api-build /app/apps/api/package.json ./apps/api/package.json
COPY --from=api-build /app/apps/api/prisma ./apps/api/prisma
COPY --from=api-build /app/package.json ./package.json

USER fastify
WORKDIR /app/apps/api
EXPOSE 3001
CMD ["node", "--require", "./dist/lib/tracer.js", "dist/server.js"]
