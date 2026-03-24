"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { StatCardsSkeleton, CardListSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBlock } from "@/components/ui/error-block";
import { Badge } from "@/components/ui/badge";
import { Bot, MessageSquare } from "lucide-react";

interface Agent {
  id: string;
  name: string;
  status: "online" | "offline";
  model: string;
  tools: string[];
}

interface SystemHealth {
  agents: Array<{ id: string; name: string; status: string }>;
  infrastructure: { postgres: string; redis: string };
  tasks: { pending: number; completed: number; failed: number; in_progress: number };
}

interface Task {
  id: string;
  from_agent: string;
  to_agent: string;
  message: string;
  status: string;
  result: string | null;
  created_at: string;
  updated_at: string;
}

interface Mission {
  id: string;
  title: string;
  objective: string;
  status: string;
  mission_type: string;
  created_at: string;
}

type DashboardState = "loading" | "empty" | "success" | "error";

export default function DashboardPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [state, setState] = useState<DashboardState>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const [agentsData, healthData, tasksData, missionsData] = await Promise.all([
        api<Agent[]>("/api/agents"),
        api<SystemHealth>("/api/health/system"),
        api<Task[]>("/api/tasks"),
        api<Mission[]>("/api/glorb/missions").catch(() => [] as Mission[]),
      ]);

      setAgents(agentsData);
      setHealth(healthData);
      setTasks(tasksData);
      setMissions(missionsData);

      if (agentsData.length === 0 && tasksData.length === 0) {
        setState("empty");
      } else {
        setState("success");
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to load dashboard data");
      setState("error");
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const onlineCount = agents.filter((a) => a.status === "online").length;
  const activeMissions = missions.filter((m) => m.status !== "completed").length;
  const pendingTasks = health ? health.tasks.pending + health.tasks.in_progress : 0;
  const infraHealthy =
    health?.infrastructure.postgres === "connected" && health?.infrastructure.redis === "connected";

  const recentTasks = [...tasks]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  const taskBadgeVariant = (status: string) => {
    switch (status) {
      case "completed":
        return "success" as const;
      case "failed":
        return "error" as const;
      case "in_progress":
        return "warning" as const;
      case "pending":
        return "info" as const;
      default:
        return "neutral" as const;
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHrs = Math.floor(diffMin / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    return d.toLocaleDateString();
  };

  if (state === "loading") {
    return (
      <main>
        <PageHeader title="Dashboard" description="System overview and quick actions" />
        <StatCardsSkeleton count={4} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginTop: 24 }}>
          <CardListSkeleton count={3} />
          <CardListSkeleton count={5} />
        </div>
      </main>
    );
  }

  if (state === "error") {
    return (
      <main>
        <PageHeader title="Dashboard" description="System overview and quick actions" />
        <ErrorBlock message={errorMessage} onRetry={fetchData} />
      </main>
    );
  }

  if (state === "empty") {
    return (
      <main>
        <PageHeader title="Dashboard" description="System overview and quick actions" />
        <EmptyState
          icon={<Bot size={40} />}
          title="No agents yet"
          description="Create your first agent to get started with SharkSwarm."
          action={{
            label: "Create Agent",
            onClick: () => {
              window.location.href = "/agents";
            },
          }}
        />
      </main>
    );
  }

  return (
    <main>
      <PageHeader title="Dashboard" description="System overview and quick actions" />

      {/* Stat Cards */}
      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-card-label">Total Agents</span>
          <span className="stat-card-value">{agents.length}</span>
          <span className="stat-card-trend">{onlineCount} online</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">Active Missions</span>
          <span className="stat-card-value">{activeMissions}</span>
          <span className="stat-card-trend">{missions.length} total</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">Pending Tasks</span>
          <span className="stat-card-value">{pendingTasks}</span>
          <span className="stat-card-trend">
            {health ? health.tasks.completed : 0} completed
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">System Health</span>
          <span className="stat-card-value">{infraHealthy ? "Healthy" : "Degraded"}</span>
          <span className="stat-card-trend">
            {infraHealthy ? "All systems operational" : "Check infrastructure"}
          </span>
        </div>
      </div>

      {/* Two-column layout */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 24,
          marginTop: 24,
        }}
        className="dashboard-columns"
      >
        {/* Left: Agent Status Grid */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Agent Status</h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {agents.map((agent) => (
              <div
                key={agent.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 0",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Bot size={18} style={{ color: "var(--text-muted)" }} />
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>{agent.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{agent.model}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Badge variant={agent.status === "online" ? "success" : "error"}>
                    {agent.status}
                  </Badge>
                  <Link
                    href={`/agents/${agent.id}/chat`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 13,
                      color: "var(--accent)",
                      textDecoration: "none",
                    }}
                  >
                    <MessageSquare size={14} />
                    Chat
                  </Link>
                </div>
              </div>
            ))}
            {agents.length === 0 && (
              <p style={{ color: "var(--text-muted)", fontSize: 14, padding: "12px 0" }}>
                No agents configured.
              </p>
            )}
          </div>
        </div>

        {/* Right: Recent Activity */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Recent Activity</h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {recentTasks.length > 0 ? (
              recentTasks.map((task) => (
                <div
                  key={task.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    padding: "12px 0",
                    borderBottom: "1px solid var(--border)",
                    gap: 12,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
                      {task.from_agent} → {task.to_agent}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--text-muted)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {task.message}
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-end",
                      gap: 4,
                      flexShrink: 0,
                    }}
                  >
                    <Badge variant={taskBadgeVariant(task.status)}>{task.status}</Badge>
                    <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                      {formatTime(task.created_at)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p style={{ color: "var(--text-muted)", fontSize: 14, padding: "12px 0" }}>
                No recent activity.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Responsive style for mobile stacking */}
      <style jsx>{`
        @media (max-width: 768px) {
          .dashboard-columns {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
  );
}
