import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { prisma, pool } from "./db";
import { publishToAgent } from "./redis";
import { getAllAgents, getAgent, updateAgent, createAgent, deleteAgent, initAgentRegistry } from "./agents";
import { glorbRouter, initGlorbSchema } from "./glorb";
import {
  getAllIntegrations,
  getIntegration,
  createIntegration,
  updateIntegration,
  deleteIntegration,
  getAgentIntegrations,
  bindIntegrationToAgent,
  unbindIntegrationFromAgent,
  initIntegrationsSchema,
} from "./integrations";
import { requireAuth } from "./auth";
import { getOrgId } from "./middleware/org-scope";
import { enforceAgentLimit, enforceMissionLimit } from "./middleware/plan-limits";

const app = express();
const PORT = Number(process.env.API_PORT) || 4000;

app.use(
  cors({
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim())
      : (requestOrigin, callback) => callback(null, requestOrigin || true),
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  })
);
app.use(express.json());

// Trust proxy (Cloudflare Tunnel forwards X-Forwarded-For)
app.set("trust proxy", 1);

// --------------- Rate Limiting ---------------

const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,            // 100 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
});

const strictLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,             // 20 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many write requests, please try again later" },
});

app.use(generalLimiter);

// Async route error wrapper — catches unhandled rejections and sends 500
const wrap =
  (fn: (req: express.Request, res: express.Response) => Promise<unknown>) =>
  (req: express.Request, res: express.Response) => {
    fn(req, res).catch((err: unknown) => {
      console.error("Unhandled route error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal server error" });
      }
    });
  };

// --------------- Health ---------------

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// --------------- Auth Middleware ---------------
// All routes below this point require a valid JWT (when AUTH_REQUIRED=true).
app.use(requireAuth);

// --------------- Agents ---------------

app.get("/api/agents", wrap(async (req, res) => {
  const organizationId = getOrgId(req);
  const agents = await getAllAgents(organizationId);

  const results = await Promise.all(
    agents.map(async (agent) => {
      let status: "online" | "offline" = "offline";
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 2000);
        const r = await fetch(`${agent.internalUrl}/healthz`, {
          signal: ctrl.signal,
        });
        clearTimeout(timer);
        if (r.ok) status = "online";
      } catch {
        // agent unreachable
      }
      return {
        id: agent.id,
        name: agent.name,
        status,
        model: agent.model,
        tools: agent.tools,
      };
    })
  );

  res.json(results);
}));

app.get("/api/agents/:id", wrap(async (req, res) => {
  const organizationId = getOrgId(req);
  const agent = await getAgent(req.params.id, organizationId);
  if (!agent) return res.status(404).json({ error: "Agent not found" });
  res.json(agent);
}));

app.post("/api/agents", strictLimiter, enforceAgentLimit, async (req, res) => {
  const { name, systemPrompt, model, tools } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });
  try {
    const organizationId = getOrgId(req);
    const agent = await createAgent(organizationId, {
      name,
      systemPrompt: systemPrompt || `You are ${name}, an AI agent in the SharkSwarm multi-agent system.`,
      model: model || "openai/gpt-4.1-mini",
      tools: tools || [],
    });
    res.status(201).json(agent);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create agent";
    console.error("create agent error:", err);
    res.status(500).json({ error: message });
  }
});

app.put("/api/agents/:id", wrap(async (req, res) => {
  const organizationId = getOrgId(req);
  const updated = await updateAgent(req.params.id, organizationId, req.body);
  if (!updated) return res.status(404).json({ error: "Agent not found" });
  res.json(updated);
}));

app.delete("/api/agents/:id", wrap(async (req, res) => {
  const organizationId = getOrgId(req);
  const ok = await deleteAgent(req.params.id, organizationId);
  if (!ok) return res.status(404).json({ error: "Agent not found" });
  res.json({ success: true });
}));

