export interface AgentConfig {
  id: string;
  name: string;
  internalUrl: string;
  publicUrl: string;
  systemPrompt: string;
  model: string;
  tools: string[];
}

// Default agent configs — can be overridden at runtime via PUT
const agentConfigs: Map<string, AgentConfig> = new Map([
  [
    "agent-1",
    {
      id: "agent-1",
      name: "Agent Alpha",
      internalUrl: "http://nanoclaw-agent-1:3000",
      publicUrl: "http://localhost:3000",
      systemPrompt: "You are Agent Alpha, a general-purpose assistant in the SharkSwarm multi-agent system.",
      model: "gpt-4o-mini",
      tools: ["web_search", "code_execution"],
    },
  ],
  [
    "agent-2",
    {
      id: "agent-2",
      name: "Agent Beta",
      internalUrl: "http://nanoclaw-agent-2:3000",
      publicUrl: "http://localhost:3001",
      systemPrompt: "You are Agent Beta, a specialist assistant in the SharkSwarm multi-agent system.",
      model: "gpt-4o-mini",
      tools: ["web_search", "file_read"],
    },
  ],
]);

export function getAgent(id: string): AgentConfig | undefined {
  return agentConfigs.get(id);
}

export function getAllAgents(): AgentConfig[] {
  return Array.from(agentConfigs.values());
}

export function updateAgent(id: string, updates: Partial<AgentConfig>): AgentConfig | undefined {
  const existing = agentConfigs.get(id);
  if (!existing) return undefined;
  const updated = { ...existing, ...updates, id }; // id is immutable
  agentConfigs.set(id, updated);
  return updated;
}
