# SharkSwarm - Feature Status

**Last updated:** 2026-03-24

## Legend
- **Built** - Fully implemented, frontend + backend
- **Partial** - UI or backend exists but not fully wired
- **Stub** - Page exists with placeholder UI, no functionality
- **Planned** - Not started

---

## Agent Management

| Feature | Status | Frontend | Backend | Notes |
|---------|--------|----------|---------|-------|
| List agents with status | Built | `/agents` sidebar | `GET /api/agents` | Shows online/offline via heartbeat |
| Agent config editor | Built | `/agents/[id]` | `GET/PUT /api/agents/:id` | Name, model, system prompt, tools |
| Create agent | Built | `/agents/[id]` | `POST /api/agents` | Spawns Docker container |
| Delete agent | Built | `/agents/[id]` | `DELETE /api/agents/:id` | Removes container |
| Reset agent | Built | — | `POST /api/agents/:id/reset` | Resets agent state |
| Chat with agent | Built | `/agents/[id]/chat` | Redis pub/sub | Streaming via EventSource |
| Agent cloning/templates | Planned | — | — | — |

## GLORB Missions

| Feature | Status | Frontend | Backend | Notes |
|---------|--------|----------|---------|-------|
| Create mission | Built | `/missions` | `POST /api/glorb/missions` | Title, objective, type, constraints |
| Compile mission | Built | `/missions` | `POST /api/glorb/missions/:id/compile` | Routes to topology + agent specs |
| Execute mission | Built | `/missions` | `POST /api/glorb/missions/:id/execute` | Spawns agents, sends briefings |
| Pause/resume | Built | `/missions` | `POST .../pause`, `.../resume` | — |
| Complete/abort | Built | `/missions` | `POST .../complete`, `.../abort` | — |
| Topology preview | Built | `/missions` | Compiled in engine | Shows team structure |
| Provenance trail | Built | `/missions` | `glorb_provenance` table | Full audit of decisions |
| Quality gates | Built | `/missions` | `glorb_gate_results` table | Override support |
| Multi-layer memory | Built | — | `glorb_memory` table | 6 layers, promote/compress |
| Route preview | Built | `/missions` | `POST /api/glorb/preview/route` | Preview before committing |
| Mission templates | Planned | — | — | — |

## Task Queue

| Feature | Status | Frontend | Backend | Notes |
|---------|--------|----------|---------|-------|
| List tasks | Built | `/tasks` | `GET /api/tasks` | Filter by status/agent |
| Create task | Built | `/tasks` | `POST /api/tasks` | Assign to agent |
| Update task status | Built | — | `PUT /api/tasks/:id` | pending -> in_progress -> completed/failed |

## Messaging

| Feature | Status | Frontend | Backend | Notes |
|---------|--------|----------|---------|-------|
| Send message to agent | Built | Agent chat | `POST /api/send-message` | Via Redis pub/sub |
| Message history | Built | `/messages` | `GET /api/messages` | Persisted by redis-bridge |
| Agent conversation history | Built | `/agents/[id]/chat` | `GET /api/agents/:id/messages` | — |

## Integrations

| Feature | Status | Frontend | Backend | Notes |
|---------|--------|----------|---------|-------|
| List integrations | Built | `/integrations` | `GET /api/integrations` | API tools + MCP servers |
| Create integration | Built | `/integrations` | `POST /api/integrations` | — |
| Update/delete integration | Built | `/integrations` | `PUT/DELETE /api/integrations/:id` | — |
| Bind to agent | Built | `/agents/[id]` | `POST /api/agents/:id/integrations` | — |
| Test integration | Partial | UI present | Needs work | — |
| Integration persistence | Built | — | PostgreSQL storage | Migrated from in-memory Maps |

## Monitoring

| Feature | Status | Frontend | Backend | Notes |
|---------|--------|----------|---------|-------|
| System health | Built | `/health` | `GET /api/health/system` | Postgres, Redis, agent status |
| Agent logs | Built | `/logs` | `GET /api/logs/filtered` | Filter by agent, level, time |
| Heartbeat monitoring | Built | `/health` | Agent heartbeats | Shows latency |

## Stub Pages (UI Only, No Backend)

| Page | Route | Purpose | Priority |
|------|-------|---------|----------|
| Dashboard | `/dashboard` | Overview metrics, activity feed | P1 |
| Schedules | `/schedules` | Manage cron schedules (backend scheduler exists) | P1 |
| Settings | `/settings` | User/org preferences | P1 |
| Onboarding | `/onboarding` | Guided new-user setup | P1 |
| Skills | `/skills` | Reusable agent skill definitions | P2 |
| Models | `/models` | Model registry and configuration | P2 |
| Channels | `/channels` | Pub/sub channel management | P2 |

## Infrastructure

| Feature | Status | Notes |
|---------|--------|-------|
| Docker Compose orchestration | Built | All services with health checks |
| Vercel frontend deployment | Built | Next.js with Prisma |
| Hetzner backend deployment | Built | docker-compose on VM |
| Cloudflare Tunnel | Built | Optional, in docker-compose |
| Setup script | Built | `setup.sh` for VM provisioning |
| API rate limiting | Built | 100 req/min general, 20 req/min writes |
| CI/CD | Planned | — |
| Multi-VM deployment | Planned | — |

## Auth & Multi-tenancy

| Feature | Status | Notes |
|---------|--------|-------|
| Clerk sign-in/sign-up | Built | Email + OAuth |
| Protected routes | Built | Clerk middleware |
| Organizations | Built | Prisma schema, Clerk integration |
| Role-based access | Built | member/manager/admin/owner in schema |
| JWT auth middleware | Built | Optional in dev, required when `AUTH_REQUIRED=true` |
| Stripe subscriptions | Partial | Prisma schema exists, no UI |
| Usage tracking | Partial | Prisma schema exists, no UI |
