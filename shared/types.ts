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

// ── GLORB Control Plane Types ──────────────────────────────────

export type GlorbMissionType =
  | "exploration" | "decision" | "design" | "build"
  | "audit" | "negotiation" | "synthesis" | "execution";

export type GlorbMissionStatus =
  | "draft" | "compiling" | "ready" | "active"
  | "paused" | "completed" | "failed" | "aborted";

export type GlorbRoleType =
  | "strategist" | "architect" | "builder" | "researcher"
  | "critic" | "router" | "synthesizer" | "verifier"
  | "reviewer" | "memory_manager" | "operator";

export type GlorbTopologyType =
  | "solo" | "pair" | "pipeline" | "swarm" | "hierarchy" | "ring";

export interface GlorbMission {
  id: string;
  title: string;
  objective: string;
  mission_type: GlorbMissionType;
  status: GlorbMissionStatus;
  deadline?: string;
  budget_tokens?: number;
  risk_level: string;
  quality_bar: string;
  policy: string;
  topology_id?: string;
  result?: unknown;
  error?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface GlorbAgentSpec {
  id: string;
  mission_id: string;
  name: string;
  role_type: GlorbRoleType;
  purpose: string;
  capability_profile: Record<string, number>;
  tool_permissions: string[];
  authority: string;
  autonomy: string;
  runtime_agent_id?: string;
  status: string;
  created_at: string;
}

export interface GlorbTopology {
  id: string;
  mission_id: string;
  name: string;
  lead_agent_id?: string;
  topology_type: GlorbTopologyType;
  handoff_rules: Array<{ from: string; to: string; trigger: string }>;
  merge_rules: Array<{ agents: string[]; priority: string; strategy: string }>;
  quality_gates: Array<{ type: string; position: string; criteria: Record<string, unknown> }>;
  created_at: string;
}

export interface GlorbProvenance {
  id: number;
  mission_id: string;
  event_type: string;
  agent_id?: string;
  action: string;
  input?: unknown;
  output?: unknown;
  confidence?: number;
  reasoning?: string;
  created_at: string;
}

export interface GlorbGateResult {
  id: number;
  mission_id: string;
  gate_type: string;
  status: "pending" | "passed" | "failed" | "overridden";
  criteria: Record<string, unknown>;
  result?: unknown;
  evaluated_by?: string;
  created_at: string;
}

export interface GlorbMissionFull {
  mission: GlorbMission;
  topology?: GlorbTopology;
  agents: GlorbAgentSpec[];
  gates: GlorbGateResult[];
  provenance: GlorbProvenance[];
}
