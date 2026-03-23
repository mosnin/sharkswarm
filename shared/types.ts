// ── Shared types for the NanoClaw multi-agent dashboard ──────────

export interface Agent {
  id: string;
  name: string;
  endpoint: string;        // Internal Docker URL  (http://nanoclaw-agent-1:3000)
  publicEndpoint: string;  // Host-accessible URL  (http://localhost:3000)
  status: "online" | "offline" | "unknown";
}

export interface Task {
  id: number;
  from_agent: string;
  to_agent: string;
  message: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  result: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentLog {
  id: number;
  agent_id: string;
  level: "info" | "warn" | "error" | "debug";
  message: string;
  created_at: string;
}

export interface Message {
  id: number;
  from_agent: string;
  to_agent: string;
  channel: string | null;
  content: string;
  created_at: string;
}

export interface SendMessageRequest {
  from_agent: string;
  to_agent: string;
  message: string;
}

export interface SendMessageResponse {
  success: boolean;
  messageId?: number;
  error?: string;
}

// Agent registry — single source of truth
export const AGENTS: Omit<Agent, "status">[] = [
  {
    id: "agent-1",
    name: "Agent Alpha",
    endpoint: "http://nanoclaw-agent-1:3000",
    publicEndpoint: "http://localhost:3000",
  },
  {
    id: "agent-2",
    name: "Agent Beta",
    endpoint: "http://nanoclaw-agent-2:3000",
    publicEndpoint: "http://localhost:3001",
  },
];
