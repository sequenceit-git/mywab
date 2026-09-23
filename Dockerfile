# syntax=docker/dockerfile:1

# 1. Base Node alpine image
FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

# 2. Dependencies stage
FROM base AS deps
COPY package.json package-lock.json* ./
COPY scripts ./scripts
RUN npm ci || npm install

# 3. Builder stage
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Environment variables needed at build time
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV WS_NO_BUFFER_UTIL=1
ENV WS_NO_UTF_8_VALIDATE=1

RUN npm run build

# 4. Production Runner stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV WS_NO_BUFFER_UTIL=1
ENV WS_NO_UTF_8_VALIDATE=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy public assets & static output
COPY --from=builder /app/public ./public

# Set correct permissions for Next.js prerender cache and Baileys session storage
RUN mkdir -p .next /app/baileys_auth
RUN chown -R nextjs:nodejs .next /app/baileys_auth

# Copy standalone build output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
