# Deployment Guide

This guide documents the **actual deployment options** for `vigourpt/abacus-mc-full`.

## Prerequisites

- Node.js 20+
- pnpm 9+
- Docker 24+ and Docker Compose v2 (for container deployments)

## Option 1: Local (No Docker)

```bash
git clone https://github.com/vigourpt/abacus-mc-full.git
cd abacus-mc-full
pnpm install
cp .env.example .env
pnpm db:migrate
pnpm exec tsx scripts/seed-agents.ts
pnpm build
pnpm start
```

App URL: `http://localhost:3000`

## Option 2: Docker (Primary compose file)

Uses `docker-compose.yml` with:
- `app` (Next.js Mission Control)
- `worker` (Node task worker)

```bash
cp .env.example .env
docker compose up -d --build
docker compose ps
docker compose logs -f
```

Health/readiness checks:
- `GET /api/system/ready` (container healthcheck)
- `GET /api/system/health` (detailed health)

### Persistence

- SQLite data volume: `app-data` mounted at `/app/.data`
- Main DB path: `.data/startup.db`

## Option 3: Full Stack (UI + Python orchestration)

Uses `docker-compose.full.yml` with:
- `mission-control-ui` (Dockerfile.nextjs)
- `orchestration` (Dockerfile.python)

```bash
cp .env.example .env
docker compose -f docker-compose.full.yml up -d --build
docker compose -f docker-compose.full.yml ps
docker compose -f docker-compose.full.yml logs -f
```

Exposed ports:
- `3000` (Mission Control UI)
- `9090` (Python metrics API)

## Environment Variables (Core)

Required in production:
- `AUTH_USER`
- `AUTH_PASS`
- `API_KEY`
- `DATABASE_PATH` (default: `.data/startup.db`)
- `NODE_ENV=production`

OpenClaw integration (if enabled):
- `OPENCLAW_GATEWAY_HOST`
- `OPENCLAW_GATEWAY_PORT` (default in app stack: `45397`)
- `OPENCLAW_GATEWAY_TOKEN`
- `OPENCLAW_CLIENT_ID`
- `OPENCLAW_CLIENT_MODE`
- `NEXT_PUBLIC_OPENCLAW_ORIGIN_URL` (recommended for remote gateway setups)

## API Endpoints for Deployment Verification

```bash
curl http://localhost:3000/api/system/ready
curl http://localhost:3000/api/system/health
curl http://localhost:3000/api/agents
curl http://localhost:3000/api/openclaw/status
```

## Production Notes

- Keep `.data/` on persistent storage.
- For VPS/remote access, set `HOSTNAME=0.0.0.0`.
- If using reverse proxy + TLS, forward WebSocket upgrade headers.
- Vercel is supported for the Next.js app, but persistent SQLite requires external storage strategy.

## Troubleshooting

- `better-sqlite3` build errors: install native build tooling (`python3`, `make`, `g++`).
- App unreachable in containers: verify port mapping and `HOSTNAME=0.0.0.0`.
- OpenClaw handshake issues: confirm Origin/Host settings and gateway token.
- DB lock errors: ensure a single writer process and keep WAL files in persistent volume.
