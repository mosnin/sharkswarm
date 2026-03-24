// ── GLORB API Routes ────────────────────────────────────────────

import { Router, Request, Response } from "express";
import {
  createMission,
  getMission,
  listMissions,
  compileMission,
  executeMission,
  pauseMission,
  resumeMission,
  abortMission,
  completeMission,
  getProvenance,
  getMissionAgents,
  getMissionGates,
  getMissionTopology,
  overrideGate,
  recordProvenance,
} from "./orchestrator";
import {
  retrieveMemory,
  searchMemory,
  persistMemory,
  promoteMemory,
  compressMemory,
} from "./memory";
import { routeMission, compileTopology, compileConstraints } from "./engine";
import type { MissionType, MissionConstraints, MemoryLayer, RiskLevel, QualityBar } from "./types";

const VALID_MISSION_TYPES: MissionType[] = [
  "exploration", "decision", "design", "build",
  "audit", "negotiation", "synthesis", "execution",
];

const VALID_RISK_LEVELS: RiskLevel[] = ["low", "medium", "high", "critical"];

const VALID_QUALITY_BARS: QualityBar[] = ["minimal", "standard", "high", "maximum"];

export const glorbRouter = Router();

const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response) => {
    fn(req, res).catch((err: unknown) => {
      console.error("GLORB route error:", err);
      if (!res.headersSent) {
        const message = err instanceof Error ? err.message : "Internal error";
        res.status(500).json({ error: message });
      }
    });
  };

// ── Missions ────────────────────────────────────────────────────

glorbRouter.get("/missions", wrap(async (req, res) => {
  const status = req.query.status as string | undefined;
  const missions = await listMissions(status as any);
  res.json(missions);
}));

glorbRouter.post("/missions", wrap(async (req, res) => {
  const { title, objective, mission_type, deadline, budget_tokens, risk_level, quality_bar } = req.body;
  if (!title || !objective) {
    return res.status(400).json({ error: "title and objective are required" });
  }
  if (mission_type && !VALID_MISSION_TYPES.includes(mission_type)) {
    return res.status(400).json({
      error: `Invalid mission_type: "${mission_type}". Must be one of: ${VALID_MISSION_TYPES.join(", ")}`,
    });
  }
  if (risk_level && !VALID_RISK_LEVELS.includes(risk_level)) {
    return res.status(400).json({
      error: `Invalid risk_level: "${risk_level}". Must be one of: ${VALID_RISK_LEVELS.join(", ")}`,
    });
  }
  if (quality_bar && !VALID_QUALITY_BARS.includes(quality_bar)) {
    return res.status(400).json({
      error: `Invalid quality_bar: "${quality_bar}". Must be one of: ${VALID_QUALITY_BARS.join(", ")}`,
    });
  }
  const mission = await createMission({
    title,
    objective,
    mission_type: mission_type || "exploration",
    deadline,
    budget_tokens,
    risk_level,
    quality_bar,
  });
  res.status(201).json(mission);
}));

glorbRouter.get("/missions/:id", wrap(async (req, res) => {
  const mission = await getMission(req.params.id);
  if (!mission) return res.status(404).json({ error: "Mission not found" });
  res.json(mission);
}));

// Full mission view with topology, agents, gates, provenance
glorbRouter.get("/missions/:id/full", wrap(async (req, res) => {
  const mission = await getMission(req.params.id);
  if (!mission) return res.status(404).json({ error: "Mission not found" });

  const [agents, topology, gates, provenance] = await Promise.all([
    getMissionAgents(req.params.id),
    getMissionTopology(req.params.id),
    getMissionGates(req.params.id),
    getProvenance(req.params.id),
  ]);

  res.json({ mission, topology, agents, gates, provenance });
}));

// ── Mission Lifecycle ───────────────────────────────────────────

// Compile: route + build topology + spawn agents
glorbRouter.post("/missions/:id/compile", wrap(async (req, res) => {
  const result = await compileMission(req.params.id);
  res.json(result);
}));

// Execute: send briefings, start agents working
glorbRouter.post("/missions/:id/execute", wrap(async (req, res) => {
  const mission = await executeMission(req.params.id);
  res.json(mission);
}));

// Pause (FREEZE command)
glorbRouter.post("/missions/:id/pause", wrap(async (req, res) => {
  const mission = await pauseMission(req.params.id);
  res.json(mission);
}));

