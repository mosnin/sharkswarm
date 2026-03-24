"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Bot, Plus } from "lucide-react";
import { useApi } from "@/lib/useApi";
import { showSuccess, showError } from "@/lib/toast";
import { PageHeader } from "@/components/page-header";
import { FilterBar } from "@/components/ui/filter-bar";
import { CardListSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBlock } from "@/components/ui/error-block";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface Agent {
  id: string;
  name: string;
  status: "online" | "offline";
  model?: string;
  tools?: string[];
}

const MODELS = [
  { value: "openai/gpt-4.1", label: "GPT-4.1" },
  { value: "openai/gpt-4.1-mini", label: "GPT-4.1 Mini (default)" },
  { value: "openai/gpt-4.1-nano", label: "GPT-4.1 Nano (fast, cheap)" },
  { value: "openai/o4-mini", label: "o4-mini (reasoning)" },
  { value: "openai/o3", label: "o3 (reasoning)" },
];

export default function AgentsPage() {
  const router = useRouter();
  const api = useApi();

  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newModel, setNewModel] = useState("openai/gpt-4.1-mini");
  const [newSystemPrompt, setNewSystemPrompt] = useState("");
  const [creating, setCreating] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Agent | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api<Agent[]>("/api/agents");
      setAgents(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load agents");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const filteredAgents = useMemo(() => {
    if (!search) return agents;
    const q = search.toLowerCase();
    return agents.filter((a) => a.name.toLowerCase().includes(q));
  }, [agents, search]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await api<Agent>("/api/agents", {
        method: "POST",
        body: JSON.stringify({
          name: newName.trim(),
          systemPrompt: newSystemPrompt,
          model: newModel,
          tools: [],
        }),
      });
      showSuccess(`Agent "${newName.trim()}" created`);
      setNewName("");
      setNewModel("openai/gpt-4.1-mini");
      setNewSystemPrompt("");
      setShowCreate(false);
      await fetchAgents();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to create agent");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api(`/api/agents/${deleteTarget.id}`, { method: "DELETE" });
      showSuccess(`Agent "${deleteTarget.name}" deleted`);
      setDeleteTarget(null);
      await fetchAgents();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to delete agent");
    } finally {
      setDeleting(false);
    }
  };

  const labelStyle = { fontSize: 13, color: "var(--text-muted)", display: "block", marginBottom: 4 } as const;

  return (
    <div>
      <PageHeader
        title="Agents"
        description="Manage your AI agents"
        action={
          <button className="primary" onClick={() => setShowCreate((v) => !v)}>
            <Plus size={14} style={{ marginRight: 4 }} />
            New Agent
          </button>
        }
      />

      {/* ── Create Agent Form ── */}
      {showCreate && (
        <div
          className="card"
          style={{ marginBottom: 20, display: "flex", flexDirection: "column", gap: 12 }}
        >
          <h3 style={{ fontSize: 15, fontWeight: 600 }}>Create New Agent</h3>

          <label>
            <span style={labelStyle}>Name</span>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Support Bot"
            />
          </label>

          <label>
            <span style={labelStyle}>Model</span>
            <select value={newModel} onChange={(e) => setNewModel(e.target.value)}>
              {MODELS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span style={labelStyle}>System Prompt</span>
            <textarea
              rows={4}
              value={newSystemPrompt}
              onChange={(e) => setNewSystemPrompt(e.target.value)}
              placeholder="Optional instructions for the agent..."
            />
          </label>

          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button className="primary" onClick={handleCreate} disabled={creating || !newName.trim()}>
              {creating ? "Creating..." : "Create Agent"}
            </button>
            <button onClick={() => setShowCreate(false)}>Cancel</button>
          </div>
        </div>
      )}

      <FilterBar
        searchPlaceholder="Search agents by name..."
        searchValue={search}
        onSearchChange={setSearch}
      />

      {/* ── Loading ── */}
      {loading && <CardListSkeleton count={3} />}

      {/* ── Error ── */}
      {!loading && error && (
        <ErrorBlock message={error} onRetry={fetchAgents} />
      )}

      {/* ── Empty ── */}
      {!loading && !error && filteredAgents.length === 0 && agents.length === 0 && (
        <EmptyState
          icon={<Bot size={40} />}
          title="No agents yet"
          description="Create your first agent to start building your swarm"
          action={{ label: "Create Agent", onClick: () => setShowCreate(true) }}
        />
      )}

      {/* ── No search results ── */}
      {!loading && !error && filteredAgents.length === 0 && agents.length > 0 && (
        <p style={{ color: "var(--text-muted)", fontSize: 14, textAlign: "center", padding: 32 }}>
          No agents matching &quot;{search}&quot;
        </p>
      )}

      {/* ── Agent Cards ── */}
      {!loading && !error && filteredAgents.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filteredAgents.map((agent) => (
            <div
              key={agent.id}
              className="card"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "14px 16px",
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <Badge variant={agent.status === "online" ? "success" : "neutral"}>
                    {agent.status}
                  </Badge>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{agent.name}</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{agent.id}</div>
                {agent.model && (
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                    {MODELS.find((m) => m.value === agent.model)?.label ?? agent.model}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                <button onClick={() => router.push(`/agents/${agent.id}/chat`)} style={{ fontSize: 12 }}>
                  Chat
                </button>
                <button onClick={() => router.push(`/agents/${agent.id}`)} style={{ fontSize: 12 }}>
                  Config
                </button>
                <button
                  onClick={() => setDeleteTarget(agent)}
                  style={{ fontSize: 12, color: "var(--red)", borderColor: "var(--red)" }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Delete Confirmation ── */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Agent"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        confirmVariant="danger"
        loading={deleting}
      />
    </div>
  );
}
