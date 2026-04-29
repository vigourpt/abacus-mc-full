# ============================================
# Dockerfile - Mission Control (Next.js Standalone)
# Production-ready multi-stage build
# ============================================

# ---- Stage 1: Install dependencies ----
FROM node:20-alpine AS deps

# Install build tools for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy dependency manifests
COPY package.json .npmrc* ./

# Install all dependencies (including devDependencies for build)
RUN pnpm install && pnpm approve-builds better-sqlite3

# ---- Stage 2: Build the application ----
FROM node:20-alpine AS builder

# Need build tools for better-sqlite3 rebuild during next build
RUN apk add --no-cache python3 make g++

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy installed dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY package.json .npmrc* ./

# Copy source code
COPY src/ ./src/
COPY public/ ./public/
COPY workspace/ ./workspace/
COPY scripts/ ./scripts/
COPY config/ ./config/
COPY next.config.ts tsconfig.json tailwind.config.ts postcss.config.js ./

# Build Next.js in standalone mode
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# Prepare standalone output:
# - Copy static files into standalone public
# - Copy .next/static into standalone .next/static
# - Create .data directory inside standalone for SQLite
RUN cp -r public .next/standalone/public 2>/dev/null || true
RUN cp -r .next/static .next/standalone/.next/static
RUN mkdir -p .next/standalone/.data
# Copy workspace (agent soul.md files) into standalone
RUN cp -r workspace .next/standalone/workspace
RUN cp -r config .next/standalone/config

# Copy worker.js for task processing
COPY worker.js .next/standalone/worker.js

# ---- Stage 3: Production runner ----
FROM node:20-alpine AS production

# Security: run as non-root
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

WORKDIR /app

# Copy the standalone build (includes node_modules needed at runtime)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

# Ensure .data directory exists with correct ownership
RUN mkdir -p .data && chown -R nextjs:nodejs .data
RUN mkdir -p projects && chown -R nextjs:nodejs projects

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_PATH=.data/startup.db

# Health check for container orchestration
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -q --spider http://localhost:3000/api/system/ready || exit 1

EXPOSE 3000

USER nextjs

# Next.js standalone uses server.js
CMD ["node", "server.js"]
