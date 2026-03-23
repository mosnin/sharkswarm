import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function GET(req: NextRequest) {
  const limit = Number(req.nextUrl.searchParams.get("limit")) || 50;

  const result = await pool.query(
    "SELECT id, from_agent, to_agent, content, created_at FROM messages ORDER BY created_at DESC LIMIT $1",
    [limit]
  );

  return NextResponse.json({ logs: result.rows });
}
