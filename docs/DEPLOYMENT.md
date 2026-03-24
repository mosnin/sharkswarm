# SharkSwarm - Deployment Guide

**Last updated:** 2026-03-24

---

## Overview

SharkSwarm uses a split deployment:
- **Frontend:** Vercel (Next.js dashboard)
- **Backend:** Hetzner VM (Docker Compose - API, agents, Redis, Postgres)

---

## Frontend (Vercel)

### Setup
1. Import the repo to Vercel
2. Set **Root Directory** to `frontend`
3. Set **Framework Preset** to Next.js

### Environment Variables (Vercel Dashboard)
```
NEXT_PUBLIC_API_URL=https://your-hetzner-domain:4000
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
CLERK_SECRET_KEY=sk_...
DATABASE_URL=postgresql://...  (Vercel Postgres)
```

### Build
Vercel runs `npm run build` which executes `prisma generate && next build`.

### Notes
- The `DATABASE_URL` must be set even at build time because API routes that import Prisma are evaluated during static analysis
- If `DATABASE_URL` is not set, the build will fail with `Error: DATABASE_URL is not set`
- Clerk keys must be set for auth middleware to work

---

## Backend (Hetzner VM)

### Prerequisites
- Docker & Docker Compose installed
- Or run `./setup.sh` for automated provisioning

### Setup
```bash
cd backend
cp .env.example .env
# Edit .env with your keys:
#   OPENAI_API_KEY=sk-...
#   CORS_ORIGIN=https://your-vercel-app.vercel.app
#   CLOUDFLARE_TUNNEL_TOKEN=... (optional)

docker compose up -d --build
```

### Services Started
| Service | Port | Health Check |
|---------|------|-------------|
| postgres | 5432 | `pg_isready` |
| redis | 6379 | `redis-cli ping` |
| api | 4000 | `GET /api/health` |
| openclaw-agent-1 | 3000 | HTTP GET /healthz |
| openclaw-agent-2 | 3001 | HTTP GET /healthz |
| redis-bridge | — | Process running |
| scheduler | — | Process running |
| cloudflared | — | Tunnel connected |

### Updating
```bash
cd backend
git pull
docker compose up -d --build
```

### Logs
```bash
docker compose logs -f api          # API gateway
docker compose logs -f openclaw-agent-1  # Agent 1
docker compose logs -f redis-bridge      # Message persistence
```

---

## Connecting Frontend to Backend

The frontend communicates with the backend via `NEXT_PUBLIC_API_URL`. Options:

1. **Direct IP:** `http://your-hetzner-ip:4000` (requires opening port 4000)
2. **Domain + reverse proxy:** Point a domain to the VM, use nginx/caddy to proxy to :4000
3. **Cloudflare Tunnel:** Set `CLOUDFLARE_TUNNEL_TOKEN` in backend `.env`, the `cloudflared` service handles the rest

Set `CORS_ORIGIN` in the backend `.env` to your Vercel domain to allow cross-origin requests.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `DATABASE_URL is not set` on Vercel build | Missing env var | Add `DATABASE_URL` to Vercel project settings |
| `Can't resolve '@/generated/prisma/client'` | Prisma not generated | Ensure build script is `prisma generate && next build` |
| CORS errors in browser | Wrong `CORS_ORIGIN` | Set to your Vercel URL in backend `.env` |
| Agents show offline | Docker containers not running | `docker compose up -d` on Hetzner |
| Chat not streaming | API URL wrong or blocked | Check `NEXT_PUBLIC_API_URL` and firewall rules |
