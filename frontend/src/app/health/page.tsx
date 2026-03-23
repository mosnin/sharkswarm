"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

interface AgentHealth {
  id: string;
  name: string;
  status: "online" | "offline";
  latencyMs: number | null;
  lastActivity: string | null;
}

interface SystemHealth {
  agents: AgentHealth[];
  infrastructure: { postgres: boolean; redis: boolean };
  tasks: Record<string, number>;
}

export default function HealthPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      setHealth(await api<SystemHealth>("/api/health/system"));
      setLastRefresh(new Date());
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 10000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const cardStyle = {
    background: "var(--surface)",
    borderRadius: 8,
    border: "1px solid var(--border)",
    padding: 16,
  } as const;

  if (!health) return <p>Loading system health...</p>;

  const totalTasks = Object.values(health.tasks).reduce((a, b) => a + b, 0);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 24 }}>System Health</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {lastRefresh && (
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Last refresh: {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <button onClick={fetchHealth} style={{ fontSize: 13, padding: "6px 14px" }}>
            Refresh
          </button>
        </div>
      </div>

      {/* Infrastructure */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 24 }}>
        <div style={cardStyle}>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 6 }}>PostgreSQL</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: health.infrastructure.postgres ? "var(--green)" : "var(--red)",
              }}
            />
            <span style={{ fontSize: 18, fontWeight: 600 }}>
              {health.infrastructure.postgres ? "Online" : "Offline"}
            </span>
          </div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 6 }}>Redis</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: health.infrastructure.redis ? "var(--green)" : "var(--red)",
              }}
            />
            <span style={{ fontSize: 18, fontWeight: 600 }}>
              {health.infrastructure.redis ? "Online" : "Offline"}
            </span>
          </div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 6 }}>Total Tasks</div>
          <span style={{ fontSize: 18, fontWeight: 600 }}>{totalTasks}</span>
          {Object.keys(health.tasks).length > 0 && (
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
              {Object.entries(health.tasks).map(([s, c]) => `${c} ${s}`).join(" · ")}
            </div>
          )}
        </div>
      </div>

      {/* Agents */}
      <h2 style={{ fontSize: 18, marginBottom: 12 }}>Agents</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 }}>
        {health.agents.map((agent) => (
          <div key={agent.id} style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: agent.status === "online" ? "var(--green)" : "var(--red)",
                  flexShrink: 0,
                }}
              />
              <div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{agent.name}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{agent.id}</div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13 }}>
              <div>
                <span style={{ color: "var(--text-muted)" }}>Status: </span>
                <span style={{ color: agent.status === "online" ? "var(--green)" : "var(--red)" }}>
                  {agent.status}
                </span>
              </div>
              <div>
                <span style={{ color: "var(--text-muted)" }}>Latency: </span>
                <span>
                  {agent.latencyMs !== null ? `${agent.latencyMs}ms` : "—"}
                </span>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <span style={{ color: "var(--text-muted)" }}>Last activity: </span>
                <span>
                  {agent.lastActivity
                    ? new Date(agent.lastActivity).toLocaleString()
                    : "No activity"}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <a href={`/agents/${agent.id}/chat`} style={{ fontSize: 12 }}>Chat</a>
              <a href={`/agents/${agent.id}`} style={{ fontSize: 12 }}>Config</a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
