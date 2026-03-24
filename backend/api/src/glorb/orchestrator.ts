// ── GLORB Mission Orchestrator ───────────────────────────────────
// Manages mission lifecycle, agent spawning, quality gates, provenance

import { query } from "../db";
import { publishToAgent } from "../redis";
import { createAgent, deleteAgent, getAllAgents, getAgent } from "../agents";
import { routeMission, compileTopology, compileConstraints } from "./engine";
import { persistMemory, retrieveMemory } from "./memory";
import type {
  Mission,
  MissionType,
  MissionStatus,
  MissionConstraints,
  AgentSpec,
  Topology,
  TopologyPlan,
  ProvenanceEntry,
  ProvenanceEventType,
  GateResult,
  GateType,
  GateStatus,
  RoutingDecision,
} from "./types";

// ── Status Transition Validation ────────────────────────────────

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ["compiling"],
  compiling: ["ready", "draft"],  // draft = rollback on error
  ready: ["active"],
  active: ["paused", "completed", "failed", "aborted"],
  paused: ["active", "aborted"],
  // terminal states: completed, failed, aborted — no transitions out
};

// ── Mission CRUD ────────────────────────────────────────────────

export async function createMission(input: {
  title: string;
  objective: string;
  mission_type: MissionType;
  deadline?: string;
  budget_tokens?: number;
  risk_level?: string;
  quality_bar?: string;
}): Promise<Mission> {
  const id = `mission-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const rows = await query<Mission>(
    `INSERT INTO glorb_missions (id, title, objective, mission_type, deadline, budget_tokens, risk_level, quality_bar)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [
      id,
      input.title,
      input.objective,
      input.mission_type,
      input.deadline || null,
      input.budget_tokens || null,
      input.risk_level || "medium",
      input.quality_bar || "standard",
    ]
  );

  await recordProvenance(id, "mission_created", undefined, "Mission created", { input });

  return rows[0];
}

export async function getMission(id: string): Promise<Mission | undefined> {
  const rows = await query<Mission>("SELECT * FROM glorb_missions WHERE id = $1", [id]);
  return rows[0];
}

export async function listMissions(status?: MissionStatus): Promise<Mission[]> {
  if (status) {
    return query<Mission>(
      "SELECT * FROM glorb_missions WHERE status = $1 ORDER BY created_at DESC",
      [status]
    );
  }
  return query<Mission>("SELECT * FROM glorb_missions ORDER BY created_at DESC");
}

export async function updateMissionStatus(
  id: string,
  status: MissionStatus,
  extra?: { result?: unknown; error?: string }
): Promise<Mission> {
  // Validate status transition
  const current = await getMission(id);
  if (!current) throw new Error(`Mission ${id} not found`);

  const currentStatus = current.status;
  if (currentStatus !== status) {
    const allowed = VALID_TRANSITIONS[currentStatus];
    if (!allowed || !allowed.includes(status)) {
      throw new Error(`Invalid status transition: ${currentStatus} -> ${status}`);
    }
  }

  const setClauses = ["status = $1", "updated_at = NOW()"];
  const params: unknown[] = [status];

  if (status === "active" && !extra?.error) {
    params.push(new Date().toISOString());
    setClauses.push(`started_at = $${params.length}`);
  }
  if (status === "completed" || status === "failed" || status === "aborted") {
    params.push(new Date().toISOString());
    setClauses.push(`completed_at = $${params.length}`);
  }
  if (extra?.result !== undefined) {
    params.push(JSON.stringify(extra.result));
    setClauses.push(`result = $${params.length}::jsonb`);
  }
  if (extra?.error) {
    params.push(extra.error);
    setClauses.push(`error = $${params.length}`);
  }

  params.push(id);
  const rows = await query<Mission>(
    `UPDATE glorb_missions SET ${setClauses.join(", ")} WHERE id = $${params.length} RETURNING *`,
    params
  );
  if (!rows.length) throw new Error(`Mission ${id} not found`);
  return rows[0];
}

// ── Compile Mission (Route + Build Topology + Spawn Agents) ─────

