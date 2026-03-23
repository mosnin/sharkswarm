# SharkSwarm — Multi-Agent NanoClaw on Docker

Run multiple [NanoClaw](https://github.com/qwibitai/nanoclaw) AI agents on a single VM with inter-agent communication and a web dashboard.

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                   Docker Network                     │
│                  (nanoclaw-net)                       │
│                                                      │
│  ┌─────────────┐  ┌─────────────┐                    │
│  │  Agent Alpha │  │  Agent Beta │   ← NanoClaw      │
│  │  :3000       │  │  :3001      │     containers    │
│  └──────┬───────┘  └──────┬──────┘                    │
│         │    Redis pub/sub │                          │
│         └────────┬─────────┘                          │
│            ┌─────┴─────┐                              │
│            │   Redis    │  ← message bus              │
│            │   :6379    │                              │
│            └───────────┘                              │
│            ┌───────────┐                              │
│            │  Postgres  │  ← tasks & logs             │
│            │   :5432    │                              │
│            └───────────┘                              │
│         ┌──────────────┐                              │
│         │ Redis Bridge  │  ← pub/sub → Postgres       │
│         └──────────────┘                              │
│            ┌───────────┐                              │
│            │  Frontend  │  ← Next.js dashboard        │
│            │   :3002    │                              │
│            └───────────┘                              │
└──────────────────────────────────────────────────────┘
```

## Quick Start

```bash
# 1. Clone this repo
git clone <repo-url> && cd sharkswarm

# 2. Run setup (installs Docker, clones NanoClaw, creates .env)
chmod +x setup.sh
./setup.sh

# 3. Edit your API keys
nano backend/.env

# 4. Re-run setup to start the stack
./setup.sh
```

Or manually:

```bash
cd backend
cp .env.example .env
# Edit .env with your API keys
git clone https://github.com/qwibitai/nanoclaw.git
docker compose up -d --build
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| `nanoclaw-agent-1` | 3000 | Agent Alpha (primary) |
| `nanoclaw-agent-2` | 3001 | Agent Beta (secondary) |
| `frontend` | 3002 | Web dashboard |
| `redis-bridge` | — | Relays Redis pub/sub messages to Postgres |
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
│   ├── docker-compose.yml          # Service definitions
│   ├── .env.example                # Environment template
│   ├── nanoclaw/                   # Cloned NanoClaw repo (git ignored)
│   ├── agent1/
│   │   ├── .env                    # Agent-specific config
│   │   └── CLAUDE.md               # Agent personality & instructions
│   ├── agent2/
│   │   ├── .env
│   │   └── CLAUDE.md
│   ├── redis-pubsub/
│   │   ├── redis_pubsub.py         # Bridge daemon
│   │   ├── requirements.txt
│   │   └── Dockerfile
│   └── postgres/
│       └── schema.sql              # Auto-loaded on first boot
├── frontend/                       # Next.js dashboard
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── app/
│       │   ├── page.tsx            # Agent list dashboard
│       │   ├── messages/page.tsx   # Send & view messages
│       │   ├── logs/page.tsx       # Agent activity logs
│       │   └── api/                # API routes
│       ├── components/             # React components
│       └── lib/                    # DB, Redis, agent config
└── shared/
    └── types.ts                    # Shared TypeScript types
```

## Inter-Agent Communication

Three patterns are available:

### 1. Redis Pub/Sub (real-time)

Channel pattern: `agent:{agentId}:inbox`

The `redis-bridge` service listens to all agent channels and persists messages to Postgres automatically.

```python
# Example: publish from Python
from redis_pubsub import publish
publish("agent-1", "agent-2", "Hello from Alpha")
```

### 2. Postgres Tasks (persistent queue)

```sql
-- Create a task for agent-2
INSERT INTO tasks (from_agent, to_agent, message)
VALUES ('agent-1', 'agent-2', 'Analyze this data');

-- Agent-2 picks up pending tasks
SELECT * FROM tasks WHERE to_agent = 'agent-2' AND status = 'pending';

-- Mark complete
UPDATE tasks SET status = 'completed', result = 'Done', updated_at = NOW()
WHERE id = 1;
```

### 3. Direct HTTP (synchronous)

From within the Docker network, agents can call each other directly:

```bash
curl http://nanoclaw-agent-2:3000/
```

## Adding a New Agent

1. Create config directory:
   ```bash
   mkdir -p backend/agent3/{workspace,memory}
   ```

2. Create agent config files:
   ```bash
   cp backend/agent1/.env backend/agent3/.env
   cp backend/agent1/CLAUDE.md backend/agent3/CLAUDE.md
   # Edit AGENT_ID, AGENT_NAME, and peer references
   ```

3. Add service to `backend/docker-compose.yml`:
   ```yaml
   nanoclaw-agent-3:
     build:
       context: ./nanoclaw
       dockerfile: Dockerfile
     ports:
       - "3003:3000"
     volumes:
       - ./agent3:/app/agent-data
     env_file:
       - ./agent3/.env
     environment:
       ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:-}
       REDIS_URL: redis://redis:6379
       DATABASE_URL: postgresql://${POSTGRES_USER:-nanoclaw}:${POSTGRES_PASSWORD:-changeme}@postgres:5432/${POSTGRES_DB:-nanoclaw}
     networks:
       - nanoclaw-net
     depends_on:
       redis: { condition: service_healthy }
       postgres: { condition: service_healthy }
     restart: unless-stopped
   ```

4. Add to frontend agent list in `frontend/src/lib/agents.ts`.

5. Restart: `cd backend && docker compose up -d --build`

## Common Commands

```bash
# View logs
cd backend && docker compose logs -f
cd backend && docker compose logs -f nanoclaw-agent-1

# Stop everything
cd backend && docker compose down

# Rebuild frontend after changes
cd backend && docker compose up -d --build frontend

# Check container status
cd backend && docker compose ps

# Connect to Postgres
cd backend && docker compose exec postgres psql -U nanoclaw
```
