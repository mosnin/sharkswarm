import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import Redis from "ioredis";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const redis = new Redis(process.env.REDIS_URL || "redis://redis:6379");

export async function POST(req: NextRequest) {
  const { toAgent, message } = await req.json();

  if (!toAgent || !message) {
    return NextResponse.json({ error: "toAgent and message are required" }, { status: 400 });
  }

  const fromAgent = "dashboard";
  const channel = `agent:${toAgent}:inbox`;

  // Publish to Redis
  const payload = JSON.stringify({
    from: fromAgent,
    to: toAgent,
    content: message,
    timestamp: new Date().toISOString(),
  });
  await redis.publish(channel, payload);

  // Log to Postgres
  await pool.query(
    "INSERT INTO messages (from_agent, to_agent, channel, content) VALUES ($1, $2, $3, $4)",
    [fromAgent, toAgent, channel, message]
  );

  return NextResponse.json({ ok: true });
}
