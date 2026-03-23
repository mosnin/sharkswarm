"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import AgentList from "@/components/AgentList";

interface Agent {
  id: string;
  name: string;
  status: "online" | "offline";
  model: string;
  tools: string[];
}

const MODELS = [
  { value: "gpt-4o-mini", label: "GPT-4o Mini (fast, cheap)" },
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "gpt-4.1", label: "GPT-4.1" },
  { value: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
  { value: "o4-mini", label: "o4-mini (reasoning)" },
];

const labelStyle = { fontSize: 13, color: "var(--text-muted)", display: "block", marginBottom: 4 } as const;

export default function Home() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newAgent, setNewAgent] = useState({
    name: "",
    systemPrompt: "",
    model: "gpt-4o-mini",
  });

  const fetchAgents = useCallback(async () => {
    try {
      setAgents(await api<Agent[]>("/api/agents"));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchAgents().then(() => setLoading(false));
    const interval = setInterval(fetchAgents, 5000);
    return () => clearInterval(interval);
  }, [fetchAgents]);

  const handleCreate = async () => {
    if (!newAgent.name.trim()) return;
    setCreating(true);
    try {
      await api("/api/agents", {
        method: "POST",
        body: JSON.stringify({
          name: newAgent.name.trim(),
          systemPrompt: newAgent.systemPrompt.trim() ||
            `You are ${newAgent.name.trim()}, an AI agent in the SharkSwarm multi-agent system.`,
          model: newAgent.model,
          tools: [],
        }),
      });
      setNewAgent({ name: "", systemPrompt: "", model: "gpt-4o-mini" });
      setShowCreate(false);
      await fetchAgents();
    } catch (err) {
      console.error("Failed to create agent:", err);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (agentId: string) => {
    if (!confirm("Delete this agent? This will stop and remove its container.")) return;
    await api(`/api/agents/${agentId}`, { method: "DELETE" });
    await fetchAgents();
  };

  if (loading) return <p>Loading dashboard...</p>;

  return (
    <main>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 24 }}>Agents</h1>
        <button className="primary" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? "Cancel" : "+ New Agent"}
        </button>
      </div>

      {/* Create Agent Form */}
      {showCreate && (
        <div style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: 20,
          marginBottom: 24,
        }}>
          <h2 style={{ fontSize: 16, marginBottom: 16 }}>Create New Agent</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <label>
              <span style={labelStyle}>Name *</span>
              <input
                placeholder="e.g. Research Agent"
                value={newAgent.name}
                onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
              />
            </label>
            <label>
              <span style={labelStyle}>Model</span>
              <select
                value={newAgent.model}
                onChange={(e) => setNewAgent({ ...newAgent, model: e.target.value })}
              >
                {MODELS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </label>
            <label>
              <span style={labelStyle}>System Prompt (optional)</span>
              <textarea
                rows={3}
                placeholder={`You are ${newAgent.name || "an agent"}, an AI agent in the SharkSwarm multi-agent system.`}
                value={newAgent.systemPrompt}
                onChange={(e) => setNewAgent({ ...newAgent, systemPrompt: e.target.value })}
              />
            </label>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                className="primary"
                onClick={handleCreate}
                disabled={creating || !newAgent.name.trim()}
              >
                {creating ? "Creating..." : "Create Agent"}
              </button>
              <button onClick={() => setShowCreate(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <AgentList agents={agents} onDelete={handleDelete} />
    </main>
  );
}
