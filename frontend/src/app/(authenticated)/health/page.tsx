"use client";

import { useEffect, useState, useCallback } from "react";
import { useApi } from "@/lib/useApi";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { StatCardsSkeleton, CardListSkeleton } from "@/components/ui/skeleton";
import { ErrorBlock } from "@/components/ui/error-block";
import { showSuccess, showError } from "@/lib/toast";

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

interface HeartbeatInfo {
  lastHeartbeat?: string;
  status?: string;
  error?: string;
}

const cardStyle = {
  background: "var(--surface)",
  borderRadius: 8,
  border: "1px solid var(--border)",
  padding: 16,
} as const;

export default function HealthPage() {
  const api = useApi();
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [error, setError] = useState("");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [heartbeats, setHeartbeats] = useState<Record<string, HeartbeatInfo>>({});
  const [waking, setWaking] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      setError("");
      setHealth(await api<SystemHealth>("/api/health/system"));
      setLastRefresh(new Date());
    } catch (err) {
      setError("Failed to fetch system health");
    }
  }, []);

  const fetchHeartbeats = useCallback(async (agents: AgentHealth[]) => {
    const results: Record<string, HeartbeatInfo> = {};
    await Promise.allSettled(
      agents.filter(a => a.status === "online").map(async (agent) => {
        try {
          results[agent.id] = await api<HeartbeatInfo>(`/api/agents/${agent.id}/heartbeat`);
        } catch {
          results[agent.id] = { error: "unavailable" };
        }
      })
    );
    setHeartbeats(results);
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 10000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  useEffect(() => {
    if (health?.agents) {
      fetchHeartbeats(health.agents);
    }
  }, [health, fetchHeartbeats]);

  const triggerHeartbeat = async (agentId: string) => {
    setWaking(agentId);
    try {
      await api(`/api/agents/${agentId}/heartbeat`, {
        method: "POST",
        body: JSON.stringify({ text: "Manual heartbeat from dashboard", mode: "now" }),
      });
      await fetchHealth();
      showSuccess("Heartbeat sent");
    } catch (err) {
      showError("Failed to trigger heartbeat");
    } finally {
      setWaking(null);
    }
  };

  if (error) return <ErrorBlock message={error} onRetry={fetchHealth} />;
  if (!health) return <StatCardsSkeleton count={3} />;

  const totalTasks = Object.values(health.tasks).reduce((a, b) => a + b, 0);

  return (
    <div>
      <PageHeader
        title="System Health"
        description="Infrastructure and agent monitoring"
        action={
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {lastRefresh && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Last: {lastRefresh.toLocaleTimeString()}</span>}
            <button onClick={fetchHealth} style={{ fontSize: 13, padding: "6px 14px" }}>Refresh</button>
          </div>
        }
      />

      {/* Infrastructure */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 24 }}>
        <div style={cardStyle}>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 6 }}>PostgreSQL</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: health.infrastructure.postgres ? "var(--green)" : "var(--red)" }} />
            <span style={{ fontSize: 18, fontWeight: 600 }}>{health.infrastructure.postgres ? "Online" : "Offline"}</span>
          </div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 6 }}>Redis</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: health.infrastructure.redis ? "var(--green)" : "var(--red)" }} />
            <span style={{ fontSize: 18, fontWeight: 600 }}>{health.infrastructure.redis ? "Online" : "Offline"}</span>
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

      {/* Agents with Heartbeat */}
      <h2 style={{ fontSize: 18, marginBottom: 12 }}>Agents</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 12 }}>
        {health.agents.map((agent) => {
          const hb = heartbeats[agent.id];
          return (
            <div key={agent.id} style={cardStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={{
                  width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
                  background: agent.status === "online" ? "var(--green)" : "var(--red)",
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{agent.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{agent.id}</div>
                </div>
                <Badge variant={agent.status === "online" ? "success" : "error"}>{agent.status}</Badge>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13 }}>
                <div>
                  <span style={{ color: "var(--text-muted)" }}>Latency: </span>
                  <span style={{ color: agent.latencyMs !== null ? (agent.latencyMs < 100 ? "var(--green)" : agent.latencyMs < 500 ? "var(--yellow)" : "var(--red)") : undefined }}>
                    {agent.latencyMs !== null ? `${agent.latencyMs}ms` : "—"}
                  </span>
                </div>
                <div>
                  <span style={{ color: "var(--text-muted)" }}>Last activity: </span>
                  <span>{agent.lastActivity ? new Date(agent.lastActivity).toLocaleTimeString() : "—"}</span>
                </div>
              </div>

              {/* Heartbeat Section */}
              <div style={{
                marginTop: 10, padding: "8px 12px", borderRadius: 6,
                background: "var(--bg)", border: "1px solid var(--border)",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 12 }}>
                    <span style={{ color: "var(--text-muted)" }}>Heartbeat: </span>
                    {hb?.lastHeartbeat ? (
                      <span style={{ color: "var(--green)" }}>
                        {new Date(hb.lastHeartbeat).toLocaleTimeString()}
                      </span>
                    ) : hb?.error ? (
                      <span style={{ color: "var(--text-muted)" }}>unavailable</span>
                    ) : (
                      <span style={{ color: "var(--text-muted)" }}>—</span>
                    )}
                  </div>
                  <button
                    onClick={() => triggerHeartbeat(agent.id)}
                    disabled={agent.status === "offline" || waking === agent.id}
                    style={{ fontSize: 11, padding: "3px 10px" }}
                  >
                    {waking === agent.id ? "Waking..." : "Wake"}
                  </button>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <a href={`/agents/${agent.id}/chat`} style={{ fontSize: 12 }}>Chat</a>
                <a href={`/agents/${agent.id}`} style={{ fontSize: 12 }}>Config</a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
