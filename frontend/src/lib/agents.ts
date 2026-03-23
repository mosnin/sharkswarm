export interface AgentConfig {
  id: string;
  name: string;
  internalUrl: string;
  publicUrl: string;
}

export const AGENTS: AgentConfig[] = [
  {
    id: "agent-1",
    name: "Agent Alpha",
    internalUrl: process.env.AGENT_1_INTERNAL_URL || "http://nanoclaw-agent-1:3000",
    publicUrl: process.env.NEXT_PUBLIC_AGENT_1_URL || "http://localhost:3000",
  },
  {
    id: "agent-2",
    name: "Agent Beta",
    internalUrl: process.env.AGENT_2_INTERNAL_URL || "http://nanoclaw-agent-2:3000",
    publicUrl: process.env.NEXT_PUBLIC_AGENT_2_URL || "http://localhost:3001",
  },
];
