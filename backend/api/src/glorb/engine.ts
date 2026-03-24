// ── GLORB Core Engine ────────────────────────────────────────────
// Router, Constraint Compiler, Topology Compiler, Policy Engine

import type {
  MissionType,
  MissionConstraints,
  PolicyName,
  RoutingDecision,
  TopologyPlan,
  TopologyType,
  RoleType,
  CapabilityProfile,
  Authority,
  Autonomy,
  GateType,
  GateConfig,
  HandoffRule,
  MergeRule,
} from "./types";

// ── Specialist Capability Templates ─────────────────────────────

const ROLE_PROFILES: Record<RoleType, CapabilityProfile> = {
  strategist:      { abstraction_depth: 9, precision: 6, creativity: 8, risk_tolerance: 6, adversarial_rigor: 5, synthesis_strength: 8, tool_access: 3, autonomy_level: 7, memory_breadth: 7, domain_expertise: 6 },
  architect:       { abstraction_depth: 8, precision: 8, creativity: 6, risk_tolerance: 4, adversarial_rigor: 6, synthesis_strength: 7, tool_access: 5, autonomy_level: 6, memory_breadth: 6, domain_expertise: 7 },
  builder:         { abstraction_depth: 5, precision: 9, creativity: 4, risk_tolerance: 3, adversarial_rigor: 4, synthesis_strength: 4, tool_access: 9, autonomy_level: 5, memory_breadth: 4, domain_expertise: 7 },
  researcher:      { abstraction_depth: 7, precision: 7, creativity: 6, risk_tolerance: 5, adversarial_rigor: 5, synthesis_strength: 6, tool_access: 7, autonomy_level: 6, memory_breadth: 9, domain_expertise: 5 },
  critic:          { abstraction_depth: 7, precision: 9, creativity: 5, risk_tolerance: 2, adversarial_rigor: 9, synthesis_strength: 4, tool_access: 3, autonomy_level: 4, memory_breadth: 5, domain_expertise: 6 },
  router:          { abstraction_depth: 6, precision: 7, creativity: 4, risk_tolerance: 4, adversarial_rigor: 4, synthesis_strength: 5, tool_access: 3, autonomy_level: 8, memory_breadth: 6, domain_expertise: 4 },
  synthesizer:     { abstraction_depth: 8, precision: 7, creativity: 7, risk_tolerance: 4, adversarial_rigor: 4, synthesis_strength: 9, tool_access: 4, autonomy_level: 5, memory_breadth: 7, domain_expertise: 5 },
  verifier:        { abstraction_depth: 5, precision: 9, creativity: 3, risk_tolerance: 2, adversarial_rigor: 8, synthesis_strength: 3, tool_access: 8, autonomy_level: 4, memory_breadth: 4, domain_expertise: 6 },
  reviewer:        { abstraction_depth: 7, precision: 7, creativity: 5, risk_tolerance: 3, adversarial_rigor: 6, synthesis_strength: 6, tool_access: 4, autonomy_level: 5, memory_breadth: 6, domain_expertise: 7 },
  memory_manager:  { abstraction_depth: 6, precision: 8, creativity: 3, risk_tolerance: 2, adversarial_rigor: 4, synthesis_strength: 5, tool_access: 5, autonomy_level: 4, memory_breadth: 9, domain_expertise: 4 },
  operator:        { abstraction_depth: 6, precision: 8, creativity: 5, risk_tolerance: 5, adversarial_rigor: 5, synthesis_strength: 5, tool_access: 6, autonomy_level: 6, memory_breadth: 5, domain_expertise: 7 },
};

// ── Mission Type → Topology Mapping ─────────────────────────────

const MISSION_TOPOLOGY_MAP: Record<MissionType, {
  topology: TopologyType;
  roles: RoleType[];
  lead: RoleType;
}> = {
  exploration: { topology: "swarm", roles: ["researcher", "researcher", "researcher", "synthesizer"], lead: "synthesizer" },
  decision:    { topology: "pair", roles: ["strategist", "critic"], lead: "strategist" },
  design:      { topology: "pipeline", roles: ["architect", "builder", "critic"], lead: "architect" },
  build:       { topology: "pipeline", roles: ["architect", "builder", "builder", "verifier"], lead: "architect" },
  audit:       { topology: "pipeline", roles: ["verifier", "critic", "reviewer"], lead: "reviewer" },
  negotiation: { topology: "hierarchy", roles: ["strategist", "operator", "verifier"], lead: "strategist" },
  synthesis:   { topology: "swarm", roles: ["researcher", "researcher", "researcher", "synthesizer"], lead: "synthesizer" },
  execution:   { topology: "pipeline", roles: ["architect", "builder", "reviewer"], lead: "architect" },
};

// ── Quality Gate Presets per Mission Type ────────────────────────

