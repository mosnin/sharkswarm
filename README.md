# SharkSwarm — Multi-Agent OpenClaw on Docker

Run multiple [OpenClaw](https://github.com/openclaw/openclaw) AI agents on a single VM with inter-agent communication and a web dashboard.

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                   Docker Network                     │
│                  (openclaw-net)                       │
│                                                      │
│  ┌─────────────┐  ┌─────────────┐                    │
│  │  Agent Alpha │  │ Agent Bravo │   ← OpenClaw      │
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
│            ┌───────────┐                              │
│            │  Frontend  │  ← Next.js dashboard        │
│            │   :3002    │                              │
│            └───────────┘                              │
└──────────────────────────────────────────────────────┘
```

## Quick Start

```bash
# 1. Clone this repo
git clone <repo-url> ~/openclaw-infra
cd ~/openclaw-infra

# 2. Configure environment
cp .env.example .env
nano .env   # Add your API keys

# 3. Start everything
chmod +x setup.sh
./setup.sh
```

Or manually:

```bash
docker compose up -d --build
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| `openclaw-agent-1` | 3000 | Agent Alpha (primary) |
| `openclaw-agent-2` | 3001 | Agent Bravo (secondary) |
| `frontend` | 3002 | Web dashboard |
| `postgres` | 5432 | Tasks & message log DB |
| `redis` | 6379 | Pub/sub message bus |

## Inter-Agent Communication

Three patterns are available:

### 1. Redis Pub/Sub (real-time)

```bash
# Send a message from agent-1 to agent-2
python scripts/redis_pubsub.py publish agent-1 agent-2 "Hello from Alpha"

# Listen for messages to agent-1
python scripts/redis_pubsub.py subscribe agent-1

# Run relay (logs all inter-agent messages to Postgres)
python scripts/redis_pubsub.py relay
```

Channel pattern: `agent:{agentId}:inbox`

### 2. Postgres Tasks (persistent queue)

Agents write to the `tasks` table and poll for pending work:

```sql
-- Create a task for agent-2
INSERT INTO tasks (from_agent, to_agent, message) VALUES ('agent-1', 'agent-2', 'Analyze this data');

-- Agent-2 picks up pending tasks
SELECT * FROM tasks WHERE to_agent = 'agent-2' AND status = 'pending';

-- Mark complete
UPDATE tasks SET status = 'completed', result = 'Done', updated_at = NOW() WHERE id = 1;
```

### 3. Direct HTTP (synchronous)

From within the Docker network, agents can call each other directly:

```bash
curl http://openclaw-agent-2:18789/
```

## Adding a New Agent

1. Create config directory:
   ```bash
   mkdir -p openclaw/agent3/{workspace,memory}
   ```

2. Copy and edit config:
   ```bash
   cp openclaw/agent1/openclaw.json openclaw/agent3/openclaw.json
   # Edit agentId, name, description
   ```

3. Add service to `docker-compose.yml`:
   ```yaml
   openclaw-agent-3:
     image: alpine/openclaw:latest
     container_name: openclaw-agent-3
     ports:
       - "3003:18789"
     volumes:
       - ./openclaw/agent3:/home/node/.openclaw
     environment:
       OPENCLAW_CUSTOM_CONFIG: /home/node/.openclaw/openclaw.json
       ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:-}
       REDIS_URL: redis://redis:6379
       DATABASE_URL: postgresql://${POSTGRES_USER:-openclaw}:${POSTGRES_PASSWORD:-changeme}@postgres:5432/${POSTGRES_DB:-openclaw}
     networks:
       - openclaw-net
     depends_on:
       redis:
         condition: service_healthy
       postgres:
         condition: service_healthy
     restart: unless-stopped
   ```

4. Add to frontend agent list in `frontend/src/app/api/agents/route.ts`.

5. Restart: `docker compose up -d`

## Common Commands

```bash
# View logs
docker compose logs -f
docker compose logs -f openclaw-agent-1

# Stop everything
docker compose down

# Rebuild frontend after changes
docker compose up -d --build frontend

# Check container status
docker compose ps

# Connect to Postgres
docker compose exec postgres psql -U openclaw
```

## File Structure

```
├── docker-compose.yml          # Service definitions
├── .env.example                # Environment template
├── setup.sh                    # One-click setup script
├── openclaw/
│   ├── agent1/openclaw.json    # Agent Alpha config
│   └── agent2/openclaw.json    # Agent Bravo config
├── scripts/
│   ├── schema.sql              # Postgres schema (auto-loaded)
│   ├── redis_pubsub.py         # Redis helper script
│   └── requirements.txt        # Python dependencies
└── frontend/                   # Next.js dashboard
    ├── Dockerfile
    ├── package.json
    └── src/
        ├── app/
        │   ├── page.tsx        # Main dashboard page
        │   └── api/            # API routes
        └── components/         # React components
```
