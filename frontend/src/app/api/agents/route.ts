import { NextResponse } from "next/server";
import { AGENTS } from "@/lib/agents";

async function checkHealth(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

export async function GET() {
  const agents = await Promise.all(
    AGENTS.map(async (agent) => {
      const online = await checkHealth(agent.internalUrl);
      return {
        id: agent.id,
        name: agent.name,
        url: agent.publicUrl,
        status: online ? "online" : "offline",
      };
    })
  );

  return NextResponse.json({ agents });
}
