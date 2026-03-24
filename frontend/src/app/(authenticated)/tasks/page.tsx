"use client";

import { useEffect, useState, useCallback } from "react";
import { useApi } from "@/lib/useApi";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBlock } from "@/components/ui/error-block";
import { CardListSkeleton } from "@/components/ui/skeleton";
import { showSuccess, showError } from "@/lib/toast";
import { CheckSquare } from "lucide-react";

interface Task {
  id: number;
  from_agent: string;
  to_agent: string;
  message: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  result: string | null;
  created_at: string;
  updated_at: string;
}

interface AgentInfo {
  id: string;
  name: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "var(--yellow)",
  in_progress: "var(--accent)",
  completed: "var(--green)",
  failed: "var(--red)",
};

export default function TasksPage() {
  const api = useApi();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterAgent, setFilterAgent] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newTask, setNewTask] = useState({ from_agent: "", to_agent: "", message: "" });

  const fetchTasks = useCallback(async () => {
    setError("");
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set("status", filterStatus);
      if (filterAgent) params.set("agent", filterAgent);
      const qs = params.toString();
      setTasks(await api<Task[]>(`/api/tasks${qs ? `?${qs}` : ""}`));
    } catch (err) {
      console.error("Failed to fetch tasks:", err);
      setError("Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterAgent]);

  const fetchAgents = useCallback(async () => {
    try {
      setAgents(await api<AgentInfo[]>("/api/agents"));
    } catch (err) {
      console.error("Failed to fetch agents:", err);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 5000);
    return () => clearInterval(interval);
  }, [fetchTasks]);

  const handleCreate = async () => {
    if (!newTask.from_agent || !newTask.to_agent || !newTask.message) return;
    try {
      await api("/api/tasks", {
        method: "POST",
        body: JSON.stringify(newTask),
      });
      setNewTask({ from_agent: "", to_agent: "", message: "" });
      setShowCreate(false);
      await fetchTasks();
      showSuccess("Task created");
    } catch (err) {
      console.error("Failed to create task:", err);
      showError("Failed to create task");
    }
  };

  const handleStatusChange = async (taskId: number, status: string) => {
    try {
      await api(`/api/tasks/${taskId}`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
      await fetchTasks();
      showSuccess("Task status updated");
    } catch (err) {
      console.error("Failed to update task status:", err);
      showError("Failed to update task status");
    }
  };

  const cardStyle = {
    background: "var(--surface)",
    borderRadius: 8,
    border: "1px solid var(--border)",
    padding: 16,
  } as const;

  const labelStyle = { fontSize: 13, color: "var(--text-muted)", display: "block", marginBottom: 4 } as const;

  // Summary counts
  const counts = {
    pending: tasks.filter((t) => t.status === "pending").length,
    in_progress: tasks.filter((t) => t.status === "in_progress").length,
    completed: tasks.filter((t) => t.status === "completed").length,
    failed: tasks.filter((t) => t.status === "failed").length,
  };

  return (
    <div>
      <PageHeader
        title="Task Queue"
        description={`${tasks.length} tasks`}
        action={<button className="primary" onClick={() => setShowCreate(!showCreate)}>{showCreate ? "Cancel" : "+ Create Task"}</button>}
      />

      {/* Summary pills */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        {(["pending", "in_progress", "completed", "failed"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(filterStatus === s ? "" : s)}
            style={{
              padding: "6px 14px",
              borderRadius: 20,
              fontSize: 13,
              background: filterStatus === s ? STATUS_COLORS[s] : "var(--surface)",
              color: filterStatus === s ? "#fff" : "var(--text)",
              borderColor: STATUS_COLORS[s],
            }}
          >
            {s.replace("_", " ")} ({counts[s]})
          </button>
        ))}
        {agents.length > 0 && (
          <select
            value={filterAgent}
            onChange={(e) => setFilterAgent(e.target.value)}
            style={{ padding: "6px 12px", fontSize: 13, width: "auto" }}
          >
            <option value="">All agents</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Create form */}
      {showCreate && (
        <div style={{ ...cardStyle, marginBottom: 20 }}>
          <h3 style={{ fontSize: 15, marginBottom: 12 }}>New Task</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <label>
              <span style={labelStyle}>From Agent</span>
              <select value={newTask.from_agent} onChange={(e) => setNewTask({ ...newTask, from_agent: e.target.value })}>
                <option value="">Select...</option>
                <option value="dashboard">Dashboard</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </label>
            <label>
              <span style={labelStyle}>To Agent</span>
              <select value={newTask.to_agent} onChange={(e) => setNewTask({ ...newTask, to_agent: e.target.value })}>
                <option value="">Select...</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            <span style={labelStyle}>Task Message</span>
            <textarea
              rows={3}
              value={newTask.message}
              placeholder="Describe what this agent should do..."
              onChange={(e) => setNewTask({ ...newTask, message: e.target.value })}
            />
          </label>
          <button
            className="primary"
            style={{ marginTop: 12 }}
            onClick={handleCreate}
            disabled={!newTask.from_agent || !newTask.to_agent || !newTask.message}
          >
            Create Task
          </button>
        </div>
      )}

      {/* Task list */}
      {loading ? <CardListSkeleton count={3} /> : error ? <ErrorBlock message={error} onRetry={fetchTasks} /> : (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {tasks.length === 0 && (
          <EmptyState
            icon={<CheckSquare size={40} />}
            title="No tasks found"
            description="Create a task to coordinate work between agents."
            action={{ label: "Create Task", onClick: () => setShowCreate(true) }}
          />
        )}
        {tasks.map((task) => (
          <div key={task.id} style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Badge variant={task.status === "completed" ? "success" : task.status === "failed" ? "error" : task.status === "in_progress" ? "info" : "warning"}>
                  {task.status.replace("_", " ")}
                </Badge>
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  #{task.id}
                </span>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {task.status === "pending" && (
                  <button onClick={() => handleStatusChange(task.id, "in_progress")} style={{ fontSize: 11, padding: "3px 8px" }}>
                    Start
                  </button>
                )}
                {task.status === "in_progress" && (
                  <>
                    <button
                      onClick={() => handleStatusChange(task.id, "completed")}
                      style={{ fontSize: 11, padding: "3px 8px", color: "var(--green)", borderColor: "var(--green)" }}
                    >
                      Complete
                    </button>
                    <button
                      onClick={() => handleStatusChange(task.id, "failed")}
                      style={{ fontSize: 11, padding: "3px 8px", color: "var(--red)", borderColor: "var(--red)" }}
                    >
                      Fail
                    </button>
                  </>
                )}
              </div>
            </div>

            <div style={{ fontSize: 13, marginBottom: 6 }}>
              <span style={{ color: "var(--accent)" }}>{task.from_agent}</span>
              <span style={{ color: "var(--text-muted)" }}> → </span>
              <span style={{ color: "var(--green)" }}>{task.to_agent}</span>
            </div>

            <div style={{ fontSize: 13, fontFamily: "monospace", padding: "8px 10px", background: "var(--bg)", borderRadius: 4, whiteSpace: "pre-wrap" }}>
              {task.message}
            </div>

            {task.result && (
              <div style={{ marginTop: 8, fontSize: 13, padding: "8px 10px", background: "var(--bg)", borderRadius: 4, border: "1px solid var(--green)", whiteSpace: "pre-wrap" }}>
                <span style={{ fontSize: 11, color: "var(--green)", fontWeight: 600 }}>Result: </span>
                {task.result}
              </div>
            )}

            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
              Created {new Date(task.created_at).toLocaleString()}
              {task.updated_at !== task.created_at && (
                <> · Updated {new Date(task.updated_at).toLocaleString()}</>
              )}
            </div>
          </div>
        ))}
      </div>
      )}
    </div>
  );
}