export async function compileMission(missionId: string): Promise<{
  mission: Mission;
  routing: RoutingDecision;
  topology: Topology;
  agents: AgentSpec[];
}> {
  const mission = await getMission(missionId);
  if (!mission) throw new Error(`Mission ${missionId} not found`);
  if (mission.status !== "draft") throw new Error(`Mission must be in draft status to compile`);

  await updateMissionStatus(missionId, "compiling");

  try {
    const constraints: MissionConstraints = {
      deadline: mission.deadline || undefined,
      budget_tokens: mission.budget_tokens || undefined,
      risk_level: mission.risk_level as MissionConstraints["risk_level"],
      quality_bar: mission.quality_bar as MissionConstraints["quality_bar"],
    };

    // 1. Route the mission
    const routing = routeMission(
      mission.mission_type as MissionType,
      mission.objective,
      constraints
    );

    await recordProvenance(missionId, "decision", undefined, "Mission routed", {
      routing,
    });

    // 2. Compile topology
    const plan = compileTopology(
      mission.mission_type as MissionType,
      routing,
      mission.objective
    );

    // 3. Persist topology
    const topologyId = `topo-${Date.now()}`;
    const leadAgent = plan.agents.find(a => a.role_type === plan.lead_role);

    const topoRows = await query<Topology>(
      `INSERT INTO glorb_topologies (id, mission_id, name, topology_type, config, handoff_rules, merge_rules, quality_gates)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        topologyId,
        missionId,
        `${mission.mission_type}_topology`,
        plan.topology_type,
        JSON.stringify({ lead_role: plan.lead_role }),
        JSON.stringify(plan.handoff_rules),
        JSON.stringify(plan.merge_rules),
        JSON.stringify(plan.quality_gates),
      ]
    );

    await recordProvenance(missionId, "topology_compiled", undefined, "Topology compiled", {
      topology_type: plan.topology_type,
      agent_count: plan.agents.length,
    });

    // 4. Create agent specs + spawn runtime agents
    const agentSpecs: AgentSpec[] = [];
    const spawnedRuntimeAgentIds: string[] = [];

    try {
      for (const agentPlan of plan.agents) {
        // Build system prompt from GLORB spec
        const systemPrompt = buildAgentSystemPrompt(agentPlan, mission, plan);

        // Spawn real SharkSwarm agent
        const runtimeAgent = await createAgent({
          name: `[${mission.title}] ${agentPlan.name}`,
          systemPrompt,
          model: "openai/gpt-4.1-mini",
          tools: agentPlan.tool_permissions,
        });

        spawnedRuntimeAgentIds.push(runtimeAgent.id);

        // Persist GLORB agent spec
        const specId = `spec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const specRows = await query<AgentSpec>(
          `INSERT INTO glorb_agent_specs
           (id, mission_id, name, role_type, purpose, scope_in, scope_out,
            capability_profile, tool_permissions, memory_scope, authority, autonomy,
            runtime_agent_id, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
           RETURNING *`,
          [
            specId,
            missionId,
            agentPlan.name,
            agentPlan.role_type,
            agentPlan.purpose,
            null,
            null,
            JSON.stringify(agentPlan.capability_profile),
            agentPlan.tool_permissions,
            "mission",
            agentPlan.authority,
            agentPlan.autonomy,
            runtimeAgent.id,
            "instantiated",
          ]
        );

        agentSpecs.push(specRows[0]);

        await recordProvenance(missionId, "agent_spawned", specId, `Spawned ${agentPlan.role_type}: ${agentPlan.name}`, {
          runtime_agent_id: runtimeAgent.id,
          capability_profile: agentPlan.capability_profile,
        });
      }
    } catch (spawnErr) {
      // Clean up already-spawned agents before propagating
      for (const runtimeId of spawnedRuntimeAgentIds) {
        try {
          await deleteAgent(runtimeId);
        } catch {
          // best-effort cleanup
        }
      }
      throw spawnErr;
    }

    // Update topology with lead agent
    if (leadAgent) {
      const leadSpec = agentSpecs.find(s => s.role_type === plan.lead_role);
      if (leadSpec) {
        await query(
          "UPDATE glorb_topologies SET lead_agent_id = $1 WHERE id = $2",
          [leadSpec.id, topologyId]
        );
      }
    }

    // Update mission with topology reference
    await query(
      "UPDATE glorb_missions SET topology_id = $1, policy = $2, updated_at = NOW() WHERE id = $3",
      [topologyId, routing.policy, missionId]
    );

    // Insert quality gates
    for (const gate of plan.quality_gates) {
      await query(
        `INSERT INTO glorb_gate_results (mission_id, gate_type, criteria)
         VALUES ($1, $2, $3)`,
        [missionId, gate.type, JSON.stringify(gate.criteria)]
      );
    }

    await updateMissionStatus(missionId, "ready");

    // Store mission context in memory
    await persistMemory("mission", missionId, "mission_context", {
      objective: mission.objective,
      type: mission.mission_type,
      topology: plan.topology_type,
      agents: agentSpecs.map(s => ({ id: s.id, name: s.name, role: s.role_type })),
      routing_decision: routing,
    }, { createdBy: "glorb_orchestrator" });

    const updatedMission = await getMission(missionId);
    return {
      mission: updatedMission!,
      routing,
      topology: topoRows[0],
      agents: agentSpecs,
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await recordProvenance(missionId, "decision", undefined, `Compilation failed: ${errorMessage}`, {
      error: errorMessage,
      phase: "compile",
    });
    await updateMissionStatus(missionId, "draft", { error: errorMessage });
    throw err;
  }
}

