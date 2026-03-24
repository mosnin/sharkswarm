// ── Tool Integration Registry ────────────────────────────────────
// Supports two integration types:
//   1. API tools  — custom HTTP endpoints the agent can call
//   2. MCP servers — Model Context Protocol server connections

import { query } from "./db";

export interface ApiTool {
  id: string;
  name: string;
  description: string;
  type: "api";
  method: "GET" | "POST" | "PUT" | "DELETE";
  url: string;
  headers: Record<string, string>;
  bodyTemplate: string; // JSON template with {{placeholders}}
  createdAt: string;
}

export interface McpServer {
  id: string;
  name: string;
  description: string;
  type: "mcp";
  transport: "stdio" | "sse" | "streamable-http";
  // stdio
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  // sse / streamable-http
  url?: string;
  apiKey?: string;
  status: "connected" | "disconnected" | "error";
  tools: string[]; // discovered tool names after connecting
  createdAt: string;
}

export type ToolIntegration = ApiTool | McpServer;

// ── Schema initialisation ───────────────────────────────────────

export async function initIntegrationsSchema(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS integrations (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(128) NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      type VARCHAR(8) NOT NULL,
      config JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS agent_integrations (
      agent_id VARCHAR(64) NOT NULL,
      integration_id VARCHAR(64) NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
      PRIMARY KEY (agent_id, integration_id)
    );
  `);
}

// ── Helpers ─────────────────────────────────────────────────────

interface IntegrationRow {
  id: string;
  name: string;
  description: string;
  type: string;
  config: Record<string, unknown>;
  created_at: string;
}

function rowToIntegration(row: IntegrationRow): ToolIntegration {
  return {
    ...row.config,
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type,
    createdAt: new Date(row.created_at).toISOString(),
  } as ToolIntegration;
}

function integrationToConfig(data: Record<string, unknown>): Record<string, unknown> {
  // Strip top-level columns that live in their own DB columns
  const { id, name, description, type, createdAt, created_at, ...rest } = data as Record<string, unknown>;
  return rest;
}

// ── CRUD ─────────────────────────────────────────────────────────

export async function getAllIntegrations(): Promise<ToolIntegration[]> {
  const rows = await query<IntegrationRow>("SELECT * FROM integrations ORDER BY created_at DESC");
  return rows.map(rowToIntegration);
}

export async function getIntegration(id: string): Promise<ToolIntegration | undefined> {
  const rows = await query<IntegrationRow>("SELECT * FROM integrations WHERE id = $1", [id]);
  return rows.length ? rowToIntegration(rows[0]) : undefined;
}

export async function createIntegration(data: Omit<ToolIntegration, "id" | "createdAt">): Promise<ToolIntegration> {
  const id = `${data.type}-${Date.now().toString(36)}`;
  const full = { ...data } as Record<string, unknown>;
  if (data.type === "mcp") {
    full.status = (full.status as string) || "disconnected";
    full.tools = (full.tools as string[]) || [];
  }
  const config = integrationToConfig(full);
  const rows = await query<IntegrationRow>(
    `INSERT INTO integrations (id, name, description, type, config)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [id, data.name, data.description || "", data.type, JSON.stringify(config)]
  );
  return rowToIntegration(rows[0]);
}

export async function updateIntegration(
  id: string,
  updates: Partial<ToolIntegration>
): Promise<ToolIntegration | undefined> {
  const existing = await getIntegration(id);
  if (!existing) return undefined;

  const merged = { ...existing, ...updates, id, type: existing.type } as Record<string, unknown>;
  const config = integrationToConfig(merged);
  const rows = await query<IntegrationRow>(
    `UPDATE integrations
     SET name = $2, description = $3, config = $4
     WHERE id = $1
     RETURNING *`,
    [id, merged.name as string, (merged.description as string) || "", JSON.stringify(config)]
  );
  return rows.length ? rowToIntegration(rows[0]) : undefined;
}

export async function deleteIntegration(id: string): Promise<boolean> {
  const rows = await query<{ id: string }>("DELETE FROM integrations WHERE id = $1 RETURNING id", [id]);
  return rows.length > 0;
}

// ── Agent ↔ Tool Bindings ────────────────────────────────────────

export async function getAgentIntegrations(agentId: string): Promise<ToolIntegration[]> {
  const rows = await query<IntegrationRow>(
    `SELECT i.* FROM integrations i
     JOIN agent_integrations ai ON ai.integration_id = i.id
     WHERE ai.agent_id = $1
     ORDER BY i.created_at DESC`,
    [agentId]
  );
  return rows.map(rowToIntegration);
}

export async function bindIntegrationToAgent(agentId: string, integrationId: string): Promise<boolean> {
  // Verify integration exists
  const exists = await query<{ id: string }>("SELECT id FROM integrations WHERE id = $1", [integrationId]);
  if (!exists.length) return false;
  await query(
    `INSERT INTO agent_integrations (agent_id, integration_id)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [agentId, integrationId]
  );
  return true;
}

export async function unbindIntegrationFromAgent(agentId: string, integrationId: string): Promise<boolean> {
  const rows = await query<{ agent_id: string }>(
    "DELETE FROM agent_integrations WHERE agent_id = $1 AND integration_id = $2 RETURNING agent_id",
    [agentId, integrationId]
  );
  return rows.length > 0;
}
