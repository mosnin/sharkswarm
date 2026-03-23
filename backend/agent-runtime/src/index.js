/**
 * SharkSwarm Agent Runtime — OpenAI edition
 *
 * Each agent container runs this process. Env vars control identity:
 *   AGENT_ID, AGENT_NAME, SYSTEM_PROMPT, OPENAI_MODEL
 *
 * Protocol:
 *   - Receives messages via Redis channel  agent:{AGENT_ID}:inbox
 *   - Replies by publishing to             agent:{from_agent}:inbox  (or logs only)
 *   - Persists replies to Postgres messages + agent_logs tables
 *   - Exposes HTTP /api/health for the API gateway health checks
 */

import express from "express";
import Redis from "ioredis";
import pg from "pg";
import OpenAI from "openai";

// ── Config ────────────────────────────────────────────────────────
const AGENT_ID     = process.env.AGENT_ID     || "agent-unknown";
const AGENT_NAME   = process.env.AGENT_NAME   || "Agent";
const MODEL        = process.env.OPENAI_MODEL || "gpt-4o-mini";
const SYSTEM_PROMPT = process.env.SYSTEM_PROMPT ||
  `You are ${AGENT_NAME}, an autonomous AI agent in the SharkSwarm system.`;

const FULL_SYSTEM_PROMPT = `${SYSTEM_PROMPT}

You run as a persistent process inside SharkSwarm — a multi-agent orchestration platform. SharkSwarm handles your infrastructure (Redis messaging, Postgres persistence, scheduling). You are NOT ChatGPT and should not respond like a generic assistant.

You are an agent. Act like one:
- Be direct and concise. Do not list bullet points of generic capabilities unprompted.
- When given a task, attempt it — don't just describe what you could do.
- When asked what you can do, answer in 1-2 sentences specific to your role, not a generic feature list.
- You communicate with other agents via Redis messages. You can receive scheduled tasks automatically.
- Your model is ${MODEL}. You do not have internet access or tool use unless explicitly configured.

Do not say things like "I can assist with a wide range of tasks including..." — just respond naturally and get to the point.`;
const PORT         = Number(process.env.PORT) || 3000;
const REDIS_URL    = process.env.REDIS_URL    || "redis://localhost:6379";
const DATABASE_URL = process.env.DATABASE_URL || "";
const INBOX        = `agent:${AGENT_ID}:inbox`;

// ── OpenAI ────────────────────────────────────────────────────────
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Postgres ──────────────────────────────────────────────────────
const pgPool = new pg.Pool({ connectionString: DATABASE_URL });

async function dbQuery(sql, params = []) {
  const client = await pgPool.connect();
  try {
    const result = await client.query(sql, params);
    return result.rows;
  } finally {
    client.release();
  }
}

async function log(level, message) {
  console.log(`[${AGENT_ID}] [${level}] ${message}`);
  try {
    await dbQuery(
      "INSERT INTO agent_logs (agent_id, level, message) VALUES ($1, $2, $3)",
      [AGENT_ID, level, message]
    );
  } catch (err) {
    console.error("Failed to write log:", err.message);
  }
}

async function persistMessage(fromAgent, toAgent, channel, content) {
  try {
    await dbQuery(
      "INSERT INTO messages (from_agent, to_agent, channel, content) VALUES ($1, $2, $3, $4)",
      [fromAgent, toAgent, channel, content]
    );
  } catch (err) {
    console.error("Failed to persist message:", err.message);
  }
}

// Keep a short in-memory conversation history per sender (last 20 messages)
const histories = new Map();

function getHistory(senderId) {
  if (!histories.has(senderId)) histories.set(senderId, []);
  return histories.get(senderId);
}

// ── Message handler ───────────────────────────────────────────────
async function handleMessage(payload) {
  const { from_agent, to_agent, message } = payload;
  if (to_agent !== AGENT_ID) return; // not for us

  await log("info", `Message from ${from_agent}: ${message.slice(0, 120)}`);

  const history = getHistory(from_agent);
  history.push({ role: "user", content: message });
  if (history.length > 20) history.splice(0, history.length - 20);

  let reply = "";
  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages: [{ role: "system", content: FULL_SYSTEM_PROMPT }, ...history],
    });
    reply = completion.choices[0].message.content || "(no response)";
    history.push({ role: "assistant", content: reply });
  } catch (err) {
    reply = `Error calling OpenAI: ${err.message}`;
    await log("error", reply);
  }

  // Publish reply — redis-bridge will persist it to Postgres automatically
  const replyChannel = `agent:${from_agent}:inbox`;
  await publisher.publish(
    replyChannel,
    JSON.stringify({ from_agent: AGENT_ID, to_agent: from_agent, message: reply })
  );

  await log("info", `Replied to ${from_agent}: ${reply.slice(0, 120)}`);
}

// ── Redis ─────────────────────────────────────────────────────────
const subscriber = new Redis(REDIS_URL);
const publisher  = new Redis(REDIS_URL);

subscriber.subscribe(INBOX, (err) => {
  if (err) console.error("Redis subscribe error:", err.message);
  else console.log(`[${AGENT_ID}] Subscribed to ${INBOX}`);
});

subscriber.on("message", async (_channel, raw) => {
  try {
    const payload = JSON.parse(raw);
    await handleMessage(payload);
  } catch (err) {
    console.error("Message parse error:", err.message);
  }
});

// ── HTTP server ───────────────────────────────────────────────────
const app = express();
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", agent: AGENT_ID, model: MODEL });
});

app.post("/api/reset", (req, res) => {
  const sender = req.body?.sender;
  if (sender) {
    histories.delete(sender);
  } else {
    histories.clear();
  }
  res.json({ success: true });
});

app.listen(PORT, "0.0.0.0", async () => {
  console.log(`[${AGENT_ID}] ${AGENT_NAME} listening on :${PORT}`);
  await log("info", `${AGENT_NAME} started — model: ${MODEL}`);
});

// ── Graceful shutdown ─────────────────────────────────────────────
process.on("SIGTERM", async () => {
  await pgPool.end();
  subscriber.disconnect();
  publisher.disconnect();
  process.exit(0);
});