// ── Execute Mission ─────────────────────────────────────────────

export async function executeMission(missionId: string): Promise<Mission> {
  const mission = await getMission(missionId);
  if (!mission) throw new Error(`Mission ${missionId} not found`);
  if (mission.status !== "ready") throw new Error(`Mission must be in ready status to execute`);

  await updateMissionStatus(missionId, "active");

  // Get topology and agents
  const topology = await getTopology(mission.topology_id!);
  if (!topology) throw new Error("Topology not found");

  const agents = await getMissionAgents(missionId);
  const leadSpec = agents.find(a => a.id === topology.lead_agent_id);

  // Evaluate first quality gate (sufficient_context)
  const contextGate = await evaluateGate(missionId, "sufficient_context");
  if (contextGate.status === "failed") {
    await recordProvenance(missionId, "gate_evaluated", undefined, "Sufficient context gate failed — proceeding with warning");
  }

  // Send mission briefing to lead agent
  if (leadSpec?.runtime_agent_id) {
    const briefing = buildMissionBriefing(mission, topology, agents);
    await publishToAgent("glorb", leadSpec.runtime_agent_id, briefing);

    await recordProvenance(missionId, "handoff", leadSpec.id, "Mission briefing sent to lead agent", {
      runtime_agent_id: leadSpec.runtime_agent_id,
    });
  }

  // For pipeline topologies, send task assignments to each agent in order
  const handoffRules = topology.handoff_rules as Array<{ from: string; to: string; trigger: string }>;
  if (topology.topology_type === "swarm") {
    // In swarm mode, send objective to all non-synthesizer agents in parallel
    for (const spec of agents) {
      if (spec.role_type !== "synthesizer" && spec.runtime_agent_id) {
        const taskMsg = `[GLORB Mission: ${mission.title}]\nRole: ${spec.role_type}\nObjective: ${mission.objective}\nPurpose: ${spec.purpose}\n\nBegin your research. When complete, summarize your findings.`;
        await publishToAgent("glorb", spec.runtime_agent_id, taskMsg);
      }
    }
  }

  // Store execution state in working memory
  await persistMemory("working", missionId, "execution_state", {
    status: "active",
    phase: "initial",
    agents_briefed: agents.map(a => a.name),
    started_at: new Date().toISOString(),
  }, { createdBy: "glorb_orchestrator" });

  return (await getMission(missionId))!;
}

// ── Pause / Resume / Abort ──────────────────────────────────────

export async function pauseMission(missionId: string): Promise<Mission> {
  const mission = await getMission(missionId);
  if (!mission || mission.status !== "active") throw new Error("Mission must be active to pause");

  await recordProvenance(missionId, "human_command", undefined, "FREEZE: Mission paused");
  return updateMissionStatus(missionId, "paused");
}

