# SharkSwarm — Multi-Agent NanoClaw on Docker

Run multiple [NanoClaw](https://github.com/qwibitai/nanoclaw) AI agents on a single VM with inter-agent communication and a web dashboard.

## Architecture

```
  Vercel                          Hetzner VM
┌──────────┐   HTTPS/REST    ┌────────────────────────────────────┐
│ Frontend │  ──────────────→ │  API Gateway  :4000                │
│ (Next.js)│                  │       │                            │
└──────────┘                  │  ┌────┴────┐                       │
                              │  │  Redis   │  ← message bus       │
                              │  │  :6379   │                       │
                              │  └────┬────┘                       │
                              │       │                            │
                              │  ┌────┴──────┐  ┌──────────────┐   │
                              │  │Agent Alpha│  │  Agent Beta  │   │
                              │  │  :3000    │  │  :3001       │   │
                              │  └───────────┘  └──────────────┘   │
                              │                                    │
                              │  ┌───────────┐  ┌──────────────┐   │
                              │  │ Postgres  │  │ Redis Bridge │   │
                              │  │  :5432    │  │              │   │
                              │  └───────────┘  └──────────────┘   │
                              └────────────────────────────────────┘
```

## Quick Start (Self-Hosted — All on One VM)

```bash
# 1. Clone and setup
git clone <repo-url> && cd sharkswarm
chmod +x setup.sh && ./setup.sh

# 2. Configure
nano backend/.env    # Set ANTHROPIC_API_KEY

# 3. Start
cd backend && docker compose up -d --build
```

Dashboard: `http://localhost:3002` | API: `http://localhost:4000`

## Deployment: Vercel + Hetzner (Split)

### Backend (Hetzner VM)

```bash
# On your Hetzner VM
git clone <repo-url> && cd sharkswarm
chmod +x setup.sh && ./setup.sh

# Edit environment
nano backend/.env
# Set ANTHROPIC_API_KEY=sk-ant-...
# Set CORS_ORIGIN=https://your-app.vercel.app

cd backend && docker compose up -d --build
```

The API gateway runs on port `4000`. Make sure your firewall allows inbound traffic on `:4000` (or put it behind a reverse proxy with TLS).

### Frontend (Vercel)

1. Import the repo in Vercel.
2. Set **Root Directory** to `frontend/`.
3. Add environment variable:
   - `NEXT_PUBLIC_API_URL` = `https://your-hetzner-vm.example.com:4000`
4. Deploy.

## Services

| Service | Port | Description |
|---------|------|-------------|
| `api` | 4000 | API gateway (Express, CORS-enabled) |
| `nanoclaw-agent-1` | 3000 | Agent Alpha (primary) |
| `nanoclaw-agent-2` | 3001 | Agent Beta (secondary) |
| `frontend` | 3002 | Web dashboard (optional in Docker) |
| `redis-bridge` | — | Relays Redis pub/sub to Postgres |
| `postgres` | 5432 | Tasks & message log DB |
| `redis` | 6379 | Pub/sub message bus |

## File Structure

```
sharkswarm/
├── setup.sh                        # One-click setup script
├── README.md
├── modaf/                          # MODAF meta-framework (docs & templates)
│   ├── docs/framework/             # 15-phase SaaS build system
│   └── src/                        # Marketing site template (Next.js)
├── backend/                        # Runs on the Hetzner VM
│   ├── docker-compose.yml          # All services
│   ├── .env.example                # Environment template
│   ├── api/                        # Express API gateway
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── src/
│   │       ├── index.ts            # Routes & CORS
│   │       ├── agents.ts           # Agent config registry
│   │       ├── db.ts               # Postgres pool
│   │       └── redis.ts            # Redis pub/sub
│   ├── nanoclaw/                   # Cloned NanoClaw repo (git ignored)
│   ├── agent1/
│   │   ├── .env                    # Agent-specific config
│   │   └── CLAUDE.md               # Agent personality
│   ├── agent2/
│   │   ├── .env
│   │   └── CLAUDE.md
│   ├── redis-pubsub/               # Bridge daemon
│   └── postgres/
│       └── schema.sql
├── frontend/                       # Next.js dashboard (Vercel-deployable)
│   ├── .env.example                # NEXT_PUBLIC_API_URL
│   ├── Dockerfile                  # For self-hosted Docker
│   ├── package.json                # No pg/ioredis — pure client
│   └── src/
│       ├── app/
│       │   ├── page.tsx            # Dashboard home
│       │   ├── agents/[id]/page.tsx # Agent config editor
│       │   ├── messages/page.tsx   # Send & view messages
│       │   └── logs/page.tsx       # Agent activity logs
│       ├── components/
│       │   ├── AgentList.tsx
│       │   ├── MessageForm.tsx
│       │   └── LogViewer.tsx
│       └── lib/
│           └── api.ts              # fetch() wrapper for API gateway
└── shared/
    └── types.ts                    # Shared TypeScript types
```

## API Endpoints

All served by the API gateway on `:4000`:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/agents` | List agents with status |
| GET | `/api/agents/:id` | Get agent config |
| PUT | `/api/agents/:id` | Update agent config |
| POST | `/api/send-message` | Send message to agent |
| GET | `/api/messages` | Recent messages |
| GET | `/api/logs` | Agent logs |

## Inter-Agent Communication

### 1. Redis Pub/Sub (real-time)
Channel pattern: `agent:{agentId}:inbox`. The `redis-bridge` persists messages to Postgres.

### 2. Postgres Tasks (persistent queue)
```sql
INSERT INTO tasks (from_agent, to_agent, message)
VALUES ('agent-1', 'agent-2', 'Analyze this data');
```

### 3. Direct HTTP (synchronous)
```bash
curl http://nanoclaw-agent-2:3000/
```

## Adding a New Agent

1. Create config: `mkdir backend/agent3 && cp backend/agent1/.env backend/agent3/.env`
2. Edit `AGENT_ID`, `AGENT_NAME` in the new `.env`
3. Add service block to `backend/docker-compose.yml`
4. Add entry to `backend/api/src/agents.ts`
5. Restart: `cd backend && docker compose up -d --build`

## Common Commands

```bash
cd backend

docker compose up -d --build     # Start everything
docker compose logs -f           # All logs
docker compose logs -f api       # API gateway logs
docker compose down              # Stop
docker compose ps                # Status
docker compose exec postgres psql -U nanoclaw  # DB shell
```
