"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

interface Schedule {
  id: number;
  name: string;
  agent_id: string;
  cron_expr: string;
  message: string;
  enabled: boolean;
  last_run: string | null;
  created_at: string;
}

interface Agent {
  id: string;
  name: string;
}

const PRESETS = [
  { label: "Every minute",    value: "* * * * *" },
  { label: "Every 5 minutes", value: "*/5 * * * *" },
  { label: "Every hour",      value: "0 * * * *" },
  { label: "Every day 9am",   value: "0 9 * * *" },
  { label: "Every day midnight", value: "0 0 * * *" },
  { label: "Every Monday 9am",value: "0 9 * * 1" },
  { label: "Custom",          value: "" },
];

const cardStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: 16,
} as const;

const labelStyle = { fontSize: 13, color: "var(--text-muted)", display: "block", marginBottom: 4 } as const;

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preset, setPreset] = useState("0 9 * * *");
  const [form, setForm] = useState({
    name: "",
    agent_id: "",
    cron_expr: "0 9 * * *",
    message: "",
  });

  const fetchSchedules = useCallback(async () => {
    try {
      setSchedules(await api<Schedule[]>("/api/schedules"));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    api<Agent[]>("/api/agents").then(setAgents).catch(() => {});
    fetchSchedules();
    const interval = setInterval(fetchSchedules, 10000);
    return () => clearInterval(interval);
  }, [fetchSchedules]);

  const handlePreset = (value: string) => {
    setPreset(value);
    if (value) setForm((f) => ({ ...f, cron_expr: value }));
  };

  const handleCreate = async () => {
    if (!form.name || !form.agent_id || !form.cron_expr || !form.message) return;
    setSaving(true);
    try {
      await api("/api/schedules", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setForm({ name: "", agent_id: "", cron_expr: "0 9 * * *", message: "" });
      setPreset("0 9 * * *");
      setShowCreate(false);
      await fetchSchedules();
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (schedule: Schedule) => {
    await api(`/api/schedules/${schedule.id}`, {
      method: "PUT",
      body: JSON.stringify({ enabled: !schedule.enabled }),
    });
    await fetchSchedules();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this schedule?")) return;
    await api(`/api/schedules/${id}`, { method: "DELETE" });
    await fetchSchedules();
  };

  const handleRun = async (id: number) => {
    await api(`/api/schedules/${id}/run`, { method: "POST" });
    await fetchSchedules();
  };

  const agentName = (id: string) => agents.find((a) => a.id === id)?.name || id;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 24 }}>Schedules</h1>
        <button className="primary" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? "Cancel" : "+ New Schedule"}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div style={{ ...cardStyle, marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, marginBottom: 16 }}>New Schedule</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label>
                <span style={labelStyle}>Schedule Name *</span>
                <input
                  placeholder="e.g. Daily summary"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>
              <label>
                <span style={labelStyle}>Agent *</span>
                <select
                  value={form.agent_id}
                  onChange={(e) => setForm({ ...form, agent_id: e.target.value })}
                >
                  <option value="">Select agent...</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </label>
            </div>

            <div>
              <span style={labelStyle}>Frequency</span>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                {PRESETS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => handlePreset(p.value)}
                    style={{
                      fontSize: 12,
                      padding: "4px 12px",
                      background: preset === p.value ? "var(--accent)" : "var(--surface)",
                      color: preset === p.value ? "#fff" : "var(--text)",
                      borderColor: preset === p.value ? "var(--accent)" : "var(--border)",
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <input
                placeholder="Cron expression, e.g. 0 9 * * *"
                value={form.cron_expr}
                onChange={(e) => {
                  setPreset("");
                  setForm({ ...form, cron_expr: e.target.value });
                }}
                style={{ fontFamily: "monospace" }}
              />
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                Format: minute hour day month weekday (UTC) · e.g. <code>0 9 * * 1-5</code> = weekdays at 9am
              </div>
            </div>

            <label>
              <span style={labelStyle}>Message to send *</span>
              <textarea
                rows={3}
                placeholder="What should the agent do when this fires?"
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
              />
            </label>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                className="primary"
                onClick={handleCreate}
                disabled={saving || !form.name || !form.agent_id || !form.cron_expr || !form.message}
              >
                {saving ? "Creating..." : "Create Schedule"}
              </button>
              <button onClick={() => setShowCreate(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule list */}
      {schedules.length === 0 && !showCreate && (
        <p style={{ color: "var(--text-muted)" }}>No schedules yet. Create one to automate agent tasks.</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {schedules.map((s) => (
          <div key={s.id} style={{ ...cardStyle, opacity: s.enabled ? 1 : 0.6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <span
                    style={{
                      width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                      background: s.enabled ? "var(--green)" : "var(--text-muted)",
                    }}
                  />
                  <strong style={{ fontSize: 15 }}>{s.name}</strong>
                  <span style={{
                    fontSize: 11, padding: "2px 8px", borderRadius: 10,
                    background: "var(--bg)", border: "1px solid var(--border)",
                    fontFamily: "monospace",
                  }}>
                    {s.cron_expr}
                  </span>
                </div>

                <div style={{ fontSize: 13, marginBottom: 4 }}>
                  <span style={{ color: "var(--text-muted)" }}>Agent: </span>
                  <a href={`/agents/${s.agent_id}/chat`}>{agentName(s.agent_id)}</a>
                </div>

                <div style={{
                  fontSize: 13, padding: "6px 10px", background: "var(--bg)",
                  borderRadius: 4, fontFamily: "monospace", whiteSpace: "pre-wrap", marginBottom: 6,
                }}>
                  {s.message}
                </div>

                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  Last run: {s.last_run ? new Date(s.last_run).toLocaleString() : "Never"}
                  {" · "}Created {new Date(s.created_at).toLocaleDateString()}
                </div>
              </div>

              <div style={{ display: "flex", gap: 6, flexShrink: 0, marginLeft: 12 }}>
                <button
                  onClick={() => handleRun(s.id)}
                  style={{ fontSize: 12, padding: "4px 10px" }}
                  title="Run now"
                >
                  ▶ Run
                </button>
                <button
                  onClick={() => handleToggle(s)}
                  style={{
                    fontSize: 12, padding: "4px 10px",
                    color: s.enabled ? "var(--yellow)" : "var(--green)",
                    borderColor: s.enabled ? "var(--yellow)" : "var(--green)",
                  }}
                >
                  {s.enabled ? "Pause" : "Enable"}
                </button>
                <button
                  onClick={() => handleDelete(s.id)}
                  style={{ fontSize: 12, padding: "4px 10px", color: "var(--red)", borderColor: "var(--red)" }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
