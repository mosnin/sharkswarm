import { query } from "./db";
import Dockerode from "dockerode";

export interface AgentConfig {
  id: string;
  name: string;
  internalUrl: string;
  publicUrl: string;
  systemPrompt: string;
  model: string;
  tools: string[];
}

export const docker = new Dockerode({ socketPath: "/var/run/docker.sock" });

const NETWORK = process.env.DOCKER_NETWORK || "backend_nanoclaw-net";
const AGENT_IMAGE = process.env.AGENT_IMAGE || "sharkswarm-agent";

// ── Bootstrap DB table ────────────────────────────────────────────
export async function initAgentRegistry() {
  await query(`
    CREATE TABLE IF NOT EXISTS agent_registry (
      id           VARCHAR(64)  PRIMARY KEY,
      name         VARCHAR(128) NOT NULL,
      system_prompt TEXT        NOT NULL DEFAULT '',
      model        VARCHAR(64)  NOT NULL DEFAULT 'gpt-4o-mini',
      tools        TEXT[]       NOT NULL DEFAULT '{}',
      container_id VARCHAR(128),
      created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);

  // Seed defaults if empty
  const existing = await query<{ id: string }>("SELECT id FROM agent_registry");
  if (existing.length === 0) {
    await query(`
      INSERT INTO agent_registry (id, name, system_prompt, model, tools) VALUES
      ('agent-1', 'Agent Alpha', 'You are Agent Alpha, a general-purpose assistant in the SharkSwarm multi-agent system.', 'gpt-4o-mini', ARRAY['web_search','code_execution']),
      ('agent-2', 'Agent Beta',  'You are Agent Beta, a specialist assistant in the SharkSwarm multi-agent system.',        'gpt-4o-mini', ARRAY['web_search','file_read'])
      ON CONFLICT DO NOTHING
    `);
  }
}

// ── CRUD ──────────────────────────────────────────────────────────
export async function getAllAgents(): Promise<AgentConfig[]> {
  const rows = await query<AgentRow>("SELECT * FROM agent_registry ORDER BY created_at");
  return rows.map(rowToConfig);
}

export async function getAgent(id: string): Promise<AgentConfig | undefined> {
  const rows = await query<AgentRow>("SELECT * FROM agent_registry WHERE id = $1", [id]);
  return rows.length ? rowToConfig(rows[0]) : undefined;
}

export async function createAgent(fields: {
  name: string;
  systemPrompt: string;
  model: string;
  tools: string[];
}): Promise<AgentConfig> {
  const id = `agent-${Date.now()}`;
  const containerName = `sharkswarm-agent-${id}`;

  // Start Docker container
  const container = await docker.createContainer({
    Image: AGENT_IMAGE,
    name: containerName,
    Env: [
      `AGENT_ID=${id}`,
      `AGENT_NAME=${fields.name}`,
      `SYSTEM_PROMPT=${fields.systemPrompt}`,
      `OPENAI_API_KEY=${process.env.OPENAI_API_KEY || ""}`,
      `OPENAI_MODEL=${fields.model}`,
      `REDIS_URL=${process.env.REDIS_URL || "redis://redis:6379"}`,
      `DATABASE_URL=${process.env.DATABASE_URL || ""}`,
    ],
    HostConfig: {
      NetworkMode: NETWORK,
      RestartPolicy: { Name: "unless-stopped" as const },
    },
  });
  await container.start();

  const rows = await query<AgentRow>(
    `INSERT INTO agent_registry (id, name, system_prompt, model, tools, container_id)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [id, fields.name, fields.systemPrompt, fields.model, fields.tools, container.id]
  );
  return rowToConfig(rows[0]);
}

export async function updateAgent(id: string, updates: Partial<AgentConfig>): Promise<AgentConfig | undefined> {
  const rows = await query<AgentRow>(
    `UPDATE agent_registry
     SET name = COALESCE($1, name),
         system_prompt = COALESCE($2, system_prompt),
         model = COALESCE($3, model),
         tools = COALESCE($4, tools)
     WHERE id = $5 RETURNING *`,
    [
      updates.name ?? null,
      updates.systemPrompt ?? null,
      updates.model ?? null,
      updates.tools ?? null,
      id,
    ]
  );
  return rows.length ? rowToConfig(rows[0]) : undefined;
}

export async function deleteAgent(id: string): Promise<boolean> {
  const rows = await query<{ container_id: string }>(
    "DELETE FROM agent_registry WHERE id = $1 RETURNING container_id",
    [id]
  );
  if (!rows.length) return false;

  const containerId = rows[0].container_id;
  if (containerId) {
    try {
      const c = docker.getContainer(containerId);
      await c.stop().catch(() => {});
      await c.remove().catch(() => {});
    } catch {
      // container may already be gone
    }
  }

  // Also try by name
  try {
    const c = docker.getContainer(`sharkswarm-agent-${id}`);
    await c.stop().catch(() => {});
    await c.remove().catch(() => {});
  } catch {
    // ignore
  }

  return true;
}

// ── Helpers ───────────────────────────────────────────────────────
interface AgentRow {
  id: string;
  name: string;
  system_prompt: string;
  model: string;
  tools: string[];
  container_id?: string;
}

function rowToConfig(row: AgentRow): AgentConfig {
  const id = row.id as string;
  // Built-in agents use compose service names; dynamic agents use container names
  const isBuiltIn = id === "agent-1" || id === "agent-2";
  const serviceMap: Record<string, string> = {
    "agent-1": "nanoclaw-agent-1",
    "agent-2": "nanoclaw-agent-2",
  };
  const hostname = isBuiltIn ? serviceMap[id] : `sharkswarm-agent-${id}`;

  return {
    id,
    name: row.name,
    internalUrl: `http://${hostname}:3000`,
    publicUrl: "",
    systemPrompt: row.system_prompt || "",
    model: row.model,
    tools: row.tools || [],
  };
}
