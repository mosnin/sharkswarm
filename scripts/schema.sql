-- OpenClaw Multi-Agent Schema
-- Automatically loaded by Postgres on first startup

BEGIN;

-- Tasks: persistent inter-agent task queue
CREATE TABLE IF NOT EXISTS tasks (
    id            SERIAL PRIMARY KEY,
    from_agent    VARCHAR(50)  NOT NULL,
    to_agent      VARCHAR(50)  NOT NULL,
    message       TEXT         NOT NULL,
    status        VARCHAR(20)  NOT NULL DEFAULT 'pending',
    result        TEXT,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tasks_to_agent_status ON tasks (to_agent, status);

-- Messages: log of all inter-agent communications
CREATE TABLE IF NOT EXISTS messages (
    id            SERIAL PRIMARY KEY,
    from_agent    VARCHAR(50)  NOT NULL,
    to_agent      VARCHAR(50)  NOT NULL,
    channel       VARCHAR(100),
    content       TEXT         NOT NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_created ON messages (created_at DESC);

-- Agent logs: general operational logs surfaced in the dashboard
CREATE TABLE IF NOT EXISTS agent_logs (
    id            SERIAL PRIMARY KEY,
    agent_id      VARCHAR(50)  NOT NULL,
    level         VARCHAR(10)  NOT NULL DEFAULT 'info',
    message       TEXT         NOT NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agent_logs_agent ON agent_logs (agent_id, created_at DESC);

COMMIT;