export async function resumeMission(missionId: string): Promise<Mission> {
  const mission = await getMission(missionId);
  if (!mission || mission.status !== "paused") throw new Error("Mission must be paused to resume");

  await recordProvenance(missionId, "human_command", undefined, "RESUME: Mission resumed");
  return updateMissionStatus(missionId, "active");
}

export async function abortMission(missionId: string, reason: string): Promise<Mission> {
  const mission = await getMission(missionId);
  if (!mission) throw new Error(`Mission ${missionId} not found`);

  // Retire all mission agents
  const agents = await getMissionAgents(missionId);
  for (const spec of agents) {
    if (spec.runtime_agent_id) {
      try {
        await deleteAgent(spec.runtime_agent_id);
      } catch {
        // agent may already be gone
      }
      await query(
        "UPDATE glorb_agent_specs SET status = 'retired' WHERE id = $1",
        [spec.id]
      );
    }
  }

  await recordProvenance(missionId, "human_command", undefined, `ABORT: ${reason}`);
  return updateMissionStatus(missionId, "aborted", { error: reason });
}

// ── Complete Mission ────────────────────────────────────────────

export async function completeMission(
  missionId: string,
  result: unknown
): Promise<Mission> {
  const mission = await getMission(missionId);
  if (!mission) throw new Error(`Mission ${missionId} not found`);

  // Evaluate shipping readiness gate
  await evaluateGate(missionId, "shipping_readiness");

  // Retire all mission agents
  const agents = await getMissionAgents(missionId);
  for (const spec of agents) {
    if (spec.runtime_agent_id) {
      try {
        await deleteAgent(spec.runtime_agent_id);
      } catch {
        // agent may already be gone
      }
      await query(
        "UPDATE glorb_agent_specs SET status = 'retired' WHERE id = $1",
        [spec.id]
      );
    }
  }

  // Store result in mission memory
  await persistMemory("mission", missionId, "mission_result", result, {
    createdBy: "glorb_orchestrator",
  });

  await recordProvenance(missionId, "deliverable_produced", undefined, "Mission completed", {
    result,
  });

  return updateMissionStatus(missionId, "completed", { result });
}

// ── Quality Gates ───────────────────────────────────────────────

export async function evaluateGate(
  missionId: string,
  gateType: GateType
): Promise<GateResult> {
  // Find the gate
  const gates = await query<GateResult>(
    "SELECT * FROM glorb_gate_results WHERE mission_id = $1 AND gate_type = $2 AND status = 'pending' LIMIT 1",
    [missionId, gateType]
  );

  if (!gates.length) {
    // Create an ad-hoc gate
    const rows = await query<GateResult>(
      `INSERT INTO glorb_gate_results (mission_id, gate_type, criteria)
       VALUES ($1, $2, '{}') RETURNING *`,
      [missionId, gateType]
    );
    gates.push(rows[0]);
  }

  const gate = gates[0];

  // Auto-pass for now (real implementation would check criteria)
  // This is where LLM-based evaluation would plug in
  const status: GateStatus = "passed";

  const rows = await query<GateResult>(
    `UPDATE glorb_gate_results SET status = $1, result = $2, evaluated_by = 'glorb_auto' WHERE id = $3 RETURNING *`,
    [status, JSON.stringify({ auto_evaluated: true, passed: true }), gate.id]
  );

  await recordProvenance(missionId, "gate_evaluated", undefined, `Gate ${gateType}: ${status}`, {
    gate_id: gate.id,
    gate_type: gateType,
    status,
  });

  return rows[0];
}

export async function overrideGate(
  gateId: number,
  reason: string
): Promise<GateResult> {
  const rows = await query<GateResult>(
    `UPDATE glorb_gate_results SET status = 'overridden', result = $1, evaluated_by = 'human' WHERE id = $2 RETURNING *`,
    [JSON.stringify({ override_reason: reason }), gateId]
  );
  if (!rows.length) throw new Error(`Gate ${gateId} not found`);

  await recordProvenance(rows[0].mission_id, "human_command", undefined, `OVERRIDE gate ${gateId}: ${reason}`);
  return rows[0];
}