app.post("/api/agents/:id/reset", wrap(async (req, res) => {
  const organizationId = getOrgId(req);
  const agent = await getAgent(req.params.id, organizationId);
  if (!agent) return res.status(404).json({ error: "Agent not found" });
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3000);
    await fetch(`${agent.internalUrl}/api/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sender: req.body.sender || "dashboard" }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    res.json({ success: true });
  } catch {
    res.status(502).json({ error: "Agent unreachable" });
  }
}));

// --------------- Messages ---------------

app.post("/api/send-message", strictLimiter, async (req, res) => {
  const { to_agent, message } = req.body;

  if (!to_agent || !message) {
    return res.status(400).json({ error: "to_agent and message are required" });
  }

  try {
    const organizationId = getOrgId(req);
    await publishToAgent("dashboard", to_agent, message, organizationId);
    // redis-bridge persists the message to Postgres — no need to insert here too
    res.json({ success: true });
  } catch (err) {
    console.error("send-message error:", err);
    res.status(500).json({ error: "Failed to send message" });
  }
});

app.get("/api/messages", wrap(async (req, res) => {
  const organizationId = getOrgId(req);
  const limit = Number(req.query.limit) || 50;
  const rows = await prisma.message.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  res.json(rows);
}));

// --------------- Logs ---------------

app.get("/api/logs", wrap(async (req, res) => {
  const organizationId = getOrgId(req);
  const limit = Number(req.query.limit) || 50;
  const type = (req.query.type as string) || "agent_logs";

  if (type === "messages") {
    const rows = await prisma.message.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return res.json(rows);
  }

  const rows = await prisma.agentLog.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  res.json(rows);
}));

// --------------- Tasks ---------------

app.get("/api/tasks", wrap(async (req, res) => {
  const organizationId = getOrgId(req);
  const limit = Number(req.query.limit) || 100;
  const status = req.query.status as string | undefined;
  const agent = req.query.agent as string | undefined;

  const where: Record<string, unknown> = { organizationId };

  if (status) {
    where.status = status;
  }
  if (agent) {
    where.OR = [{ fromAgentId: agent }, { toAgentId: agent }];
  }

  const rows = await prisma.task.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  res.json(rows);
}));

app.post("/api/tasks", wrap(async (req, res) => {
  const organizationId = getOrgId(req);
  const { from_agent, to_agent, message } = req.body;
  if (!from_agent || !to_agent || !message) {
    return res.status(400).json({ error: "from_agent, to_agent, and message are required" });
  }
  const task = await prisma.task.create({
    data: {
      organizationId,
      fromAgentId: from_agent,
      toAgentId: to_agent,
      message,
    },
  });
  res.status(201).json(task);
}));

app.put("/api/tasks/:id", wrap(async (req, res) => {
  const organizationId = getOrgId(req);
  const { status, result } = req.body;

  const data: Record<string, unknown> = {};
  if (status !== undefined && status !== null) data.status = status;
  if (result !== undefined && result !== null) data.result = result;

  const updated = await prisma.task.updateMany({
    where: { id: req.params.id, organizationId },
    data,
  });
  if (!updated.count) return res.status(404).json({ error: "Task not found" });

  const task = await prisma.task.findUnique({ where: { id: req.params.id } });
  res.json(task);
}));

// --------------- Agent Conversation History ---------------

app.get("/api/agents/:id/messages", wrap(async (req, res) => {
  const organizationId = getOrgId(req);
  const agentId = req.params.id;
  const limit = Number(req.query.limit) || 100;
  const rows = await prisma.message.findMany({
    where: {
      organizationId,
      OR: [{ fromAgent: agentId }, { toAgent: agentId }],
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  res.json(rows);
}));

// --------------- Enhanced Logs ---------------

app.get("/api/logs/filtered", wrap(async (req, res) => {
  const organizationId = getOrgId(req);
  const limit = Number(req.query.limit) || 100;
  const agent = req.query.agent as string | undefined;
  const level = req.query.level as string | undefined;
  const since = req.query.since as string | undefined;

  const where: Record<string, unknown> = { organizationId };

  if (agent) {
    where.agentId = agent;
  }
  if (level) {
    where.level = level;
  }
  if (since) {
    where.createdAt = { gte: new Date(since) };
  }

  const rows = await prisma.agentLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  res.json(rows);
}));

// --------------- System Health ---------------

app.get("/api/health/system", wrap(async (req, res) => {
  const organizationId = getOrgId(req);
  const agents = await getAllAgents(organizationId);

  const agentHealth = await Promise.all(
    agents.map(async (agent) => {
      let status: "online" | "offline" = "offline";
      let latencyMs: number | null = null;
      const start = Date.now();
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 3000);
        const r = await fetch(`${agent.internalUrl}/healthz`, {
          signal: ctrl.signal,
        });
        clearTimeout(timer);
        if (r.ok) {
          status = "online";
          latencyMs = Date.now() - start;
        }
      } catch {
        // offline
      }

      // Last activity from messages table — scoped to org
      const lastMsg = await prisma.message.findFirst({
        where: {
          organizationId,
          OR: [{ fromAgent: agent.id }, { toAgent: agent.id }],
        },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });

      return {
        id: agent.id,
        name: agent.name,
        status,
        latencyMs,
        lastActivity: lastMsg?.createdAt ?? null,
      };
    })
  );

  // DB + Redis checks
  let dbOk = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch { /* */ }

  let redisOk = false;
  try {
    const { redis } = await import("./redis");
    const pong = await redis.ping();
    redisOk = pong === "PONG";
  } catch { /* */ }

  // Task stats — scoped to org
  const taskStats = await prisma.task.groupBy({
    by: ["status"],
    where: { organizationId },
    _count: { status: true },
  });

  res.json({
    agents: agentHealth,
    infrastructure: { postgres: dbOk, redis: redisOk },
    tasks: Object.fromEntries(
      taskStats.map((r) => [r.status, r._count.status])
    ),
  });
}));

// --------------- Tool Integrations ---------------

app.get("/api/integrations", wrap(async (req, res) => {
  const organizationId = getOrgId(req);
  const rows = await prisma.backendIntegration.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
  });
  res.json(rows);
}));

app.get("/api/integrations/:id", wrap(async (req, res) => {
  const organizationId = getOrgId(req);
  const tool = await prisma.backendIntegration.findFirst({
    where: { id: req.params.id, organizationId },
  });
  if (!tool) return res.status(404).json({ error: "Integration not found" });
  res.json(tool);
}));

app.post("/api/integrations", wrap(async (req, res) => {
  const organizationId = getOrgId(req);
  const { type, name, description, config } = req.body;
  if (!type || !["api", "mcp"].includes(type)) {
    return res.status(400).json({ error: "type must be 'api' or 'mcp'" });
  }
  const created = await prisma.backendIntegration.create({
    data: {
      organizationId,
      name: name || "",
      description: description || "",
      type,
      config: config || {},
    },
  });
  res.status(201).json(created);
}));

app.put("/api/integrations/:id", wrap(async (req, res) => {
  const organizationId = getOrgId(req);
  const { name, description, config } = req.body;

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name;
  if (description !== undefined) data.description = description;
  if (config !== undefined) data.config = config;

  const result = await prisma.backendIntegration.updateMany({
    where: { id: req.params.id, organizationId },
    data,
  });
  if (!result.count) return res.status(404).json({ error: "Integration not found" });

  const updated = await prisma.backendIntegration.findUnique({ where: { id: req.params.id } });
  res.json(updated);
}));

app.delete("/api/integrations/:id", wrap(async (req, res) => {
  const organizationId = getOrgId(req);
  const result = await prisma.backendIntegration.deleteMany({
    where: { id: req.params.id, organizationId },
  });
  if (!result.count) return res.status(404).json({ error: "Integration not found" });
  res.json({ success: true });
}));

// Test an API tool integration by making the actual HTTP call
app.post("/api/integrations/:id/test", wrap(async (req, res) => {
  const organizationId = getOrgId(req);
  const tool = await prisma.backendIntegration.findFirst({
    where: { id: req.params.id, organizationId },
  });
  if (!tool) return res.status(404).json({ error: "Integration not found" });

  const cfg = tool.config as Record<string, unknown>;

  if (tool.type === "api") {
    try {
      // Replace template placeholders with provided params
      let url = (cfg.url as string) || "";
      let body = (cfg.bodyTemplate as string) || "";
      const method = (cfg.method as string) || "GET";
      const headers = (cfg.headers as Record<string, string>) || {};
      const params = req.body.params || {};
      for (const [key, value] of Object.entries(params)) {
        url = url.replace(`{{${key}}}`, String(value));
        body = body.replace(`{{${key}}}`, String(value));
      }

      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10000);
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...headers },
        body: method !== "GET" && body ? body : undefined,
        signal: ctrl.signal,
      });
      clearTimeout(timer);

      const text = await r.text();
      let data;
      try { data = JSON.parse(text); } catch { data = text; }
      res.json({ status: r.status, ok: r.ok, data });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.json({ status: 0, ok: false, error: message });
    }
  } else if (tool.type === "mcp") {
    const transport = cfg.transport as string;
    const valid =
      (transport === "stdio" && cfg.command) ||
      (["sse", "streamable-http"].includes(transport) && cfg.url);
    res.json({ ok: !!valid, status: valid ? "config_valid" : "invalid_config" });
  } else {
    res.status(400).json({ error: "Unknown integration type" });
  }
}));

// --------------- Agent ↔ Integration Bindings ---------------

app.get("/api/agents/:id/integrations", wrap(async (req, res) => {
  const organizationId = getOrgId(req);
  // Verify the agent belongs to this org
  const agent = await prisma.agent.findFirst({
    where: { id: req.params.id, organizationId },
  });
  if (!agent) return res.status(404).json({ error: "Agent not found" });

  const bindings = await prisma.agentIntegration.findMany({
    where: { agentId: req.params.id },
    include: { integration: true },
  });
  res.json(bindings.map((b) => b.integration));
}));

app.post("/api/agents/:id/integrations", wrap(async (req, res) => {
  const organizationId = getOrgId(req);
  const { integrationId } = req.body;
  if (!integrationId) return res.status(400).json({ error: "integrationId required" });

  // Verify both agent and integration belong to this org
  const agent = await prisma.agent.findFirst({
    where: { id: req.params.id, organizationId },
  });
  if (!agent) return res.status(404).json({ error: "Agent not found" });

  const integration = await prisma.backendIntegration.findFirst({
    where: { id: integrationId, organizationId },
  });
  if (!integration) return res.status(404).json({ error: "Integration not found" });

  await prisma.agentIntegration.upsert({
    where: {
      agentId_integrationId: { agentId: req.params.id, integrationId },
    },
    create: { agentId: req.params.id, integrationId },
    update: {},
  });
  res.json({ success: true });
}));

app.delete("/api/agents/:id/integrations/:integrationId", wrap(async (req, res) => {
  const organizationId = getOrgId(req);
  // Verify agent belongs to this org
  const agent = await prisma.agent.findFirst({
    where: { id: req.params.id, organizationId },
  });
  if (!agent) return res.status(404).json({ error: "Agent not found" });

  await prisma.agentIntegration.deleteMany({
    where: { agentId: req.params.id, integrationId: req.params.integrationId },
  });
  res.json({ success: true });
}));

// --------------- Schedules ---------------

app.get("/api/schedules", wrap(async (req, res) => {
  const organizationId = getOrgId(req);
  const rows = await prisma.schedule.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
  });
  res.json(rows);
}));

app.post("/api/schedules", wrap(async (req, res) => {
  const organizationId = getOrgId(req);
  const { name, agent_id, cron_expr, message } = req.body;
  if (!name || !agent_id || !cron_expr || !message) {
    return res.status(400).json({ error: "name, agent_id, cron_expr, and message are required" });
  }
  const schedule = await prisma.schedule.create({
    data: {
      organizationId,
      name,
      agentId: agent_id,
      cronExpr: cron_expr,
      message,
    },
  });
  res.status(201).json(schedule);
}));

app.put("/api/schedules/:id", wrap(async (req, res) => {
  const organizationId = getOrgId(req);
  const { name, agent_id, cron_expr, message, enabled } = req.body;

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name;
  if (agent_id !== undefined) data.agentId = agent_id;
  if (cron_expr !== undefined) data.cronExpr = cron_expr;
  if (message !== undefined) data.message = message;
  if (enabled !== undefined) data.enabled = enabled;

  const result = await prisma.schedule.updateMany({
    where: { id: req.params.id, organizationId },
    data,
  });
  if (!result.count) return res.status(404).json({ error: "Schedule not found" });

  const schedule = await prisma.schedule.findUnique({ where: { id: req.params.id } });
  res.json(schedule);
}));

app.delete("/api/schedules/:id", wrap(async (req, res) => {
  const organizationId = getOrgId(req);
  await prisma.schedule.deleteMany({
    where: { id: req.params.id, organizationId },
  });
  res.json({ success: true });
}));

// Run a schedule immediately (manual trigger)
app.post("/api/schedules/:id/run", wrap(async (req, res) => {
  const organizationId = getOrgId(req);
  const schedule = await prisma.schedule.findFirst({
    where: { id: req.params.id, organizationId },
  });
  if (!schedule) return res.status(404).json({ error: "Schedule not found" });

  await publishToAgent("scheduler", schedule.agentId, schedule.message, organizationId);
  await prisma.schedule.update({
    where: { id: schedule.id },
    data: { lastRun: new Date() },
  });
  await prisma.agentLog.create({
    data: {
      organizationId,
      agentId: schedule.agentId,
      level: "info",
      message: `Manual trigger: "${schedule.name}" → ${schedule.agentId}`,
    },
  });
  res.json({ success: true });
}));

// --------------- OpenClaw Gateway Proxy ---------------
// These endpoints proxy JSON-RPC calls to individual OpenClaw agent gateways

import { callAgentGateway, callAllAgentsGateway } from "./gateway-proxy";

// Generic proxy: call any gateway method on a specific agent
app.post("/api/agents/:id/gateway/:method", async (req, res) => {
  try {
    const organizationId = getOrgId(req);
    const result = await callAgentGateway(
      req.params.id,
      req.params.method.replace(/-/g, "."),
      req.body,
      8000,
      organizationId
    );
    res.json({ ok: true, result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gateway call failed";
    res.status(502).json({ ok: false, error: message });
  }
});

// Get agent config (openclaw.json)
app.get("/api/agents/:id/config", async (req, res) => {
  try {
    const organizationId = getOrgId(req);
    const result = await callAgentGateway(req.params.id, "config.get", undefined, 8000, organizationId);
    res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to get config";
    res.status(502).json({ error: message });
  }
});

// Update agent config
app.put("/api/agents/:id/config", async (req, res) => {
  try {
    const organizationId = getOrgId(req);
    const result = await callAgentGateway(req.params.id, "config.patch", {
      patch: req.body,
    }, 8000, organizationId);
    res.json({ ok: true, result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update config";
    res.status(502).json({ error: message });
  }
});

// List models available to an agent
app.get("/api/agents/:id/models", async (req, res) => {
  try {
    const organizationId = getOrgId(req);
    const result = await callAgentGateway(req.params.id, "models.list", undefined, 8000, organizationId);
    res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to list models";
    res.status(502).json({ error: message });
  }
});

// Get channel status for an agent
app.get("/api/agents/:id/channels", async (req, res) => {
  try {
    const organizationId = getOrgId(req);
    const result = await callAgentGateway(req.params.id, "channels.status", undefined, 8000, organizationId);
    res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to get channels";
    res.status(502).json({ error: message });
  }
});

// Get all channels across all agents
app.get("/api/channels", async (req, res) => {
  try {
    const organizationId = getOrgId(req);
    const results = await callAllAgentsGateway("channels.status", undefined, organizationId);
    res.json(results);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to get channels";
    res.status(502).json({ error: message });
  }
});

// Cron jobs on a specific agent
app.get("/api/agents/:id/cron", async (req, res) => {
  try {
    const organizationId = getOrgId(req);
    const result = await callAgentGateway(req.params.id, "cron.list", undefined, 8000, organizationId);
    res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to list cron jobs";
    res.status(502).json({ error: message });
  }
});

app.post("/api/agents/:id/cron", async (req, res) => {
  try {
    const organizationId = getOrgId(req);
    const result = await callAgentGateway(req.params.id, "cron.add", req.body, 8000, organizationId);
    res.json({ ok: true, result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to add cron job";
    res.status(502).json({ error: message });
  }
});

app.put("/api/agents/:id/cron/:jobId", async (req, res) => {
  try {
    const organizationId = getOrgId(req);
    const result = await callAgentGateway(req.params.id, "cron.update", {
      id: req.params.jobId,
      ...req.body,
    }, 8000, organizationId);
    res.json({ ok: true, result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update cron job";
    res.status(502).json({ error: message });
  }
});

app.delete("/api/agents/:id/cron/:jobId", async (req, res) => {
  try {
    const organizationId = getOrgId(req);
    const result = await callAgentGateway(req.params.id, "cron.remove", {
      id: req.params.jobId,
    }, 8000, organizationId);
    res.json({ ok: true, result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to remove cron job";
    res.status(502).json({ error: message });
  }
});

app.post("/api/agents/:id/cron/:jobId/run", async (req, res) => {
  try {
    const organizationId = getOrgId(req);
    const result = await callAgentGateway(req.params.id, "cron.run", {
      id: req.params.jobId,
    }, 8000, organizationId);
    res.json({ ok: true, result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to run cron job";
    res.status(502).json({ error: message });
  }
});

app.get("/api/agents/:id/cron/:jobId/runs", async (req, res) => {
  try {
    const organizationId = getOrgId(req);
    const result = await callAgentGateway(req.params.id, "cron.runs", {
      id: req.params.jobId,
    }, 8000, organizationId);
    res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to get cron runs";
    res.status(502).json({ error: message });
  }
});

// Skills on a specific agent
app.get("/api/agents/:id/skills", async (req, res) => {
  try {
    const organizationId = getOrgId(req);
    const result = await callAgentGateway(req.params.id, "skills.status", undefined, 8000, organizationId);
    res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to get skills";
    res.status(502).json({ error: message });
  }
});

// Heartbeat
app.get("/api/agents/:id/heartbeat", async (req, res) => {
  try {
    const organizationId = getOrgId(req);
    const result = await callAgentGateway(req.params.id, "last-heartbeat", undefined, 8000, organizationId);
    res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to get heartbeat";
    res.status(502).json({ error: message });
  }
});

app.post("/api/agents/:id/heartbeat", async (req, res) => {
  try {
    const organizationId = getOrgId(req);
    const result = await callAgentGateway(req.params.id, "wake", {
      text: req.body.text || "heartbeat",
      mode: req.body.mode || "now",
    }, 8000, organizationId);
    res.json({ ok: true, result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to trigger heartbeat";
    res.status(502).json({ error: message });
  }
});

// Sessions
app.get("/api/agents/:id/sessions", async (req, res) => {
  try {
    const organizationId = getOrgId(req);
    const result = await callAgentGateway(req.params.id, "sessions.list", undefined, 8000, organizationId);
    res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to list sessions";
    res.status(502).json({ error: message });
  }
});

// Agent files (for .md files)
app.get("/api/agents/:id/files", async (req, res) => {
  try {
    const organizationId = getOrgId(req);
    const result = await callAgentGateway(req.params.id, "agents.files.list", {
      agentId: req.query.agentId as string,
    }, 8000, organizationId);
    res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to list files";
    res.status(502).json({ error: message });
  }
});

app.get("/api/agents/:id/files/:filename", async (req, res) => {
  try {
    const organizationId = getOrgId(req);
    const result = await callAgentGateway(req.params.id, "agents.files.get", {
      agentId: req.query.agentId as string,
      filename: req.params.filename,
    }, 8000, organizationId);
    res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to get file";
    res.status(502).json({ error: message });
  }
});

app.put("/api/agents/:id/files/:filename", async (req, res) => {
  try {
    const organizationId = getOrgId(req);
    const result = await callAgentGateway(req.params.id, "agents.files.set", {
      agentId: req.query.agentId as string,
      filename: req.params.filename,
      content: req.body.content,
    }, 8000, organizationId);
    res.json({ ok: true, result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to save file";
    res.status(502).json({ error: message });
  }
});

// Tools catalog
app.get("/api/agents/:id/tools-catalog", async (req, res) => {
  try {
    const organizationId = getOrgId(req);
    const result = await callAgentGateway(req.params.id, "tools.catalog", undefined, 8000, organizationId);
    res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to get tools";
    res.status(502).json({ error: message });
  }
});

// Chat send via gateway (for streaming support)
app.post("/api/agents/:id/chat/send", wrap(async (req, res) => {
  const organizationId = getOrgId(req);
  const agent = await getAgent(req.params.id, organizationId);
  if (!agent) return res.status(404).json({ error: "Agent not found" });

  const userMessage = req.body.message || req.body.text;
  if (!userMessage) return res.status(400).json({ error: "message is required" });

  const wsUrl = agent.internalUrl.replace(/^http/, "ws");

  // Persist the user's message to Postgres — org-scoped
  await prisma.message.create({
    data: {
      organizationId,
      fromAgent: "dashboard",
      toAgent: req.params.id,
      content: userMessage,
    },
  });

  // Set up SSE streaming to the client
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const ws = new (await import("ws")).default(wsUrl);
  const sendId = Date.now();
  let closed = false;
  let fullResponse = "";

  const cleanup = async () => {
    if (!closed) {
      closed = true;
      ws.close();
      // Persist the agent's response if we got one — org-scoped
      if (fullResponse.trim()) {
        try {
          await prisma.message.create({
            data: {
              organizationId,
              fromAgent: req.params.id,
              toAgent: "dashboard",
              content: fullResponse.trim(),
            },
          });
        } catch (err) {
          console.error("Failed to persist agent response:", err);
        }
      }
      res.end();
    }
  };

  ws.on("open", () => {
    ws.send(
      JSON.stringify({
        jsonrpc: "2.0",
        id: sendId,
        method: "chat.send",
        params: {
          text: userMessage,
          sessionKey: req.body.sessionKey,
        },
      })
    );
  });

  ws.on("message", (data: Buffer) => {
    if (closed) return;
    try {
      const msg = JSON.parse(data.toString());
      // Forward all events to the client as SSE
      if (msg.method === "chat" || msg.method === "agent" || msg.method === "session.message") {
        const text = msg.params?.text ?? msg.params?.content ?? msg.params?.delta ?? msg.params?.chunk ?? null;
        if (text) {
          fullResponse += text;
          res.write(`data: ${JSON.stringify({ type: "text", content: text })}\n\n`);
        }
      }
      // Check for final response to our send
      if (msg.id === sendId) {
        res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
        cleanup();
      }
    } catch {
      // ignore
    }
  });

  ws.on("error", () => cleanup());
  ws.on("close", () => cleanup());
  req.on("close", () => cleanup());

  // Safety timeout
  setTimeout(cleanup, 120000);
}));

// --------------- GLORB Control Plane ---------------

app.post("/api/glorb/missions", strictLimiter, enforceMissionLimit);
app.use("/api/glorb", glorbRouter);

// --------------- Start ---------------

Promise.all([initAgentRegistry(), initGlorbSchema(), initIntegrationsSchema()])
  .then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`SharkSwarm API gateway listening on :${PORT}`);
      console.log(`GLORB control plane mounted at /api/glorb`);
    });
  })
  .catch((err) => {
    console.error("Failed to initialize:", err);
    process.exit(1);
  });

process.on("SIGTERM", async () => {
  await pool.end();
  process.exit(0);
});
