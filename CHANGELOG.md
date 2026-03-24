# Changelog

All notable changes to SharkSwarm will be documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

### Fixed
- Add `prisma generate` to `npm run build` script so Vercel builds succeed
- Add `prisma generate` to frontend Dockerfile for Docker-based builds
- Copy `package-lock.json` in Dockerfile and use `npm ci` for reproducible installs

---

## [0.1.0] - 2026-03-24

Initial working version of SharkSwarm with split Vercel/Hetzner deployment.

### Added

**Frontend (Vercel)**
- Next.js 15 dashboard with Tailwind CSS and dark/light theme
- Clerk authentication (sign-in, sign-up, protected routes)
- Agent list with online/offline status indicators
- Agent config editor (name, model, system prompt, tools)
- Agent chat interface with streaming responses (EventSource)
- Integration management UI (API tools, MCP servers)
- Integration binding to agents
- GLORB mission creation, lifecycle controls, topology preview, provenance trail
- Task queue viewer and creator
- Inter-agent message history
- Agent log viewer with filtering (agent, level, timestamp)
- System health dashboard (Postgres, Redis, agent heartbeats, latency, task counts)
- Sidebar navigation and responsive layout
- Prisma 7 schema for multi-tenant SaaS (users, orgs, memberships, subscriptions)
- Stub pages for: skills, models, channels, schedules, settings, onboarding, dashboard

**Backend (Hetzner Docker)**
- Express API gateway (port 4000) with full CRUD for agents, tasks, messages, logs
- Docker agent spawning via Dockerode
- GLORB control plane: missions, topologies, agent specs, memory, provenance, quality gates
- Mission lifecycle: draft -> compile -> execute -> pause/resume -> complete/abort
- Routing engine for topology and role decisions
- Multi-layer memory system (working, session, mission, project, reusable, archived)
- Redis pub/sub for inter-agent messaging
- Redis bridge daemon (Python) for message persistence to Postgres
- Cron scheduler service for scheduled agent messages
- PostgreSQL schema with GLORB tables
- Pre-configured agent instances (agent1, agent2) with OpenClaw
- Cloudflare Tunnel service (optional)
- Docker Compose orchestration for all services
- Health checks on all containers
- Setup script (`setup.sh`) for one-click VM provisioning

**Shared**
- TypeScript type definitions (3600+ lines) shared between frontend and backend
