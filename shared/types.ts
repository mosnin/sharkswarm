// ── Shared types for the NanoClaw multi-agent dashboard ──────────

export interface AgentConfig {
  id: string;
  name: string;
  internalUrl: string;
  publicUrl: string;
  systemPrompt: string;
  model: string;
  tools: string[];
}

export interface AgentStatus {
  id: string;
  name: string;
  status: "online" | "offline";
  model: string;
  tools: string[];
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
  to_agent: string;
  message: string;
}

export interface SendMessageResponse {
  success: boolean;
}
