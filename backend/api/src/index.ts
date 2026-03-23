import express from "express";
import cors from "cors";
import { query, pool } from "./db";
import { publishToAgent } from "./redis";
import { getAllAgents, getAgent, updateAgent } from "./agents";

const app = express();
const PORT = Number(process.env.API_PORT) || 4000;

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST", "PUT", "OPTIONS"],
  })
);
app.use(express.json());

// --------------- Health ---------------

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// --------------- Agents ---------------

app.get("/api/agents", async (_req, res) => {
  const agents = getAllAgents();

  const results = await Promise.all(
    agents.map(async (agent) => {
      let status: "online" | "offline" = "offline";
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 2000);
        const r = await fetch(`${agent.internalUrl}/api/health`, {
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

app.get("/api/agents/:id", (req, res) => {
  const agent = getAgent(req.params.id);
  if (!agent) return res.status(404).json({ error: "Agent not found" });
  res.json(agent);
});

app.put("/api/agents/:id", (req, res) => {
  const updated = updateAgent(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: "Agent not found" });
  res.json(updated);
});

// --------------- Messages ---------------

app.post("/api/send-message", async (req, res) => {
  const { to_agent, message } = req.body;

  if (!to_agent || !message) {
    return res.status(400).json({ error: "to_agent and message are required" });
  }

  try {
    await publishToAgent("dashboard", to_agent, message);

    await query(
      `INSERT INTO messages (from_agent, to_agent, channel, content)
       VALUES ($1, $2, $3, $4)`,
      ["dashboard", to_agent, `agent:${to_agent}:inbox`, message]
    );

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

// --------------- Start ---------------

app.listen(PORT, "0.0.0.0", () => {
  console.log(`SharkSwarm API gateway listening on :${PORT}`);
});

process.on("SIGTERM", async () => {
  await pool.end();
  process.exit(0);
});
