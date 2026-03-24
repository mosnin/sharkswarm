# SharkSwarm - Architecture

**Last updated:** 2026-03-24

---

## Deployment Topology

```
                    ┌──────────────────────┐
                    │       Vercel          │
                    │                       │
                    │  Next.js 15 Dashboard │
                    │  Clerk Auth           │
                    │  Prisma -> Vercel DB  │
                    └──────────┬───────────┘
                               │
                     NEXT_PUBLIC_API_URL
                               │
                    ┌──────────▼───────────┐
                    │    Hetzner VM         │
                    │    (Docker Compose)   │
                    │                       │
                    │  ┌─────────────────┐  │
                    │  │  API Gateway    │  │
                    │  │  Express :4000  │  │
                    │  └───┬────┬────┬──┘  │
                    │      │    │    │      │
                    │  ┌───▼┐ ┌─▼──┐ ┌▼──┐ │
                    │  │Redis│ │ PG │ │Docker│
                    │  │:6379│ │:5432│ │API │ │
                    │  └──┬──┘ └────┘ └─┬─┘ │
                    │     │             │    │
                    │  ┌──▼──────────┐  │   │
                    │  │Redis Bridge │  │   │
                    │  │(Python)     │  │   │
                    │  └─────────────┘  │   │
                    │                   │    │
                    │  ┌────────────────▼┐  │
                    │  │  OpenClaw Agents │  │
                    │  │  (Docker containers)│
                    │  │  agent1 :3000    │  │
                    │  │  agent2 :3001    │  │
                    │  └─────────────────┘  │
                    │                       │
                    │  ┌─────────────────┐  │
                    │  │  Scheduler      │  │
                    │  │  (Node cron)    │  │
                    │  └─────────────────┘  │
                    │                       │
                    │  ┌─────────────────┐  │
                    │  │  Cloudflared    │  │
                    │  │  (optional)     │  │
                    │  └─────────────────┘  │
                    └──────────────────────┘
```

## Data Flow

### Agent Chat
```
User -> Vercel (Next.js) -> API Gateway -> Redis pub/sub -> Agent inbox
Agent response -> Redis pub/sub -> API Gateway (EventSource) -> Browser
Redis Bridge -> persists messages to PostgreSQL
```

### GLORB Mission Execution
```
User creates mission -> API stores in glorb_missions
User compiles -> Engine routes: picks topology, roles, agent count
User executes -> Orchestrator spawns agents, sends briefings via Redis
Agents work -> log provenance events, evaluate quality gates
Mission completes -> results stored, provenance trail preserved
```

### Task Queue
```
User/Agent creates task -> PostgreSQL tasks table
Target agent polls or is notified -> picks up task
Agent completes -> updates task status + result
```

## Two Databases

The project uses **two separate PostgreSQL instances**:

1. **Backend DB** (Docker Compose, Hetzner) - Agent runtime data
   - Managed via raw SQL migrations (`backend/postgres/`)
   - Tables: tasks, agent_logs, messages, schedules, agent_registry, glorb_*

2. **Frontend DB** (Vercel Postgres) - SaaS platform data
   - Managed via Prisma (`frontend/prisma/schema.prisma`)
   - Tables: User, Organization, Membership, Subscription, Settings, etc.

This separation means the backend can run independently of Vercel, and the frontend SaaS layer doesn't depend on the agent infrastructure.

## Key Services

| Service | Language | Role | Port |
|---------|----------|------|------|
| api | TypeScript/Node | API gateway, GLORB control plane | 4000 |
| openclaw-agent-N | TypeScript/Node | AI agent runtime | 3000+ |
| redis | — | Message bus (pub/sub) | 6379 |
| postgres | — | Persistent storage | 5432 |
| redis-bridge | Python | Persists Redis messages to Postgres | — |
| scheduler | TypeScript/Node | Cron job runner | — |
| cloudflared | — | Tunnel to expose services | — |
| frontend | TypeScript/Node | Web dashboard | 3000 |

## Environment Variables

### Backend (`backend/.env`)
- `OPENAI_API_KEY` - For agent LLM calls
- `CORS_ORIGIN` - Vercel domain for CORS
- `POSTGRES_*` - Database credentials
- `REDIS_URL` - Redis connection
- `CLOUDFLARE_TUNNEL_TOKEN` - Optional tunnel auth

### Frontend (`frontend/.env`)
- `NEXT_PUBLIC_API_URL` - Points to Hetzner API gateway
- `NEXT_PUBLIC_CLERK_*` - Clerk auth keys
- `CLERK_SECRET_KEY` - Clerk server key
- `DATABASE_URL` - Vercel Postgres connection string

## Network

All backend services share the `backend_nanoclaw-net` Docker bridge network. Services discover each other by container name (e.g., `redis:6379`, `postgres:5432`).

The frontend on Vercel reaches the backend via the public API URL (either direct IP, domain, or Cloudflare Tunnel).
