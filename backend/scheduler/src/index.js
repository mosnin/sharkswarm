/**
 * SharkSwarm Scheduler
 *
 * Loads cron schedules from Postgres and fires messages to agents via Redis.
 * Polls for schedule changes every 60s so new schedules take effect without restart.
 */

import cron from "node-cron";
import Redis from "ioredis";
import pg from "pg";

const REDIS_URL    = process.env.REDIS_URL    || "redis://redis:6379";
const DATABASE_URL = process.env.DATABASE_URL || "";

const redis  = new Redis(REDIS_URL);
const pgPool = new pg.Pool({ connectionString: DATABASE_URL });

async function query(sql, params = []) {
  const client = await pgPool.connect();
  try {
    const result = await client.query(sql, params);
    return result.rows;
  } finally {
    client.release();
  }
}

// ── Bootstrap table ───────────────────────────────────────────────
async function init() {
  await query(`
    CREATE TABLE IF NOT EXISTS schedules (
      id          SERIAL PRIMARY KEY,
      name        VARCHAR(128)  NOT NULL,
      agent_id    VARCHAR(64)   NOT NULL,
      cron_expr   VARCHAR(64)   NOT NULL,
      message     TEXT          NOT NULL,
      enabled     BOOLEAN       NOT NULL DEFAULT true,
      last_run    TIMESTAMPTZ,
      created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    )
  `);
  console.log("[scheduler] DB ready");
}

// ── Fire a message to an agent ────────────────────────────────────
async function fireSchedule(schedule) {
  const payload = JSON.stringify({
    from_agent: "scheduler",
    to_agent:   schedule.agent_id,
    message:    schedule.message,
  });

  await redis.publish(`agent:${schedule.agent_id}:inbox`, payload);

  await query(
    `INSERT INTO messages (from_agent, to_agent, channel, content)
     VALUES ($1, $2, $3, $4)`,
    ["scheduler", schedule.agent_id, `agent:${schedule.agent_id}:inbox`, schedule.message]
  );

  await query(
    `INSERT INTO agent_logs (agent_id, level, message) VALUES ($1, $2, $3)`,
    ["scheduler", "info", `Fired schedule "${schedule.name}" → ${schedule.agent_id}`]
  );

  await query(
    `UPDATE schedules SET last_run = NOW() WHERE id = $1`,
    [schedule.id]
  );

  console.log(`[scheduler] Fired "${schedule.name}" → ${schedule.agent_id}`);
}

// ── Schedule management ───────────────────────────────────────────
const activeTasks = new Map(); // id → cron.ScheduledTask

async function syncSchedules() {
  const rows = await query("SELECT * FROM schedules WHERE enabled = true");
  const activeIds = new Set(rows.map((r) => r.id));

  // Stop removed/disabled schedules
  for (const [id, task] of activeTasks) {
    if (!activeIds.has(id)) {
      task.stop();
      activeTasks.delete(id);
      console.log(`[scheduler] Stopped schedule #${id}`);
    }
  }

  // Start new schedules
  for (const row of rows) {
    if (activeTasks.has(row.id)) continue;
    if (!cron.validate(row.cron_expr)) {
      console.warn(`[scheduler] Invalid cron "${row.cron_expr}" for schedule #${row.id}, skipping`);
      continue;
    }

    const task = cron.schedule(row.cron_expr, () => fireSchedule(row), {
      timezone: "UTC",
    });
    activeTasks.set(row.id, task);
    console.log(`[scheduler] Started schedule #${row.id} "${row.name}" [${row.cron_expr}] → ${row.agent_id}`);
  }
}

// ── Main ──────────────────────────────────────────────────────────
async function main() {
  // Wait for Postgres
  for (let i = 0; i < 10; i++) {
    try {
      await query("SELECT 1");
      break;
    } catch (err) {
      const wait = Math.min(2 ** i, 30) * 1000;
      console.log(`[scheduler] Waiting for DB... retry in ${wait / 1000}s`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }

  await init();
  await syncSchedules();

  // Re-sync every 60s to pick up new/changed schedules
  setInterval(syncSchedules, 60_000);
  console.log("[scheduler] Running — polling for schedule changes every 60s");
}

main().catch((err) => {
  console.error("[scheduler] Fatal:", err);
  process.exit(1);
});

process.on("SIGTERM", async () => {
  for (const task of activeTasks.values()) task.stop();
  await pgPool.end();
  redis.disconnect();
  process.exit(0);
});
