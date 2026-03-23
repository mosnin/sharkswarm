// ── Tool Integration Registry ────────────────────────────────────
// Supports two integration types:
//   1. API tools  — custom HTTP endpoints the agent can call
//   2. MCP servers — Model Context Protocol server connections

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

// In-memory store — replace with Postgres if you need persistence across restarts
const integrations: Map<string, ToolIntegration> = new Map();

// Seed some examples so the UI isn't empty
const seed: ToolIntegration[] = [
  {
    id: "tool-weather",
    name: "Weather API",
    description: "Get current weather for a location",
    type: "api",
    method: "GET",
    url: "https://api.weatherapi.com/v1/current.json?key={{api_key}}&q={{location}}",
    headers: {},
    bodyTemplate: "",
    createdAt: new Date().toISOString(),
  },
  {
    id: "mcp-filesystem",
    name: "Filesystem MCP",
    description: "Read/write files via MCP filesystem server",
    type: "mcp",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/data"],
    env: {},
    status: "disconnected",
    tools: [],
    createdAt: new Date().toISOString(),
  },
];
seed.forEach((t) => integrations.set(t.id, t));

// ── CRUD ─────────────────────────────────────────────────────────

export function getAllIntegrations(): ToolIntegration[] {
  return Array.from(integrations.values());
}

export function getIntegration(id: string): ToolIntegration | undefined {
  return integrations.get(id);
}

export function createIntegration(data: Omit<ToolIntegration, "id" | "createdAt">): ToolIntegration {
  const id = `${data.type}-${Date.now().toString(36)}`;
  const integration = {
    ...data,
    id,
    createdAt: new Date().toISOString(),
  } as ToolIntegration;
  if (integration.type === "mcp") {
    (integration as McpServer).status = "disconnected";
    (integration as McpServer).tools = (integration as McpServer).tools || [];
  }
  integrations.set(id, integration);
  return integration;
}

export function updateIntegration(
  id: string,
  updates: Partial<ToolIntegration>
): ToolIntegration | undefined {
  const existing = integrations.get(id);
  if (!existing) return undefined;
  const updated = { ...existing, ...updates, id, type: existing.type } as ToolIntegration;
  integrations.set(id, updated);
  return updated;
}

export function deleteIntegration(id: string): boolean {
  return integrations.delete(id);
}

// ── Agent ↔ Tool Bindings ────────────────────────────────────────
// Maps agentId → set of integration ids attached to that agent

const agentBindings: Map<string, Set<string>> = new Map();

export function getAgentIntegrations(agentId: string): ToolIntegration[] {
  const ids = agentBindings.get(agentId);
  if (!ids) return [];
  return Array.from(ids)
    .map((id) => integrations.get(id))
    .filter(Boolean) as ToolIntegration[];
}

export function bindIntegrationToAgent(agentId: string, integrationId: string): boolean {
  if (!integrations.has(integrationId)) return false;
  if (!agentBindings.has(agentId)) agentBindings.set(agentId, new Set());
  agentBindings.get(agentId)!.add(integrationId);
  return true;
}

export function unbindIntegrationFromAgent(agentId: string, integrationId: string): boolean {
  const ids = agentBindings.get(agentId);
  if (!ids) return false;
  return ids.delete(integrationId);
}