const GATE_PRESETS: Record<MissionType, GateConfig[]> = {
  exploration: [
    { type: "sufficient_context", position: "before", criteria: { min_sources: 3 } },
    { type: "factual_confidence", position: "checkpoint", criteria: { min_confidence: 0.7 } },
    { type: "shipping_readiness", position: "after", criteria: { completeness: 0.8 } },
  ],
  decision: [
    { type: "sufficient_context", position: "before", criteria: { options_defined: true } },
    { type: "factual_confidence", position: "checkpoint", criteria: { min_confidence: 0.8 } },
    { type: "shipping_readiness", position: "after", criteria: { recommendation_clear: true } },
  ],
  design: [
    { type: "sufficient_context", position: "before", criteria: { requirements_clear: true } },
    { type: "architecture_coherence", position: "checkpoint", criteria: { consistency_check: true } },
    { type: "shipping_readiness", position: "after", criteria: { implementable: true } },
  ],
  build: [
    { type: "sufficient_context", position: "before", criteria: { spec_available: true } },
    { type: "architecture_coherence", position: "checkpoint", criteria: { consistency_check: true } },
    { type: "implementation_readiness", position: "checkpoint", criteria: { tests_pass: true } },
    { type: "shipping_readiness", position: "after", criteria: { all_checks_pass: true } },
  ],
  audit: [
    { type: "sufficient_context", position: "before", criteria: { target_defined: true } },
    { type: "factual_confidence", position: "checkpoint", criteria: { min_confidence: 0.9 } },
    { type: "shipping_readiness", position: "after", criteria: { findings_documented: true } },
  ],
  negotiation: [
    { type: "sufficient_context", position: "before", criteria: { positions_clear: true } },
    { type: "shipping_readiness", position: "after", criteria: { agreement_reached: true } },
  ],
  synthesis: [
    { type: "sufficient_context", position: "before", criteria: { min_sources: 3 } },
    { type: "factual_confidence", position: "checkpoint", criteria: { min_confidence: 0.7 } },
    { type: "shipping_readiness", position: "after", criteria: { unified_output: true } },
  ],
  execution: [
    { type: "sufficient_context", position: "before", criteria: { plan_defined: true } },
    { type: "implementation_readiness", position: "checkpoint", criteria: { resources_available: true } },
    { type: "shipping_readiness", position: "after", criteria: { all_steps_complete: true } },
  ],
};

// ── Constraint Compiler ─────────────────────────────────────────

export function compileConstraints(
  missionType: MissionType,
  constraints: MissionConstraints
): { policy: PolicyName; maxAgents: number; critiqueIntensity: number } {
  const { risk_level, quality_bar, budget_tokens, deadline } = constraints;

  // Determine policy from constraints
  let policy: PolicyName = "balanced";
  if (deadline && new Date(deadline).getTime() - Date.now() < 3600000) {
    policy = "fastest_acceptable";
  } else if (quality_bar === "maximum") {
    policy = "highest_rigor";
  } else if (risk_level === "critical") {
    policy = "human_in_loop";
  } else if (budget_tokens && budget_tokens < 50000) {
    policy = "lowest_cost";
  }

  // Scale agent count by budget and risk
  let maxAgents = MISSION_TOPOLOGY_MAP[missionType].roles.length;
  if (budget_tokens && budget_tokens < 100000) {
    maxAgents = Math.min(maxAgents, 2);
  }
  if (risk_level === "low") {
    maxAgents = Math.min(maxAgents, 2);
  }

  // Critique intensity scales with quality bar
  const critiqueMap = { minimal: 1, standard: 3, high: 5, maximum: 8 };
  const critiqueIntensity = critiqueMap[quality_bar];

  return { policy, maxAgents, critiqueIntensity };
}

// ── Router ──────────────────────────────────────────────────────

export function routeMission(
  missionType: MissionType,
  objective: string,
  constraints: MissionConstraints
): RoutingDecision {
  const compiled = compileConstraints(missionType, constraints);
  const template = MISSION_TOPOLOGY_MAP[missionType];

  // Trim roles to fit budget constraints
  let roles = [...template.roles];
  if (roles.length > compiled.maxAgents) {
    // Keep lead + trim from end, always keep at least one worker
    const leadIdx = roles.indexOf(template.lead);
    const essential = [template.lead];
    const rest = roles.filter((_, i) => i !== leadIdx);
    roles = [...essential, ...rest.slice(0, compiled.maxAgents - 1)];
  }

  // For solo missions or very tight budgets, collapse to single agent
  let topologyType = template.topology;
  if (roles.length === 1) {
    topologyType = "solo";
  } else if (roles.length === 2) {
    topologyType = "pair";
  }

  const reasoning = [
    `Mission type "${missionType}" maps to ${template.topology} topology.`,
    `Constraints: risk=${constraints.risk_level}, quality=${constraints.quality_bar}, policy=${compiled.policy}.`,
    `Agent count: ${roles.length} (max ${compiled.maxAgents}).`,
    roles.length < template.roles.length ? `Reduced from ${template.roles.length} agents due to budget/risk constraints.` : "",
  ].filter(Boolean).join(" ");

  return {
    topology_type: topologyType,
    recommended_roles: roles,
    agent_count: roles.length,
    policy: compiled.policy,
    reasoning,
  };
}

// ── Topology Compiler ───────────────────────────────────────────

