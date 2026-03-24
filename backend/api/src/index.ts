import express from "express";
import cors from "cors";
import { query, pool } from "./db";
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

const app = express();
const PORT = Number(process.env.API_PORT) || 4000;

app.use(
  cors({
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN
      : (requestOrigin, callback) => callback(null, requestOrigin || true),
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  })
);
app.use(express.json());

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

// --------------- Agents ---------------

app.get("/api/agents", wrap(async (_req, res) => {
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
}));

app.get("/api/agents/:id", wrap(async (req, res) => {
  const agent = await getAgent(req.params.id);
  if (!agent) return res.status(404).json({ error: "Agent not found" });
  res.json(agent);
}));

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

app.put("/api/agents/:id", wrap(async (req, res) => {
  const updated = await updateAgent(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: "Agent not found" });
  res.json(updated);
}));

app.delete("/api/agents/:id", wrap(async (req, res) => {
  const ok = await deleteAgent(req.params.id);
  if (!ok) return res.status(404).json({ error: "Agent not found" });
  res.json({ success: true });
}));

app.post("/api/agents/:id/reset", wrap(async (req, res) => {
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
}));

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

app.get("/api/messages", wrap(async (req, res) => {
  const limit = Number(req.query.limit) || 50;
  const rows = await query(
    `SELECT * FROM messages ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  res.json(rows);
}));

// --------------- Logs ---------------

app.get("/api/logs", wrap(async (req, res) => {
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
}));

// --------------- Tasks ---------------

app.get("/api/tasks", wrap(async (req, res) => {
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
}));

app.post("/api/tasks", wrap(async (req, res) => {
  const { from_agent, to_agent, message } = req.body;
  if (!from_agent || !to_agent || !message) {
    return res.status(400).json({ error: "from_agent, to_agent, and message are required" });
  }
  const rows = await query(
    `INSERT INTO tasks (from_agent, to_agent, message) VALUES ($1, $2, $3) RETURNING *`,
    [from_agent, to_agent, message]
  );
  res.status(201).json(rows[0]);
}));

app.put("/api/tasks/:id", wrap(async (req, res) => {
  const { status, result } = req.body;
  const rows = await query(
    `UPDATE tasks SET status = COALESCE($1, status), result = COALESCE($2, result), updated_at = NOW()
     WHERE id = $3 RETURNING *`,
    [status || null, result || null, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: "Task not found" });
  res.json(rows[0]);
}));

// --------------- Agent Conversation History ---------------

app.get("/api/agents/:id/messages", wrap(async (req, res) => {
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
}));

// --------------- Enhanced Logs ---------------

app.get("/api/logs/filtered", wrap(async (req, res) => {
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
}));

// --------------- System Health ---------------

app.get("/api/health/system", wrap(async (_req, res) => {
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
}));

// --------------- Tool Integrations ---------------

app.get("/api/integrations", wrap(async (_req, res) => {
  res.json(await getAllIntegrations());
}));

app.get("/api/integrations/:id", wrap(async (req, res) => {
  const tool = await getIntegration(req.params.id);
  if (!tool) return res.status(404).json({ error: "Integration not found" });
  res.json(tool);
}));

app.post("/api/integrations", wrap(async (req, res) => {
  const { type } = req.body;
  if (!type || !["api", "mcp"].includes(type)) {
    return res.status(400).json({ error: "type must be 'api' or 'mcp'" });
  }
  const created = await createIntegration(req.body);
  res.status(201).json(created);
}));

app.put("/api/integrations/:id", wrap(async (req, res) => {
  const updated = await updateIntegration(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: "Integration not found" });
  res.json(updated);
}));

app.delete("/api/integrations/:id", wrap(async (req, res) => {
  const ok = await deleteIntegration(req.params.id);
  if (!ok) return res.status(404).json({ error: "Integration not found" });
  res.json({ success: true });
}));

// Test an API tool integration by making the actual HTTP call
app.post("/api/integrations/:id/test", wrap(async (req, res) => {
  const tool = await getIntegration(req.params.id);
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
}));

// --------------- Agent ↔ Integration Bindings ---------------

app.get("/api/agents/:id/integrations", wrap(async (req, res) => {
  res.json(await getAgentIntegrations(req.params.id));
}));

app.post("/api/agents/:id/integrations", wrap(async (req, res) => {
  const { integrationId } = req.body;
  if (!integrationId) return res.status(400).json({ error: "integrationId required" });
  const ok = await bindIntegrationToAgent(req.params.id, integrationId);
  if (!ok) return res.status(404).json({ error: "Integration not found" });
  res.json({ success: true });
}));

app.delete("/api/agents/:id/integrations/:integrationId", wrap(async (req, res) => {
  await unbindIntegrationFromAgent(req.params.id, req.params.integrationId);
  res.json({ success: true });
}));

// --------------- Schedules ---------------

app.get("/api/schedules", wrap(async (_req, res) => {
  const rows = await query("SELECT * FROM schedules ORDER BY created_at DESC");
  res.json(rows);
}));

app.post("/api/schedules", wrap(async (req, res) => {
  const { name, agent_id, cron_expr, message } = req.body;
  if (!name || !agent_id || !cron_expr || !message) {
    return res.status(400).json({ error: "name, agent_id, cron_expr, and message are required" });
  }
  const rows = await query(
    `INSERT INTO schedules (name, agent_id, cron_expr, message) VALUES ($1, $2, $3, $4) RETURNING *`,
    [name, agent_id, cron_expr, message]
  );
  res.status(201).json(rows[0]);
}));

app.put("/api/schedules/:id", wrap(async (req, res) => {
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
}));

app.delete("/api/schedules/:id", wrap(async (req, res) => {
  await query("DELETE FROM schedules WHERE id = $1", [req.params.id]);
  res.json({ success: true });
}));

// Run a schedule immediately (manual trigger)
app.post("/api/schedules/:id/run", wrap(async (req, res) => {
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
}));

// --------------- OpenClaw Gateway Proxy ---------------
// These endpoints proxy JSON-RPC calls to individual OpenClaw agent gateways

import { callAgentGateway, callAllAgentsGateway } from "./gateway-proxy";

// Generic proxy: call any gateway method on a specific agent
app.post("/api/agents/:id/gateway/:method", async (req, res) => {
  try {
    const result = await callAgentGateway(
      req.params.id,
      req.params.method.replace(/-/g, "."),
      req.body
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
    const result = await callAgentGateway(req.params.id, "config.get");
    res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to get config";
    res.status(502).json({ error: message });
  }
});

// Update agent config
app.put("/api/agents/:id/config", async (req, res) => {
  try {
    const result = await callAgentGateway(req.params.id, "config.patch", {
      patch: req.body,
    });
    res.json({ ok: true, result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update config";
    res.status(502).json({ error: message });
  }
});

// List models available to an agent
app.get("/api/agents/:id/models", async (req, res) => {
  try {
    const result = await callAgentGateway(req.params.id, "models.list");
    res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to list models";
    res.status(502).json({ error: message });
  }
});

// Get channel status for an agent
app.get("/api/agents/:id/channels", async (req, res) => {
  try {
    const result = await callAgentGateway(req.params.id, "channels.status");
    res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to get channels";
    res.status(502).json({ error: message });
  }
});

// Get all channels across all agents
app.get("/api/channels", async (_req, res) => {
  try {
    const results = await callAllAgentsGateway("channels.status");
    res.json(results);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to get channels";
    res.status(502).json({ error: message });
  }
});

// Cron jobs on a specific agent
app.get("/api/agents/:id/cron", async (req, res) => {
  try {
    const result = await callAgentGateway(req.params.id, "cron.list");
    res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to list cron jobs";
    res.status(502).json({ error: message });
  }
});

app.post("/api/agents/:id/cron", async (req, res) => {
  try {
    const result = await callAgentGateway(req.params.id, "cron.add", req.body);
    res.json({ ok: true, result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to add cron job";
    res.status(502).json({ error: message });
  }
});

app.put("/api/agents/:id/cron/:jobId", async (req, res) => {
  try {
    const result = await callAgentGateway(req.params.id, "cron.update", {
      id: req.params.jobId,
      ...req.body,
    });
    res.json({ ok: true, result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update cron job";
    res.status(502).json({ error: message });
  }
});

app.delete("/api/agents/:id/cron/:jobId", async (req, res) => {
  try {
    const result = await callAgentGateway(req.params.id, "cron.remove", {
      id: req.params.jobId,
    });
    res.json({ ok: true, result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to remove cron job";
    res.status(502).json({ error: message });
  }
});

app.post("/api/agents/:id/cron/:jobId/run", async (req, res) => {
  try {
    const result = await callAgentGateway(req.params.id, "cron.run", {
      id: req.params.jobId,
    });
    res.json({ ok: true, result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to run cron job";
    res.status(502).json({ error: message });
  }
});

app.get("/api/agents/:id/cron/:jobId/runs", async (req, res) => {
  try {
    const result = await callAgentGateway(req.params.id, "cron.runs", {
      id: req.params.jobId,
    });
    res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to get cron runs";
    res.status(502).json({ error: message });
  }
});

// Skills on a specific agent
app.get("/api/agents/:id/skills", async (req, res) => {
  try {
    const result = await callAgentGateway(req.params.id, "skills.status");
    res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to get skills";
    res.status(502).json({ error: message });
  }
});

// Heartbeat
app.get("/api/agents/:id/heartbeat", async (req, res) => {
  try {
    const result = await callAgentGateway(req.params.id, "last-heartbeat");
    res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to get heartbeat";
    res.status(502).json({ error: message });
  }
});

app.post("/api/agents/:id/heartbeat", async (req, res) => {
  try {
    const result = await callAgentGateway(req.params.id, "wake", {
      text: req.body.text || "heartbeat",
      mode: req.body.mode || "now",
    });
    res.json({ ok: true, result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to trigger heartbeat";
    res.status(502).json({ error: message });
  }
});

// Sessions
app.get("/api/agents/:id/sessions", async (req, res) => {
  try {
    const result = await callAgentGateway(req.params.id, "sessions.list");
    res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to list sessions";
    res.status(502).json({ error: message });
  }
});

// Agent files (for .md files)
app.get("/api/agents/:id/files", async (req, res) => {
  try {
    const result = await callAgentGateway(req.params.id, "agents.files.list", {
      agentId: req.query.agentId as string,
    });
    res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to list files";
    res.status(502).json({ error: message });
  }
});

app.get("/api/agents/:id/files/:filename", async (req, res) => {
  try {
    const result = await callAgentGateway(req.params.id, "agents.files.get", {
      agentId: req.query.agentId as string,
      filename: req.params.filename,
    });
    res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to get file";
    res.status(502).json({ error: message });
  }
});

app.put("/api/agents/:id/files/:filename", async (req, res) => {
  try {
    const result = await callAgentGateway(req.params.id, "agents.files.set", {
      agentId: req.query.agentId as string,
      filename: req.params.filename,
      content: req.body.content,
    });
    res.json({ ok: true, result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to save file";
    res.status(502).json({ error: message });
  }
});

// Tools catalog
app.get("/api/agents/:id/tools-catalog", async (req, res) => {
  try {
    const result = await callAgentGateway(req.params.id, "tools.catalog");
    res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to get tools";
    res.status(502).json({ error: message });
  }
});

// Chat send via gateway (for streaming support)
app.post("/api/agents/:id/chat/send", wrap(async (req, res) => {
  const agent = await getAgent(req.params.id);
  if (!agent) return res.status(404).json({ error: "Agent not found" });

  const wsUrl = agent.internalUrl.replace(/^http/, "ws");

  // Set up SSE streaming to the client
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const ws = new (await import("ws")).default(wsUrl);
  const sendId = Date.now();
  let closed = false;

  const cleanup = () => {
    if (!closed) {
      closed = true;
      ws.close();
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
          text: req.body.message || req.body.text,
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
        res.write(`data: ${JSON.stringify(msg)}\n\n`);
      }
      // Check for final response to our send
      if (msg.id === sendId) {
        res.write(`data: ${JSON.stringify({ type: "done", result: msg.result })}\n\n`);
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
