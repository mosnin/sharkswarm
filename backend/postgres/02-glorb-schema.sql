-- ================================================================
-- GLORB Control Plane Schema
-- Sits on top of the existing SharkSwarm runtime layer.
-- ================================================================

-- ── Missions ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS glorb_missions (
    id              VARCHAR(64)   PRIMARY KEY,
    title           TEXT          NOT NULL,
    objective       TEXT          NOT NULL,
    mission_type    VARCHAR(32)   NOT NULL DEFAULT 'exploration',
    status          VARCHAR(32)   NOT NULL DEFAULT 'draft',
    -- Constraints
    deadline        TIMESTAMPTZ,
    budget_tokens   BIGINT,
    risk_level      VARCHAR(16)   NOT NULL DEFAULT 'medium',
    quality_bar     VARCHAR(16)   NOT NULL DEFAULT 'standard',
    -- Policy
    policy          VARCHAR(64)   NOT NULL DEFAULT 'balanced',
    -- Topology
    topology_id     VARCHAR(64),
    -- Results
    result          JSONB,
    error           TEXT,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── Agent Specs (GLORB-managed agent definitions) ───────────────
CREATE TABLE IF NOT EXISTS glorb_agent_specs (
    id                VARCHAR(64)   PRIMARY KEY,
    mission_id        VARCHAR(64)   REFERENCES glorb_missions(id) ON DELETE CASCADE,
    name              VARCHAR(128)  NOT NULL,
    role_type         VARCHAR(32)   NOT NULL,
    purpose           TEXT          NOT NULL,
    scope_in          TEXT,
    scope_out         TEXT,
    capability_profile JSONB        NOT NULL DEFAULT '{}',
    tool_permissions  TEXT[]        NOT NULL DEFAULT '{}',
    memory_scope      VARCHAR(32)   NOT NULL DEFAULT 'mission',
    authority         VARCHAR(16)   NOT NULL DEFAULT 'execute',
    autonomy          VARCHAR(16)   NOT NULL DEFAULT 'checkpoint',
    -- Maps to a real SharkSwarm agent
    runtime_agent_id  VARCHAR(64),
    status            VARCHAR(32)   NOT NULL DEFAULT 'drafted',
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── Topologies (compiled team structures) ───────────────────────
CREATE TABLE IF NOT EXISTS glorb_topologies (
    id              VARCHAR(64)   PRIMARY KEY,
    mission_id      VARCHAR(64)   REFERENCES glorb_missions(id) ON DELETE CASCADE,
    name            VARCHAR(128)  NOT NULL,
    lead_agent_id   VARCHAR(64),
    topology_type   VARCHAR(32)   NOT NULL DEFAULT 'solo',
    config          JSONB         NOT NULL DEFAULT '{}',
    handoff_rules   JSONB         NOT NULL DEFAULT '[]',
    merge_rules     JSONB         NOT NULL DEFAULT '[]',
    quality_gates   JSONB         NOT NULL DEFAULT '[]',
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── Memory Layers ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS glorb_memory (
    id              SERIAL        PRIMARY KEY,
    layer           VARCHAR(16)   NOT NULL,
    scope_id        VARCHAR(64)   NOT NULL,
    key             VARCHAR(256)  NOT NULL,
    content         JSONB         NOT NULL,
    metadata        JSONB         NOT NULL DEFAULT '{}',
    created_by      VARCHAR(64),
    expires_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── Provenance Graph (decision audit trail) ─────────────────────
CREATE TABLE IF NOT EXISTS glorb_provenance (
    id              SERIAL        PRIMARY KEY,
    mission_id      VARCHAR(64)   REFERENCES glorb_missions(id) ON DELETE CASCADE,
    event_type      VARCHAR(32)   NOT NULL,
    agent_id        VARCHAR(64),
    action          TEXT          NOT NULL,
    input           JSONB,
    output          JSONB,
    confidence      REAL,
    reasoning       TEXT,
    parent_id       INTEGER       REFERENCES glorb_provenance(id),
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── Quality Gate Results ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS glorb_gate_results (
    id              SERIAL        PRIMARY KEY,
    mission_id      VARCHAR(64)   REFERENCES glorb_missions(id) ON DELETE CASCADE,
    gate_type       VARCHAR(32)   NOT NULL,
    status          VARCHAR(16)   NOT NULL DEFAULT 'pending',
    criteria        JSONB         NOT NULL DEFAULT '{}',
    result          JSONB,
    evaluated_by    VARCHAR(64),
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── Indexes ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_glorb_missions_status ON glorb_missions(status);
CREATE INDEX IF NOT EXISTS idx_glorb_agent_specs_mission ON glorb_agent_specs(mission_id);
CREATE INDEX IF NOT EXISTS idx_glorb_topologies_mission ON glorb_topologies(mission_id);
CREATE INDEX IF NOT EXISTS idx_glorb_memory_layer_scope ON glorb_memory(layer, scope_id);
CREATE INDEX IF NOT EXISTS idx_glorb_memory_key ON glorb_memory(key);
CREATE UNIQUE INDEX IF NOT EXISTS idx_glorb_memory_layer_scope_key ON glorb_memory(layer, scope_id, key);
CREATE INDEX IF NOT EXISTS idx_glorb_provenance_mission ON glorb_provenance(mission_id);
CREATE INDEX IF NOT EXISTS idx_glorb_provenance_event ON glorb_provenance(event_type);
CREATE INDEX IF NOT EXISTS idx_glorb_gate_results_mission ON glorb_gate_results(mission_id);
