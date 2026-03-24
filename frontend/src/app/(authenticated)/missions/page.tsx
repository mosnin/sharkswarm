"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { CardListSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { ErrorBlock } from "@/components/ui/error-block";
import { showSuccess, showError } from "@/lib/toast";
import { Target } from "lucide-react";

interface Mission {
  id: string;
  title: string;
  objective: string;
  mission_type: string;
  status: string;
  risk_level: string;
  quality_bar: string;
  policy: string;
  topology_id?: string;
  error?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

interface AgentSpec {
  id: string;
  name: string;
  role_type: string;
  purpose: string;
  authority: string;
  autonomy: string;
  runtime_agent_id?: string;
  status: string;
}

interface Topology {
  id: string;
  topology_type: string;
  lead_agent_id?: string;
  handoff_rules: Array<{ from: string; to: string; trigger: string }>;
  quality_gates: Array<{ type: string; position: string }>;
}

interface Provenance {
  id: number;
  event_type: string;
  agent_id?: string;
  action: string;
  created_at: string;
}

interface GateResult {
  id: number;
  gate_type: string;
  status: string;
  evaluated_by?: string;
}

interface MissionFull {
  mission: Mission;
  topology?: Topology;
  agents: AgentSpec[];
  gates: GateResult[];
  provenance: Provenance[];
}

interface PreviewResult {
  routing: {
    topology_type: string;
    recommended_roles: string[];
    agent_count: number;
    policy: string;
    reasoning: string;
  };
  topology: {
    topology_type: string;
    agents: Array<{ role_type: string; name: string; purpose: string; authority: string }>;
    handoff_rules: Array<{ from: string; to: string; trigger: string }>;
    quality_gates: Array<{ type: string; position: string }>;
  };
}

const MISSION_TYPES = [
  "exploration", "decision", "design", "build",
  "audit", "negotiation", "synthesis", "execution",
];

const RISK_LEVELS = ["low", "medium", "high", "critical"];
const QUALITY_BARS = ["minimal", "standard", "high", "maximum"];

function statusVariant(status: string): "success" | "error" | "warning" | "info" | "neutral" {
  switch (status) {
    case "active":
    case "completed":
      return "success";
    case "failed":
      return "error";
    case "compiling":
    case "paused":
      return "warning";
    case "ready":
      return "info";
    case "draft":
    case "aborted":
    default:
      return "neutral";
  }
}

const labelStyle = { fontSize: 13, color: "var(--text-muted)", display: "block", marginBottom: 4 } as const;

export default function MissionsPage() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedMission, setSelectedMission] = useState<MissionFull | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    title: "",
    objective: "",
    mission_type: "exploration",
    risk_level: "medium",
    quality_bar: "standard",
    budget_tokens: "",
  });

  const fetchMissions = useCallback(async () => {
    try {
      setError("");
      setMissions(await api<Mission[]>("/api/glorb/missions"));
    } catch (err) {
      console.error("Failed to fetch missions:", err);
      setError("Failed to load missions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMissions(); }, [fetchMissions]);

  const handleCreate = async () => {
    if (!form.title || !form.objective) return;
    setCreating(true);
    try {
      await api<Mission>("/api/glorb/missions", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          budget_tokens: form.budget_tokens ? Number(form.budget_tokens) : undefined,
        }),
      });
      setForm({ title: "", objective: "", mission_type: "exploration", risk_level: "medium", quality_bar: "standard", budget_tokens: "" });
      setShowCreate(false);
      fetchMissions();
      showSuccess("Mission created");
    } catch (err) {
      showError("Failed to create mission");
    } finally {
      setCreating(false);
    }
  };

  const handlePreview = async () => {
    if (!form.objective) return;
    try {
      const result = await api<PreviewResult>("/api/glorb/preview/route", {
        method: "POST",
        body: JSON.stringify({
          mission_type: form.mission_type,
          objective: form.objective,
          risk_level: form.risk_level,
          quality_bar: form.quality_bar,
          budget_tokens: form.budget_tokens ? Number(form.budget_tokens) : undefined,
        }),
      });
      setPreview(result);
    } catch {
      showError("Failed to generate routing preview");
    }
  };

  const loadMission = async (id: string) => {
    try {
      const full = await api<MissionFull>(`/api/glorb/missions/${id}/full`);
      setSelectedMission(full);
    } catch {
      showError("Failed to load mission details");
    }
  };

  const missionAction = async (id: string, action: string, body?: unknown) => {
    setActionLoading(action);
    try {
      await api(`/api/glorb/missions/${id}/${action}`, {
        method: "POST",
        body: body ? JSON.stringify(body) : undefined,
      });
      await loadMission(id);
      fetchMissions();
    } catch (err) {
      showError(`Mission action failed: ${err}`);
    } finally {
      setActionLoading("");
    }
  };

  return (
    <>
      <PageHeader
        title="GLORB Missions"
        description="Multi-agent mission orchestration"
        action={<button className="primary" onClick={() => { setShowCreate(!showCreate); setPreview(null); }}>{showCreate ? "Cancel" : "+ New Mission"}</button>}
      />

      {showCreate && (
        <div className="card" style={{ marginBottom: 24, padding: 20 }}>
          <h3 style={{ marginTop: 0 }}>Create Mission</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label style={labelStyle}>Title</label>
              <input className="input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Mission title" />
            </div>
            <div>
              <label style={labelStyle}>Mission Type</label>
              <select className="input" value={form.mission_type} onChange={e => setForm({ ...form, mission_type: e.target.value })}>
                {MISSION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Objective</label>
              <textarea className="input" rows={3} value={form.objective} onChange={e => setForm({ ...form, objective: e.target.value })} placeholder="What should this mission accomplish?" />
            </div>
            <div>
              <label style={labelStyle}>Risk Level</label>
              <select className="input" value={form.risk_level} onChange={e => setForm({ ...form, risk_level: e.target.value })}>
                {RISK_LEVELS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Quality Bar</label>
              <select className="input" value={form.quality_bar} onChange={e => setForm({ ...form, quality_bar: e.target.value })}>
                {QUALITY_BARS.map(q => <option key={q} value={q}>{q}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Token Budget (optional)</label>
              <input className="input" type="number" value={form.budget_tokens} onChange={e => setForm({ ...form, budget_tokens: e.target.value })} placeholder="e.g. 500000" />
            </div>
          </div>
          <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
            <button className="btn" onClick={handleCreate} disabled={creating || !form.title || !form.objective}>
              {creating ? "Creating..." : "Create Mission"}
            </button>
            <button className="btn btn-secondary" onClick={handlePreview} disabled={!form.objective}>
              Preview Routing
            </button>
          </div>

          {preview && (
            <div style={{ marginTop: 16, padding: 16, background: "var(--bg-secondary)", borderRadius: 8, fontSize: 13 }}>
              <h4 style={{ margin: "0 0 8px 0" }}>Routing Preview</h4>
              <p><strong>Topology:</strong> {preview.routing.topology_type} ({preview.routing.agent_count} agents)</p>
              <p><strong>Policy:</strong> {preview.routing.policy}</p>
              <p><strong>Reasoning:</strong> {preview.routing.reasoning}</p>
              <h4 style={{ margin: "12px 0 8px 0" }}>Planned Agents</h4>
              <table style={{ width: "100%", fontSize: 12 }}>
                <thead>
                  <tr><th style={{ textAlign: "left" }}>Name</th><th style={{ textAlign: "left" }}>Role</th><th style={{ textAlign: "left" }}>Authority</th></tr>
                </thead>
                <tbody>
                  {preview.topology.agents.map((a, i) => (
                    <tr key={i}><td>{a.name}</td><td>{a.role_type}</td><td>{a.authority}</td></tr>
                  ))}
                </tbody>
              </table>
              {preview.topology.quality_gates.length > 0 && (
                <>
                  <h4 style={{ margin: "12px 0 8px 0" }}>Quality Gates</h4>
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {preview.topology.quality_gates.map((g, i) => (
                      <li key={i}>{g.type} ({g.position})</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {selectedMission && (
        <MissionDetail
          data={selectedMission}
          onAction={missionAction}
          actionLoading={actionLoading}
          onClose={() => setSelectedMission(null)}
        />
      )}

      {loading ? (
        <CardListSkeleton count={3} />
      ) : error ? (
        <ErrorBlock message={error} onRetry={fetchMissions} />
      ) : missions.length === 0 ? (
        <EmptyState
          icon={<Target size={40} />}
          title="No missions yet"
          description="Create your first mission to start orchestrating multi-agent workflows."
          action={{ label: "Create Mission", onClick: () => setShowCreate(true) }}
        />
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {missions.map(m => (
            <div key={m.id} className="card" style={{ padding: 16, cursor: "pointer" }} onClick={() => loadMission(m.id)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong>{m.title}</strong>
                  <Badge variant={statusVariant(m.status)}>{m.status}</Badge>
                  <span style={{ marginLeft: 8, fontSize: 12, color: "var(--text-muted)" }}>{m.mission_type}</span>
                </div>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {new Date(m.created_at).toLocaleDateString()}
                </span>
              </div>
              <p style={{ margin: "8px 0 0 0", fontSize: 13, color: "var(--text-muted)" }}>
                {m.objective.length > 120 ? m.objective.slice(0, 120) + "..." : m.objective}
              </p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function MissionDetail({
  data,
  onAction,
  actionLoading,
  onClose,
}: {
  data: MissionFull;
  onAction: (id: string, action: string, body?: unknown) => void;
  actionLoading: string;
  onClose: () => void;
}) {
  const { mission, topology, agents, gates, provenance } = data;

  const actions: Array<{ label: string; action: string; body?: unknown; show: boolean }> = [
    { label: "Compile", action: "compile", show: mission.status === "draft" },
    { label: "Execute", action: "execute", show: mission.status === "ready" },
    { label: "Pause", action: "pause", show: mission.status === "active" },
    { label: "Resume", action: "resume", show: mission.status === "paused" },
    { label: "Complete", action: "complete", body: { result: {} }, show: mission.status === "active" },
    { label: "Abort", action: "abort", body: { reason: "Manual abort from dashboard" }, show: ["active", "paused", "ready"].includes(mission.status) },
  ];

  return (
    <div className="card" style={{ marginBottom: 24, padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h2 style={{ margin: 0 }}>{mission.title}</h2>
          <Badge variant={statusVariant(mission.status)}>{mission.status}</Badge>
          <span style={{ marginLeft: 8, fontSize: 12, color: "var(--text-muted)" }}>
            {mission.mission_type} | {mission.policy} | risk: {mission.risk_level} | quality: {mission.quality_bar}
          </span>
        </div>
        <button className="btn btn-secondary" onClick={onClose} style={{ fontSize: 12 }}>Close</button>
      </div>

      <p style={{ margin: "12px 0", fontSize: 14 }}>{mission.objective}</p>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {actions.filter(a => a.show).map(a => (
          <button
            key={a.action}
            className="btn"
            onClick={() => onAction(mission.id, a.action, a.body)}
            disabled={!!actionLoading}
            style={a.action === "abort" ? { background: "#ef4444" } : undefined}
          >
            {actionLoading === a.action ? "..." : a.label}
          </button>
        ))}
      </div>

      {mission.error && (
        <div style={{ padding: 12, background: "#fef2f2", borderRadius: 8, marginBottom: 16, color: "#dc2626", fontSize: 13 }}>
          {mission.error}
        </div>
      )}

      {topology && (
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, marginBottom: 8 }}>Topology: {topology.topology_type}</h3>
          {topology.handoff_rules.length > 0 && (
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Handoffs: {topology.handoff_rules.map(h => `${h.from} -> ${h.to}`).join(", ")}
            </div>
          )}
        </div>
      )}

      {agents.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, marginBottom: 8 }}>Agents ({agents.length})</h3>
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th style={{ textAlign: "left", padding: 4 }}>Name</th>
                <th style={{ textAlign: "left", padding: 4 }}>Role</th>
                <th style={{ textAlign: "left", padding: 4 }}>Authority</th>
                <th style={{ textAlign: "left", padding: 4 }}>Autonomy</th>
                <th style={{ textAlign: "left", padding: 4 }}>Status</th>
                <th style={{ textAlign: "left", padding: 4 }}>Runtime ID</th>
              </tr>
            </thead>
            <tbody>
              {agents.map(a => (
                <tr key={a.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: 4 }}>{a.name}</td>
                  <td style={{ padding: 4 }}>{a.role_type}</td>
                  <td style={{ padding: 4 }}>{a.authority}</td>
                  <td style={{ padding: 4 }}>{a.autonomy}</td>
                  <td style={{ padding: 4 }}>{a.status}</td>
                  <td style={{ padding: 4, fontFamily: "monospace", fontSize: 11 }}>{a.runtime_agent_id || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {gates.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, marginBottom: 8 }}>Quality Gates</h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {gates.map(g => (
              <div key={g.id} style={{
                padding: "4px 12px",
                borderRadius: 4,
                fontSize: 12,
                background: g.status === "passed" ? "#dcfce7" : g.status === "failed" ? "#fef2f2" : g.status === "overridden" ? "#fef3c7" : "#f3f4f6",
                color: g.status === "passed" ? "#166534" : g.status === "failed" ? "#dc2626" : g.status === "overridden" ? "#92400e" : "#374151",
              }}>
                {g.gate_type}: {g.status}
              </div>
            ))}
          </div>
        </div>
      )}

      {provenance.length > 0 && (
        <div>
          <h3 style={{ fontSize: 14, marginBottom: 8 }}>Provenance Trail ({provenance.length})</h3>
          <div style={{ maxHeight: 200, overflow: "auto", fontSize: 12 }}>
            {provenance.map(p => (
              <div key={p.id} style={{ padding: "4px 0", borderBottom: "1px solid var(--border)", display: "flex", gap: 12 }}>
                <span style={{ color: "var(--text-muted)", flexShrink: 0, width: 140 }}>
                  {new Date(p.created_at).toLocaleTimeString()}
                </span>
                <span style={{ color: "var(--text-muted)", flexShrink: 0, width: 120 }}>{p.event_type}</span>
                <span>{p.action}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
