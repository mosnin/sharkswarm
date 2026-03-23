-- ================================================================
-- NanoClaw Multi-Agent Schema
-- Auto-applied on first `docker compose up` via Postgres initdb.
-- ================================================================

-- Inter-agent task queue
CREATE TABLE IF NOT EXISTS tasks (
    id          SERIAL PRIMARY KEY,
    from_agent  VARCHAR(64)  NOT NULL,
    to_agent    VARCHAR(64)  NOT NULL,
    message     TEXT         NOT NULL,
    status      VARCHAR(32)  NOT NULL DEFAULT 'pending',
    result      TEXT,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Agent activity logs (surfaced in the dashboard)
CREATE TABLE IF NOT EXISTS agent_logs (
    id          SERIAL PRIMARY KEY,
    agent_id    VARCHAR(64)  NOT NULL,
    level       VARCHAR(16)  NOT NULL DEFAULT 'info',
    message     TEXT         NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Messages exchanged via Redis pub/sub (persisted by the bridge)
CREATE TABLE IF NOT EXISTS messages (
    id          SERIAL PRIMARY KEY,
    from_agent  VARCHAR(64)  NOT NULL,
    to_agent    VARCHAR(64)  NOT NULL,
    channel     VARCHAR(128),
    content     TEXT         NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_to_agent   ON tasks(to_agent);
CREATE INDEX IF NOT EXISTS idx_tasks_status     ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_logs_agent_id    ON agent_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_logs_created     ON agent_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);
