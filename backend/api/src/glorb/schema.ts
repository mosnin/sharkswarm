// ── GLORB Schema Initialization ─────────────────────────────────
// Ensures GLORB tables exist (idempotent, runs on API startup)

import { query } from "../db";

export async function initGlorbSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS glorb_missions (
      id              VARCHAR(64)   PRIMARY KEY,
      title           TEXT          NOT NULL,
      objective       TEXT          NOT NULL,
      mission_type    VARCHAR(32)   NOT NULL DEFAULT 'exploration',
      status          VARCHAR(32)   NOT NULL DEFAULT 'draft',
      deadline        TIMESTAMPTZ,
      budget_tokens   BIGINT,
      risk_level      VARCHAR(16)   NOT NULL DEFAULT 'medium',
      quality_bar     VARCHAR(16)   NOT NULL DEFAULT 'standard',
      policy          VARCHAR(64)   NOT NULL DEFAULT 'balanced',
      topology_id     VARCHAR(64),
      result          JSONB,
      error           TEXT,
      started_at      TIMESTAMPTZ,
      completed_at    TIMESTAMPTZ,
      created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
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
      runtime_agent_id  VARCHAR(64),
      status            VARCHAR(32)   NOT NULL DEFAULT 'drafted',
      created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
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
    )
  `);

  await query(`
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
    )
  `);

  await query(`
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
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS glorb_gate_results (
      id              SERIAL        PRIMARY KEY,
      mission_id      VARCHAR(64)   REFERENCES glorb_missions(id) ON DELETE CASCADE,
      gate_type       VARCHAR(32)   NOT NULL,
      status          VARCHAR(16)   NOT NULL DEFAULT 'pending',
      criteria        JSONB         NOT NULL DEFAULT '{}',
      result          JSONB,
      evaluated_by    VARCHAR(64),
      created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    )
  `);

  // Create indexes (IF NOT EXISTS is implicit for CREATE INDEX IF NOT EXISTS)
  await query("CREATE INDEX IF NOT EXISTS idx_glorb_missions_status ON glorb_missions(status)");
  await query("CREATE INDEX IF NOT EXISTS idx_glorb_agent_specs_mission ON glorb_agent_specs(mission_id)");
  await query("CREATE INDEX IF NOT EXISTS idx_glorb_topologies_mission ON glorb_topologies(mission_id)");
  await query("CREATE INDEX IF NOT EXISTS idx_glorb_memory_layer_scope ON glorb_memory(layer, scope_id)");
  await query("CREATE INDEX IF NOT EXISTS idx_glorb_memory_key ON glorb_memory(key)");
  await query("CREATE UNIQUE INDEX IF NOT EXISTS idx_glorb_memory_layer_scope_key ON glorb_memory(layer, scope_id, key)");
  await query("CREATE INDEX IF NOT EXISTS idx_glorb_provenance_mission ON glorb_provenance(mission_id)");
  await query("CREATE INDEX IF NOT EXISTS idx_glorb_gate_results_mission ON glorb_gate_results(mission_id)");

  console.log("GLORB schema initialized");
}
