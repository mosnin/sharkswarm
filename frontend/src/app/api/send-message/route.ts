import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { publishToAgent } from "@/lib/redis";

export async function POST(req: NextRequest) {
  const { toAgent, message } = await req.json();

  if (!toAgent || !message) {
    return NextResponse.json({ error: "toAgent and message are required" }, { status: 400 });
  }

  const fromAgent = "dashboard";
  const channel = `agent:${toAgent}:inbox`;

  // Publish to Redis
  await publishToAgent(fromAgent, toAgent, message);

  // Log to Postgres
  await query(
    "INSERT INTO messages (from_agent, to_agent, channel, content) VALUES ($1, $2, $3, $4)",
    [fromAgent, toAgent, channel, message]
  );

  return NextResponse.json({ ok: true });
}
