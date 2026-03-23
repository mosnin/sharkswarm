import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(req: NextRequest) {
  const limit = Number(req.nextUrl.searchParams.get("limit")) || 50;
  const type = req.nextUrl.searchParams.get("type") || "messages";

  if (type === "agent_logs") {
    const rows = await query(
      "SELECT id, agent_id, level, message, created_at FROM agent_logs ORDER BY created_at DESC LIMIT $1",
      [limit]
    );
    return NextResponse.json(rows);
  }

  // Default: messages
  const rows = await query(
    "SELECT id, from_agent, to_agent, content, created_at FROM messages ORDER BY created_at DESC LIMIT $1",
    [limit]
  );

  // Support both old format ({ logs }) and new (direct array)
  if (req.nextUrl.searchParams.get("type")) {
    return NextResponse.json(rows);
  }
  return NextResponse.json({ logs: rows });
}
