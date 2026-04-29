# Deployment Guide

Production deployment instructions for **The Autonomous AI Startup Architecture** (Mission Control).

---

## Prerequisites

| Requirement | Version |
|-------------|---------|
| Node.js     | ≥ 20.0  |
| pnpm        | ≥ 9.0   |
| Docker      | ≥ 24.0 (for Docker deployment) |
| Docker Compose | ≥ 2.20 (for Docker deployment) |

---

## Option 1: Local Deployment (No Docker)

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your settings
```

Key variables:
- `AUTH_USER` / `AUTH_PASS` – Dashboard authentication
- `DATABASE_PATH` – SQLite database path (default: `.data/startup.db`)
- `OPENCLAW_GATEWAY_HOST` / `OPENCLAW_GATEWAY_PORT` – OpenClaw connection

### 3. Run Database Migrations

```bash
pnpm db:migrate
```

### 4. Build & Start

```bash
pnpm build
pnpm start
```

The app will be available at `http://localhost:3000`.

> **Note:** For production, set `HOSTNAME=0.0.0.0` to bind to all interfaces (required for VPS/remote access).

### 5. Running with PM2 (Recommended for VPS)

```bash
npm install -g pm2

# Start with PM2
HOSTNAME=0.0.0.0 pm2 start node --name "mission-control" -- .next/standalone/server.js

# Auto-restart on reboot
pm2 startup
pm2 save
```

---

## Option 2: Docker Deployment (Recommended)

### Quick Start

```bash
# Build and start
docker compose up -d

# View logs
docker compose logs -f

# Stop
docker compose down
```

The app will be available at `http://localhost:3000`.

### Configuration

Create a `.env` file (or set environment variables):

```env
# Authentication
AUTH_USER=admin
AUTH_PASS=your-secure-password

# Optional: OpenClaw Gateway
OPENCLAW_GATEWAY_HOST=your-gateway-host
OPENCLAW_GATEWAY_PORT=18789
OPENCLAW_GATEWAY_TOKEN=your-token

# Optional: AI Models
DEFAULT_MODEL=claude-3-opus
FALLBACK_MODEL=claude-3-sonnet

# Optional: Custom port mapping
PORT=3000
```

### Database Persistence

The SQLite database is stored in a Docker named volume (`app-data`), which persists across container restarts and rebuilds.

To backup the database:
```bash
# Find the volume location
docker volume inspect autonomous_ai_startup_app-data

# Or copy from the running container
docker cp mission-control:/app/.data/startup.db ./backup-startup.db
```

To restore:
```bash
docker cp ./backup-startup.db mission-control:/app/.data/startup.db
docker compose restart
```

### Rebuilding

```bash
# Rebuild after code changes
docker compose up -d --build

# Full clean rebuild
docker compose down
docker compose build --no-cache
docker compose up -d
```

---

## Option 3: Full Stack (UI + Python Orchestration)

If you also need the Python orchestration layer:

```bash
docker compose -f docker-compose.full.yml up -d
```

This starts both:
- **Mission Control UI** on port `3000`
- **Orchestration Layer** on port `9090`

---

## VPS Deployment

### Using Docker (Recommended)

1. **SSH into your VPS** and clone the repository:
   ```bash
   git clone https://github.com/vigourpt/The-Autonomous-AI-Startup-Architecture.git
   cd The-Autonomous-AI-Startup-Architecture
   ```

2. **Create environment file:**
   ```bash
   cp .env.example .env
   nano .env  # Set AUTH_USER, AUTH_PASS, etc.
   ```

3. **Start with Docker Compose:**
   ```bash
   docker compose up -d
   ```

4. **Set up a reverse proxy** (Nginx example):
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

5. **Enable HTTPS** with Let's Encrypt:
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com
   ```

### Without Docker

Follow [Option 1](#option-1-local-deployment-no-docker) and use PM2 for process management.

---

## Architecture Notes

- **Standalone build**: Next.js compiles to a self-contained `server.js` with only the required `node_modules`, resulting in a much smaller deployment footprint.
- **SQLite**: The database file lives in `.data/startup.db`. In Docker, this is mounted as a named volume for persistence.
- **HOSTNAME=0.0.0.0**: Required for the Next.js server to accept connections from outside the container (or from other machines on a VPS).

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `better-sqlite3` build fails | Ensure `python3`, `make`, `g++` are installed (Alpine: `apk add python3 make g++`) |
| App not accessible on VPS | Check `HOSTNAME=0.0.0.0` is set; check firewall allows port 3000 |
| Database locked errors | Ensure only one instance is running; WAL mode is enabled by default |
| Container won't start | Check logs: `docker compose logs app` |
| Port already in use | Change port mapping: `PORT=8080 docker compose up -d` |