export function compileTopology(
  missionType: MissionType,
  routing: RoutingDecision,
  objective: string
): TopologyPlan {
  const template = MISSION_TOPOLOGY_MAP[missionType];

  // Build agent specs from roles
  const agents = routing.recommended_roles.map((role, idx) => {
    const suffix = routing.recommended_roles.filter((r, i) => r === role && i <= idx).length;
    const name = suffix > 1 ? `${role}_${suffix}` : role;

    return {
      role_type: role,
      name,
      purpose: generatePurpose(role, missionType, objective),
      capability_profile: { ...ROLE_PROFILES[role] },
      tool_permissions: getToolPermissions(role),
      authority: getAuthority(role, template.lead) as Authority,
      autonomy: getAutonomy(role, routing.policy) as Autonomy,
    };
  });

  // Build handoff rules based on topology type
  const handoff_rules = buildHandoffRules(routing.topology_type, agents);

  // Build merge rules for parallel topologies
  const merge_rules = buildMergeRules(routing.topology_type, agents);

  // Get quality gates
  const quality_gates = GATE_PRESETS[missionType] || GATE_PRESETS.execution;

  return {
    topology_type: routing.topology_type,
    agents,
    lead_role: template.lead,
    handoff_rules,
    merge_rules,
    quality_gates,
  };
}

// ── Helper Functions ────────────────────────────────────────────

function generatePurpose(role: RoleType, missionType: MissionType, objective: string): string {
  const purposeMap: Record<RoleType, string> = {
    strategist: `Frame the problem space and evaluate strategic options for: ${objective}`,
    architect: `Design the structural approach and define boundaries for: ${objective}`,
    builder: `Implement concrete artifacts for: ${objective}`,
    researcher: `Gather and evaluate information relevant to: ${objective}`,
    critic: `Evaluate outputs for flaws, risks, and gaps in: ${objective}`,
    router: `Distribute subtasks across agents for: ${objective}`,
    synthesizer: `Combine and unify outputs from parallel agents for: ${objective}`,
    verifier: `Validate deliverables meet success criteria for: ${objective}`,
    reviewer: `Holistic quality assessment of outputs for: ${objective}`,
    memory_manager: `Manage memory compression and conflict resolution for: ${objective}`,
    operator: `Execute operational tactics for: ${objective}`,
  };
  return purposeMap[role];
}

function getToolPermissions(role: RoleType): string[] {
  const toolMap: Record<RoleType, string[]> = {
    strategist: ["web_search"],
    architect: ["web_search", "file_read"],
    builder: ["web_search", "file_read", "code_execution"],
    researcher: ["web_search", "file_read"],
    critic: ["file_read"],
    router: [],
    synthesizer: ["file_read"],
    verifier: ["file_read", "code_execution"],
    reviewer: ["file_read"],
    memory_manager: ["file_read"],
    operator: ["web_search"],
  };
  return toolMap[role];
}

function getAuthority(role: RoleType, leadRole: RoleType): Authority {
  if (role === leadRole) return "direct";
  if (["strategist", "architect"].includes(role)) return "decide";
  return "execute";
}

function getAutonomy(role: RoleType, policy: PolicyName): Autonomy {
  if (policy === "human_in_loop") return "supervised";
  if (policy === "autonomous") return "autonomous";
  if (["strategist", "architect"].includes(role)) return "checkpoint";
  return "autonomous";
}

function buildHandoffRules(
  topologyType: TopologyType,
  agents: TopologyPlan["agents"]
): HandoffRule[] {
  switch (topologyType) {
    case "solo":
      return [];
    case "pair":
      return [
        { from: agents[0].name, to: agents[1].name, trigger: "output_ready" },
        { from: agents[1].name, to: agents[0].name, trigger: "feedback_ready" },
      ];
    case "pipeline":
      return agents.slice(0, -1).map((a, i) => ({
        from: a.name,
        to: agents[i + 1].name,
        trigger: "stage_complete",
      }));
    case "swarm": {
      const synthesizer = agents.find(a => a.role_type === "synthesizer");
      if (!synthesizer) return [];
      return agents
        .filter(a => a.role_type !== "synthesizer")
        .map(a => ({
          from: a.name,
          to: synthesizer.name,
          trigger: "research_complete",
        }));
    }
    case "hierarchy": {
      const lead = agents[0];
      return agents.slice(1).flatMap(a => [
        { from: lead.name, to: a.name, trigger: "task_assigned" },
        { from: a.name, to: lead.name, trigger: "task_complete" },
      ]);
    }
    case "ring":
      return agents.map((a, i) => ({
        from: a.name,
        to: agents[(i + 1) % agents.length].name,
        trigger: "output_ready",
      }));
    default:
      return [];
  }
}

function buildMergeRules(
  topologyType: TopologyType,
  agents: TopologyPlan["agents"]
): MergeRule[] {
  if (topologyType === "swarm") {
    const workers = agents.filter(a => a.role_type !== "synthesizer");
    return [{
      agents: workers.map(a => a.name),
      priority: "equal",
      strategy: "synthesize",
    }];
  }
  if (topologyType === "pair") {
    return [{
      agents: agents.map(a => a.name),
      priority: "first",
      strategy: "best_of",
    }];
  }
  return [];
}
