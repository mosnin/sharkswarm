import { NextResponse } from "next/server";

const AGENTS = [
  { id: "agent-1", name: "Agent Alpha", internalUrl: process.env.AGENT_1_URL || "http://openclaw-agent-1:18789" },
  { id: "agent-2", name: "Agent Bravo", internalUrl: process.env.AGENT_2_URL || "http://openclaw-agent-2:18789" },
];

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
        url: agent.internalUrl,
        status: online ? "online" : "offline",
      };
    })
  );

  return NextResponse.json({ agents });
}