// ── Provenance ──────────────────────────────────────────────────

export async function recordProvenance(
  missionId: string,
  eventType: ProvenanceEventType,
  agentId: string | undefined,
  action: string,
  data?: unknown,
  opts?: { confidence?: number; reasoning?: string; parentId?: number }
): Promise<ProvenanceEntry> {
  const rows = await query<ProvenanceEntry>(
    `INSERT INTO glorb_provenance (mission_id, event_type, agent_id, action, input, confidence, reasoning, parent_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [
      missionId,
      eventType,
      agentId || null,
      action,
      data ? JSON.stringify(data) : null,
      opts?.confidence || null,
      opts?.reasoning || null,
      opts?.parentId || null,
    ]
  );
  return rows[0];
}

export async function getProvenance(missionId: string): Promise<ProvenanceEntry[]> {
  return query<ProvenanceEntry>(
    "SELECT * FROM glorb_provenance WHERE mission_id = $1 ORDER BY created_at ASC",
    [missionId]
  );
}

// ── Helpers ─────────────────────────────────────────────────────

async function getTopology(topologyId: string): Promise<Topology | undefined> {
  const rows = await query<Topology>(
    "SELECT * FROM glorb_topologies WHERE id = $1",
    [topologyId]
  );
  return rows[0];
}

export async function getMissionAgents(missionId: string): Promise<AgentSpec[]> {
  return query<AgentSpec>(
    "SELECT * FROM glorb_agent_specs WHERE mission_id = $1 ORDER BY created_at",
    [missionId]
  );
}

export async function getMissionGates(missionId: string): Promise<GateResult[]> {
  return query<GateResult>(
    "SELECT * FROM glorb_gate_results WHERE mission_id = $1 ORDER BY created_at",
    [missionId]
  );
}

export async function getMissionTopology(missionId: string): Promise<Topology | undefined> {
  const rows = await query<Topology>(
    "SELECT * FROM glorb_topologies WHERE mission_id = $1",
    [missionId]
  );
  return rows[0];
}

function buildAgentSystemPrompt(
  agentPlan: TopologyPlan["agents"][0],
  mission: Mission,
  plan: TopologyPlan
): string {
  return `# GLORB Agent: ${agentPlan.name}
Role: ${agentPlan.role_type.toUpperCase()}
Authority: ${agentPlan.authority} | Autonomy: ${agentPlan.autonomy}

## Mission
Title: ${mission.title}
Objective: ${mission.objective}
Type: ${mission.mission_type}

## Your Purpose
${agentPlan.purpose}

## Team Context
Topology: ${plan.topology_type}
Team size: ${plan.agents.length} agents
Your role in the team: ${agentPlan.role_type}
Lead role: ${plan.lead_role}

## Governance
- Authority level: ${agentPlan.authority}
- Autonomy level: ${agentPlan.autonomy}
- Tool permissions: ${agentPlan.tool_permissions.join(", ") || "none"}

## Instructions
1. Focus on your assigned purpose within the mission objective.
2. Respect your authority and autonomy boundaries.
3. If you encounter issues outside your scope, signal for escalation.
4. Provide structured, traceable outputs with clear reasoning.
5. When your work is complete, summarize findings and signal completion.`;
}

function buildMissionBriefing(
  mission: Mission,
  topology: Topology,
  agents: AgentSpec[]
): string {
  const agentList = agents.map(a =>
    `- ${a.name} (${a.role_type}): ${a.purpose}`
  ).join("\n");

  return `# GLORB Mission Briefing
## ${mission.title}

**Objective:** ${mission.objective}
**Type:** ${mission.mission_type}
**Policy:** ${mission.policy}
**Risk Level:** ${mission.risk_level}
**Quality Bar:** ${mission.quality_bar}

## Team
Topology: ${topology.topology_type}
${agentList}

## Your Role
You are the LEAD agent. Coordinate the team, manage handoffs, and ensure the mission objective is met.

## Handoff Rules
${JSON.stringify(topology.handoff_rules, null, 2)}

## Quality Gates
${JSON.stringify(topology.quality_gates, null, 2)}

Begin execution now.`;
}
