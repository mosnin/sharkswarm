// ── GLORB Control Plane Types ────────────────────────────────────

export type MissionType =
  | "exploration"
  | "decision"
  | "design"
  | "build"
  | "audit"
  | "negotiation"
  | "synthesis"
  | "execution";

export type MissionStatus =
  | "draft"
  | "compiling"
  | "ready"
  | "active"
  | "paused"
  | "completed"
  | "failed"
  | "aborted";

export type RiskLevel = "low" | "medium" | "high" | "critical";
export type QualityBar = "minimal" | "standard" | "high" | "maximum";

export type PolicyName =
  | "fastest_acceptable"
  | "highest_rigor"
  | "lowest_cost"
  | "balanced"
  | "high_exploration"
  | "low_hallucination"
  | "human_in_loop"
  | "autonomous";

export type RoleType =
  | "strategist"
  | "architect"
  | "builder"
  | "researcher"
  | "critic"
  | "router"
  | "synthesizer"
  | "verifier"
  | "reviewer"
  | "memory_manager"
  | "operator";

export type Authority = "execute" | "decide" | "direct" | "govern";
export type Autonomy = "supervised" | "checkpoint" | "autonomous" | "full";

export type TopologyType =
  | "solo"
  | "pair"
  | "pipeline"
  | "swarm"
  | "hierarchy"
  | "ring";

export type MemoryLayer =
  | "working"
  | "session"
  | "mission"
  | "project"
  | "reusable"
  | "archived";

export type GateType =
  | "sufficient_context"
  | "architecture_coherence"
  | "implementation_readiness"
  | "factual_confidence"
  | "shipping_readiness";

export type GateStatus = "pending" | "passed" | "failed" | "overridden";

export type ProvenanceEventType =
  | "mission_created"
  | "topology_compiled"
  | "agent_spawned"
  | "agent_retired"
  | "gate_evaluated"
  | "handoff"
  | "decision"
  | "escalation"
  | "memory_write"
  | "deliverable_produced"
  | "error"
  | "human_command";

// ── Core Interfaces ─────────────────────────────────────────────

export interface Mission {
  id: string;
  title: string;
  objective: string;
  mission_type: MissionType;
  status: MissionStatus;
  deadline?: string;
  budget_tokens?: number;
  risk_level: RiskLevel;
  quality_bar: QualityBar;
  policy: PolicyName;
  topology_id?: string;
  result?: unknown;
  error?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CapabilityProfile {
  abstraction_depth: number;   // 1-10
  precision: number;
  creativity: number;
  risk_tolerance: number;
  adversarial_rigor: number;
  synthesis_strength: number;
  tool_access: number;
  autonomy_level: number;
  memory_breadth: number;
  domain_expertise: number;
}

export interface AgentSpec {
  id: string;
  mission_id: string;
  name: string;
  role_type: RoleType;
  purpose: string;
  scope_in?: string;
  scope_out?: string;
  capability_profile: CapabilityProfile;
  tool_permissions: string[];
  memory_scope: MemoryLayer;
  authority: Authority;
  autonomy: Autonomy;
  runtime_agent_id?: string;
  status: string;
  created_at: string;
}

export interface Topology {
  id: string;
  mission_id: string;
  name: string;
  lead_agent_id?: string;
  topology_type: TopologyType;
  config: Record<string, unknown>;
  handoff_rules: HandoffRule[];
  merge_rules: MergeRule[];
  quality_gates: GateConfig[];
  created_at: string;
}

export interface HandoffRule {
  from: string;
  to: string;
  trigger: string;
}

export interface MergeRule {
  agents: string[];
  priority: string;
  strategy: "concat" | "best_of" | "synthesize" | "vote";
}

export interface GateConfig {
  type: GateType;
  position: "before" | "after" | "checkpoint";
  criteria: Record<string, unknown>;
}

export interface MemoryEntry {
  id: number;
  layer: MemoryLayer;
  scope_id: string;
  key: string;
  content: unknown;
  metadata: Record<string, unknown>;
  created_by?: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ProvenanceEntry {
  id: number;
  mission_id: string;
  event_type: ProvenanceEventType;
  agent_id?: string;
  action: string;
  input?: unknown;
  output?: unknown;
  confidence?: number;
  reasoning?: string;
  parent_id?: number;
  created_at: string;
}

export interface GateResult {
  id: number;
  mission_id: string;
  gate_type: GateType;
  status: GateStatus;
  criteria: Record<string, unknown>;
  result?: unknown;
  evaluated_by?: string;
  created_at: string;
}

// ── Constraint Compiler Input ───────────────────────────────────

export interface MissionConstraints {
  deadline?: string;
  budget_tokens?: number;
  risk_level: RiskLevel;
  quality_bar: QualityBar;
}

// ── Router Decision ─────────────────────────────────────────────

export interface RoutingDecision {
  topology_type: TopologyType;
  recommended_roles: RoleType[];
  agent_count: number;
  policy: PolicyName;
  reasoning: string;
}

// ── Compiled Topology Plan ──────────────────────────────────────

export interface TopologyPlan {
  topology_type: TopologyType;
  agents: Array<{
    role_type: RoleType;
    name: string;
    purpose: string;
    capability_profile: CapabilityProfile;
    tool_permissions: string[];
    authority: Authority;
    autonomy: Autonomy;
  }>;
  lead_role: RoleType;
  handoff_rules: HandoffRule[];
  merge_rules: MergeRule[];
  quality_gates: GateConfig[];
}
