# SharkSwarm - Product Requirements Document

**Last updated:** 2026-03-24
**Status:** Active Development

---

## Vision

SharkSwarm is a multi-agent AI orchestration platform that lets users deploy, manage, and coordinate teams of AI agents through a web dashboard. Agents run on Docker containers powered by OpenClaw and are orchestrated by the GLORB control plane.

## Architecture Overview

| Layer | Technology | Deployment |
|-------|-----------|------------|
| Frontend (Dashboard) | Next.js 15, React 19, Clerk Auth, Prisma 7, Tailwind CSS | Vercel |
| API Gateway | Express 4, TypeScript, Dockerode, ioredis | Hetzner VM (Docker) |
| Agent Runtime | OpenClaw (containerized) | Hetzner VM (Docker) |
| Control Plane | GLORB (missions, topologies, memory, provenance) | Hetzner VM (Docker) |
| Message Bus | Redis 7 pub/sub | Hetzner VM (Docker) |
| Database | PostgreSQL 16 | Hetzner VM (Docker) |
| Tunnel (optional) | Cloudflare Tunnel | Hetzner VM (Docker) |

**Split deployment:** The frontend is a standalone Next.js app deployed to Vercel. Everything else (API, agents, Redis, Postgres, scheduler, redis-bridge) runs on a Hetzner VM via `docker-compose`. The frontend talks to the backend API via `NEXT_PUBLIC_API_URL`.

## Core Concepts

### Agents
Individual AI instances running in Docker containers. Each agent has:
- A name, model configuration, and system prompt
- Tool permissions and integration bindings
- A persistent workspace volume
- A Redis inbox for receiving messages

### GLORB Control Plane
The orchestration layer that compiles and executes multi-agent missions:
- **Missions** define an objective, type, risk level, quality bar, and token budget
- **Topologies** define team structure (solo, pair, pipeline, swarm, hierarchy, ring)
- **Roles** define agent specializations (strategist, architect, builder, researcher, critic, etc.)
- **Quality Gates** enforce standards at checkpoints (context sufficiency, architecture coherence, shipping readiness)
- **Memory** is multi-layered (working, session, mission, project, reusable, archived)
- **Provenance** tracks every decision, handoff, and gate evaluation for auditability

### Integrations
External tools and services that agents can use:
- **API Tools** - REST endpoints with authentication
- **MCP Servers** - Model Context Protocol servers for structured tool access

## Users & Auth

- **Authentication:** Clerk (email, OAuth)
- **Multi-tenancy:** Organizations with role-based access (member, manager, admin, owner)
- **Plans:** free, starter, pro, enterprise (via Stripe subscriptions)

## Functional Requirements

### P0 - Must Have (Core Loop)
- [x] Create and configure agents (name, model, system prompt, tools)
- [x] Chat with individual agents (streaming responses)
- [x] Create GLORB missions with objectives and constraints
- [x] Compile missions into topologies with agent specs
- [x] Execute missions (spawn agents, send briefings, monitor)
- [x] Pause, resume, complete, and abort missions
- [x] View mission provenance trail
- [x] Inter-agent messaging via Redis pub/sub
- [x] Task queue (create, assign, track status)
- [x] System health monitoring (agent status, infra health, latency)
- [x] Agent log viewer with filtering
- [x] Clerk authentication (sign-in, sign-up, protected routes)

### P1 - Should Have
- [x] Integration management (API tools, MCP servers)
- [x] Integration binding to agents
- [ ] Schedules page - manage cron schedules from UI (backend scheduler exists)
- [ ] Settings page - user/org preferences
- [ ] Dashboard page - overview metrics and activity feed
- [ ] Onboarding flow - guided setup for new users

### P2 - Nice to Have
- [ ] Skills page - reusable agent skill definitions
- [ ] Models page - model registry and configuration
- [ ] Channels page - pub/sub channel management
- [ ] Agent cloning/templates
- [ ] Mission templates
- [ ] Webhook integrations
- [ ] Usage analytics and billing (Prisma schema exists, UI does not)

### P3 - Future
- [ ] Multi-VM agent deployment
- [ ] Agent marketplace
- [ ] Custom topology designer
- [ ] Real-time collaboration (multiple users watching a mission)
- [ ] Mobile app

## Non-Functional Requirements

- **Latency:** Agent chat responses should begin streaming within 2 seconds
- **Availability:** Backend services must have Docker health checks and auto-restart
- **Security:** All API routes behind Clerk auth middleware; CORS restricted to Vercel domain
- **Observability:** All agent actions logged to PostgreSQL; GLORB provenance for audit trail
- **Data:** PostgreSQL with persistent Docker volumes; no data loss on container restart

## Database Schema

### Backend (PostgreSQL - raw SQL)
- `tasks` - Inter-agent task queue
- `agent_logs` - Agent activity logs
- `messages` - Persisted Redis messages
- `schedules` - Cron schedules
- `agent_registry` - Agent configurations
- `glorb_missions` - Mission definitions
- `glorb_agent_specs` - Agent specs per mission
- `glorb_topologies` - Compiled team structures
- `glorb_memory` - Multi-layer memory store
- `glorb_provenance` - Decision audit trail
- `glorb_gate_results` - Quality gate evaluations

### Frontend (Prisma - Vercel Postgres)
- `User`, `Organization`, `Membership` - Multi-tenant auth
- `Subscription` - Stripe billing
- `Settings` - Org preferences
- `Integration` - OAuth connections
- `UsageEvent`, `AnalyticsSummary` - Analytics
- `AdminRecord` - Audit trail

## Tech Stack

| Category | Technology | Version |
|----------|-----------|---------|
| Frontend Framework | Next.js | 15.5 |
| UI Library | React | 19 |
| Auth | Clerk | 7 |
| ORM | Prisma | 7.5 |
| CSS | Tailwind CSS | 3.4 |
| Icons | Lucide React | 1.0 |
| Backend Framework | Express | 4.21 |
| Agent Runtime | OpenClaw | latest |
| Database | PostgreSQL | 16 |
| Message Bus | Redis | 7 |
| Container Orchestration | Docker Compose | latest |
| Language | TypeScript | 5.6-5.7 |
| Agent LLMs | GPT-4.1, o3, o4-mini | — |

## Key Decisions

1. **Split deployment (Vercel + Hetzner):** Frontend on Vercel for edge performance and easy deploys. Backend on Hetzner for Docker support, GPU access, and cost efficiency.
2. **OpenClaw as agent runtime:** Provides a battle-tested agent framework with tool use, memory, and multi-model support.
3. **GLORB for orchestration:** Custom control plane that handles mission compilation, topology planning, and multi-agent coordination.
4. **Redis for messaging:** Low-latency pub/sub between agents and dashboard. Messages persisted to Postgres via bridge daemon.
5. **Two databases:** Backend Postgres (via docker-compose) for agent/mission data. Frontend Prisma (Vercel Postgres) for SaaS/auth data. Keeps deployment concerns separated.
6. **Clerk for auth:** Handles sign-up, sign-in, organizations, and RBAC without custom auth code.
