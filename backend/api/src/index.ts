import express from "express";
import cors from "cors";
import { query, pool } from "./db";
import { publishToAgent } from "./redis";
import { getAllAgents, getAgent, updateAgent, createAgent, deleteAgent, initAgentRegistry } from "./agents";
import {
  getAllIntegrations,
  getIntegration,
  createIntegration,
  updateIntegration,
  deleteIntegration,
  getAgentIntegrations,
  bindIntegrationToAgent,
  unbindIntegrationFromAgent,
} from "./integrations";

const app = express();
const PORT = Number(process.env.API_PORT) || 4000;

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  })
);
app.use(express.json());

// --------------- Health ---------------

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// --------------- Agents ---------------

app.get("/api/agents", async (_req, res) => {
  const agents = await getAllAgents();

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
});

app.get("/api/agents/:id", async (req, res) => {
  const agent = await getAgent(req.params.id);
  if (!agent) return res.status(404).json({ error: "Agent not found" });
  res.json(agent);
});

app.post("/api/agents", async (req, res) => {
  const { name, systemPrompt, model, tools } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });
  try {
    const agent = await createAgent({
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

app.put("/api/agents/:id", async (req, res) => {
  const updated = await updateAgent(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: "Agent not found" });
  res.json(updated);
});

app.delete("/api/agents/:id", async (req, res) => {
  const ok = await deleteAgent(req.params.id);
  if (!ok) return res.status(404).json({ error: "Agent not found" });
  res.json({ success: true });
});

app.post("/api/agents/:id/reset", async (req, res) => {
  const agent = await getAgent(req.params.id);
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
});

// --------------- Messages ---------------

app.post("/api/send-message", async (req, res) => {
  const { to_agent, message } = req.body;

  if (!to_agent || !message) {
    return res.status(400).json({ error: "to_agent and message are required" });
  }

  try {
    await publishToAgent("dashboard", to_agent, message);
    // redis-bridge persists the message to Postgres — no need to insert here too
    res.json({ success: true });
  } catch (err) {
    console.error("send-message error:", err);
    res.status(500).json({ error: "Failed to send message" });
  }
});

app.get("/api/messages", async (req, res) => {
  const limit = Number(req.query.limit) || 50;
  const rows = await query(
    `SELECT * FROM messages ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  res.json(rows);
});

// --------------- Logs ---------------

app.get("/api/logs", async (req, res) => {
  const limit = Number(req.query.limit) || 50;
  const type = (req.query.type as string) || "agent_logs";

  if (type === "messages") {
    const rows = await query(
      `SELECT * FROM messages ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    return res.json(rows);
  }

  const rows = await query(
    `SELECT * FROM agent_logs ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  res.json(rows);
});

// --------------- Tasks ---------------

app.get("/api/tasks", async (req, res) => {
  const limit = Number(req.query.limit) || 100;
  const status = req.query.status as string | undefined;
  const agent = req.query.agent as string | undefined;

  let sql = "SELECT * FROM tasks";
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }
  if (agent) {
    params.push(agent);
    conditions.push(`(from_agent = $${params.length} OR to_agent = $${params.length})`);
  }
  if (conditions.length) sql += " WHERE " + conditions.join(" AND ");
  sql += " ORDER BY created_at DESC";
  params.push(limit);
  sql += ` LIMIT $${params.length}`;

  const rows = await query(sql, params);
  res.json(rows);
});

app.post("/api/tasks", async (req, res) => {
  const { from_agent, to_agent, message } = req.body;
  if (!from_agent || !to_agent || !message) {
    return res.status(400).json({ error: "from_agent, to_agent, and message are required" });
  }
  const rows = await query(
    `INSERT INTO tasks (from_agent, to_agent, message) VALUES ($1, $2, $3) RETURNING *`,
    [from_agent, to_agent, message]
  );
  res.status(201).json(rows[0]);
});

app.put("/api/tasks/:id", async (req, res) => {
  const { status, result } = req.body;
  const rows = await query(
    `UPDATE tasks SET status = COALESCE($1, status), result = COALESCE($2, result), updated_at = NOW()
     WHERE id = $3 RETURNING *`,
    [status || null, result || null, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: "Task not found" });
  res.json(rows[0]);
});

// --------------- Agent Conversation History ---------------

app.get("/api/agents/:id/messages", async (req, res) => {
  const agentId = req.params.id;
  const limit = Number(req.query.limit) || 100;
  const rows = await query(
    `SELECT * FROM messages
     WHERE from_agent = $1 OR to_agent = $1
     ORDER BY created_at ASC
     LIMIT $2`,
    [agentId, limit]
  );
  res.json(rows);
});

// --------------- Enhanced Logs ---------------

app.get("/api/logs/filtered", async (req, res) => {
  const limit = Number(req.query.limit) || 100;
  const agent = req.query.agent as string | undefined;
  const level = req.query.level as string | undefined;
  const since = req.query.since as string | undefined;

  let sql = "SELECT * FROM agent_logs";
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (agent) {
    params.push(agent);
    conditions.push(`agent_id = $${params.length}`);
  }
  if (level) {
    params.push(level);
    conditions.push(`level = $${params.length}`);
  }
  if (since) {
    params.push(since);
    conditions.push(`created_at >= $${params.length}::timestamptz`);
  }
  if (conditions.length) sql += " WHERE " + conditions.join(" AND ");
  sql += " ORDER BY created_at DESC";
  params.push(limit);
  sql += ` LIMIT $${params.length}`;

  const rows = await query(sql, params);
  res.json(rows);
});

// --------------- System Health ---------------

app.get("/api/health/system", async (_req, res) => {
  const agents = await getAllAgents();

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

      // Last activity from messages table
      const lastMsg = await query(
        `SELECT created_at FROM messages WHERE from_agent = $1 OR to_agent = $1 ORDER BY created_at DESC LIMIT 1`,
        [agent.id]
      );

      return {
        id: agent.id,
        name: agent.name,
        status,
        latencyMs,
        lastActivity: lastMsg.length ? (lastMsg[0] as { created_at: string }).created_at : null,
      };
    })
  );

  // DB + Redis checks
  let dbOk = false;
  try {
    await query("SELECT 1");
    dbOk = true;
  } catch { /* */ }

  let redisOk = false;
  try {
    const { redis } = await import("./redis");
    const pong = await redis.ping();
    redisOk = pong === "PONG";
  } catch { /* */ }

  // Task stats
  const taskStats = await query(
    `SELECT status, COUNT(*)::int as count FROM tasks GROUP BY status`
  );

  res.json({
    agents: agentHealth,
    infrastructure: { postgres: dbOk, redis: redisOk },
    tasks: Object.fromEntries(
      (taskStats as { status: string; count: number }[]).map((r) => [r.status, r.count])
    ),
  });
});

// --------------- Tool Integrations ---------------

app.get("/api/integrations", (_req, res) => {
  res.json(getAllIntegrations());
});

app.get("/api/integrations/:id", (req, res) => {
  const tool = getIntegration(req.params.id);
  if (!tool) return res.status(404).json({ error: "Integration not found" });
  res.json(tool);
});

app.post("/api/integrations", (req, res) => {
  const { type } = req.body;
  if (!type || !["api", "mcp"].includes(type)) {
    return res.status(400).json({ error: "type must be 'api' or 'mcp'" });
  }
  const created = createIntegration(req.body);
  res.status(201).json(created);
});

app.put("/api/integrations/:id", (req, res) => {
  const updated = updateIntegration(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: "Integration not found" });
  res.json(updated);
});

app.delete("/api/integrations/:id", (req, res) => {
  const ok = deleteIntegration(req.params.id);
  if (!ok) return res.status(404).json({ error: "Integration not found" });
  res.json({ success: true });
});

// Test an API tool integration by making the actual HTTP call
app.post("/api/integrations/:id/test", async (req, res) => {
  const tool = getIntegration(req.params.id);
  if (!tool) return res.status(404).json({ error: "Integration not found" });

  if (tool.type === "api") {
    try {
      // Replace template placeholders with provided params
      let url = tool.url;
      let body = tool.bodyTemplate;
      const params = req.body.params || {};
      for (const [key, value] of Object.entries(params)) {
        url = url.replace(`{{${key}}}`, String(value));
        body = body.replace(`{{${key}}}`, String(value));
      }

      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10000);
      const r = await fetch(url, {
        method: tool.method,
        headers: { "Content-Type": "application/json", ...tool.headers },
        body: tool.method !== "GET" && body ? body : undefined,
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
    // For MCP, just verify the config looks valid
    const valid =
      (tool.transport === "stdio" && tool.command) ||
      (["sse", "streamable-http"].includes(tool.transport) && tool.url);
    res.json({ ok: !!valid, status: valid ? "config_valid" : "invalid_config" });
  } else {
    res.status(400).json({ error: "Unknown integration type" });
  }
});

// --------------- Agent ↔ Integration Bindings ---------------

app.get("/api/agents/:id/integrations", (req, res) => {
  res.json(getAgentIntegrations(req.params.id));
});

app.post("/api/agents/:id/integrations", (req, res) => {
  const { integrationId } = req.body;
  if (!integrationId) return res.status(400).json({ error: "integrationId required" });
  const ok = bindIntegrationToAgent(req.params.id, integrationId);
  if (!ok) return res.status(404).json({ error: "Integration not found" });
  res.json({ success: true });
});

app.delete("/api/agents/:id/integrations/:integrationId", (req, res) => {
  unbindIntegrationFromAgent(req.params.id, req.params.integrationId);
  res.json({ success: true });
});

// --------------- Schedules ---------------

app.get("/api/schedules", async (_req, res) => {
  const rows = await query("SELECT * FROM schedules ORDER BY created_at DESC");
  res.json(rows);
});

app.post("/api/schedules", async (req, res) => {
  const { name, agent_id, cron_expr, message } = req.body;
  if (!name || !agent_id || !cron_expr || !message) {
    return res.status(400).json({ error: "name, agent_id, cron_expr, and message are required" });
  }
  const rows = await query(
    `INSERT INTO schedules (name, agent_id, cron_expr, message) VALUES ($1, $2, $3, $4) RETURNING *`,
    [name, agent_id, cron_expr, message]
  );
  res.status(201).json(rows[0]);
});

app.put("/api/schedules/:id", async (req, res) => {
  const { name, agent_id, cron_expr, message, enabled } = req.body;
  const rows = await query(
    `UPDATE schedules
     SET name      = COALESCE($1, name),
         agent_id  = COALESCE($2, agent_id),
         cron_expr = COALESCE($3, cron_expr),
         message   = COALESCE($4, message),
         enabled   = COALESCE($5, enabled)
     WHERE id = $6 RETURNING *`,
    [name ?? null, agent_id ?? null, cron_expr ?? null, message ?? null, enabled ?? null, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: "Schedule not found" });
  res.json(rows[0]);
});

app.delete("/api/schedules/:id", async (req, res) => {
  await query("DELETE FROM schedules WHERE id = $1", [req.params.id]);
  res.json({ success: true });
});

// Run a schedule immediately (manual trigger)
app.post("/api/schedules/:id/run", async (req, res) => {
  const rows = await query("SELECT * FROM schedules WHERE id = $1", [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: "Schedule not found" });
  const schedule = rows[0] as { agent_id: string; message: string; name: string; id: number };

  await publishToAgent("scheduler", schedule.agent_id, schedule.message);
  await query("UPDATE schedules SET last_run = NOW() WHERE id = $1", [schedule.id]);
  await query(
    "INSERT INTO agent_logs (agent_id, level, message) VALUES ($1, $2, $3)",
    ["scheduler", "info", `Manual trigger: "${schedule.name}" → ${schedule.agent_id}`]
  );
  res.json({ success: true });
});

// --------------- Start ---------------

initAgentRegistry()
  .then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`SharkSwarm API gateway listening on :${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to init agent registry:", err);
    process.exit(1);
  });

process.on("SIGTERM", async () => {
  await pool.end();
  process.exit(0);
});