// Resume
glorbRouter.post("/missions/:id/resume", wrap(async (req, res) => {
  const mission = await resumeMission(req.params.id);
  res.json(mission);
}));

// Abort
glorbRouter.post("/missions/:id/abort", wrap(async (req, res) => {
  const { reason } = req.body;
  if (!reason) return res.status(400).json({ error: "reason is required" });
  const mission = await abortMission(req.params.id, reason);
  res.json(mission);
}));

// Complete (with deliverable)
glorbRouter.post("/missions/:id/complete", wrap(async (req, res) => {
  const { result } = req.body;
  const mission = await completeMission(req.params.id, result || {});
  res.json(mission);
}));

// ── Mission Sub-resources ───────────────────────────────────────

glorbRouter.get("/missions/:id/agents", wrap(async (req, res) => {
  const agents = await getMissionAgents(req.params.id);
  res.json(agents);
}));

glorbRouter.get("/missions/:id/topology", wrap(async (req, res) => {
  const topology = await getMissionTopology(req.params.id);
  if (!topology) return res.status(404).json({ error: "No topology compiled yet" });
  res.json(topology);
}));

glorbRouter.get("/missions/:id/gates", wrap(async (req, res) => {
  const gates = await getMissionGates(req.params.id);
  res.json(gates);
}));

glorbRouter.get("/missions/:id/provenance", wrap(async (req, res) => {
  const provenance = await getProvenance(req.params.id);
  res.json(provenance);
}));

// Override a quality gate
glorbRouter.post("/missions/:id/gates/:gateId/override", wrap(async (req, res) => {
  const { reason } = req.body;
  if (!reason) return res.status(400).json({ error: "reason is required" });
  const gate = await overrideGate(Number(req.params.gateId), reason);
  res.json(gate);
}));

// ── Preview (dry-run routing without creating anything) ─────────

glorbRouter.post("/preview/route", wrap(async (req, res) => {
  const { mission_type, objective, deadline, budget_tokens, risk_level, quality_bar } = req.body;
  if (!mission_type || !objective) {
    return res.status(400).json({ error: "mission_type and objective are required" });
  }

  const constraints: MissionConstraints = {
    deadline,
    budget_tokens,
    risk_level: risk_level || "medium",
    quality_bar: quality_bar || "standard",
  };

  const routing = routeMission(mission_type as MissionType, objective, constraints);
  const topology = compileTopology(mission_type as MissionType, routing, objective);
  const compiled = compileConstraints(mission_type as MissionType, constraints);

  res.json({ routing, topology, compiled_constraints: compiled });
}));

// ── Memory ──────────────────────────────────────────────────────

glorbRouter.get("/memory/:layer/:scopeId", wrap(async (req, res) => {
  const { layer, scopeId } = req.params;
  const { key, limit } = req.query;
  const entries = await retrieveMemory(
    layer as MemoryLayer,
    scopeId,
    { key: key as string, limit: limit ? Number(limit) : undefined }
  );
  res.json(entries);
}));

glorbRouter.post("/memory/:layer/:scopeId", wrap(async (req, res) => {
  const { layer, scopeId } = req.params;
  const { key, content, metadata, created_by } = req.body;
  if (!key || content === undefined) {
    return res.status(400).json({ error: "key and content are required" });
  }
  const entry = await persistMemory(
    layer as MemoryLayer,
    scopeId,
    key,
    content,
    { metadata, createdBy: created_by }
  );
  res.status(201).json(entry);
}));

glorbRouter.post("/memory/search/:scopeId", wrap(async (req, res) => {
  const { scopeId } = req.params;
  const { key, layers } = req.body;
  if (!key) return res.status(400).json({ error: "key is required" });
  const entries = await searchMemory(scopeId, key, layers);
  res.json(entries);
}));

glorbRouter.post("/memory/:entryId/promote", wrap(async (req, res) => {
  const { target_layer, scope_id } = req.body;
  if (!target_layer) return res.status(400).json({ error: "target_layer is required" });
  const entry = await promoteMemory(Number(req.params.entryId), target_layer, scope_id);
  res.json(entry);
}));

glorbRouter.post("/memory/:layer/:scopeId/compress", wrap(async (req, res) => {
  const { layer, scopeId } = req.params;
  const { strategy } = req.body;
  const result = await compressMemory(layer as MemoryLayer, scopeId, strategy);
  res.json(result);
}));
