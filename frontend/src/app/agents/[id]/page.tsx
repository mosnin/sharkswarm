"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";

interface AgentConfig {
  id: string;
  name: string;
  internalUrl: string;
  publicUrl: string;
  systemPrompt: string;
  model: string;
  tools: string[];
}

interface ToolIntegration {
  id: string;
  name: string;
  description: string;
  type: "api" | "mcp";
}

export default function AgentConfigPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params.id as string;

  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Integration bindings
  const [allIntegrations, setAllIntegrations] = useState<ToolIntegration[]>([]);
  const [boundIntegrations, setBoundIntegrations] = useState<ToolIntegration[]>([]);

  const fetchIntegrations = useCallback(async () => {
    try {
      const [all, bound] = await Promise.all([
        api<ToolIntegration[]>("/api/integrations"),
        api<ToolIntegration[]>(`/api/agents/${agentId}/integrations`),
      ]);
      setAllIntegrations(all);
      setBoundIntegrations(bound);
    } catch {
      // ignore
    }
  }, [agentId]);

  useEffect(() => {
    api<AgentConfig>(`/api/agents/${agentId}`)
      .then(setConfig)
      .catch(() => setError("Agent not found"));
    fetchIntegrations();
  }, [agentId, fetchIntegrations]);

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const updated = await api<AgentConfig>(`/api/agents/${agentId}`, {
        method: "PUT",
        body: JSON.stringify({
          name: config.name,
          systemPrompt: config.systemPrompt,
          model: config.model,
          tools: config.tools,
        }),
      });
      setConfig(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Failed to save config");
    } finally {
      setSaving(false);
    }
  };

  const handleBind = async (integrationId: string) => {
    await api(`/api/agents/${agentId}/integrations`, {
      method: "POST",
      body: JSON.stringify({ integrationId }),
    });
    await fetchIntegrations();
  };

  const handleUnbind = async (integrationId: string) => {
    await api(`/api/agents/${agentId}/integrations/${integrationId}`, {
      method: "DELETE",
    });
    await fetchIntegrations();
  };

  const boundIds = new Set(boundIntegrations.map((i) => i.id));
  const availableIntegrations = allIntegrations.filter((i) => !boundIds.has(i.id));

  const labelStyle = { fontSize: 13, color: "var(--text-muted)", display: "block", marginBottom: 4 } as const;
  const cardStyle = {
    background: "var(--surface)",
    borderRadius: 8,
    border: "1px solid var(--border)",
    padding: 16,
  } as const;

  if (error && !config) {
    return (
      <div>
        <p style={{ color: "var(--red)" }}>{error}</p>
        <button onClick={() => router.push("/")} style={{ marginTop: 12 }}>Back</button>
      </div>
    );
  }

  if (!config) {
    return <p>Loading agent config...</p>;
  }

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button onClick={() => router.push("/")}>← Back</button>
        <h1 style={{ fontSize: 24 }}>Configure {config.name}</h1>
      </div>

      {/* ── Basic Config ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <label>
          <span style={labelStyle}>Name</span>
          <input
            value={config.name}
            onChange={(e) => setConfig({ ...config, name: e.target.value })}
          />
        </label>

        <label>
          <span style={labelStyle}>Model</span>
          <select
            value={config.model}
            onChange={(e) => setConfig({ ...config, model: e.target.value })}
          >
            <option value="openai/gpt-4o-mini">GPT-4o Mini (fast, cheap)</option>
            <option value="openai/gpt-4o">GPT-4o</option>
            <option value="openai/gpt-4.1">GPT-4.1</option>
            <option value="openai/gpt-4.1-mini">GPT-4.1 Mini</option>
          </select>
        </label>

        <label>
          <span style={labelStyle}>System Prompt</span>
          <textarea
            rows={6}
            value={config.systemPrompt}
            onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
          />
        </label>

        <label>
          <span style={labelStyle}>Built-in Tools (comma-separated)</span>
          <input
            value={config.tools.join(", ")}
            onChange={(e) =>
              setConfig({
                ...config,
                tools: e.target.value.split(",").map((t) => t.trim()).filter(Boolean),
              })
            }
          />
        </label>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
          <button className="primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Config"}
          </button>
          {saved && <span style={{ color: "var(--green)", fontSize: 13 }}>Saved!</span>}
          {error && <span style={{ color: "var(--red)", fontSize: 13 }}>{error}</span>}
        </div>
      </div>

      {/* ── Attached Integrations ── */}
      <div style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>Attached Integrations</h2>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
          API tools and MCP servers this agent can use.{" "}
          <a href="/integrations">Manage all integrations →</a>
        </p>

        {boundIntegrations.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            No integrations attached yet.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {boundIntegrations.map((t) => (
              <div key={t.id} style={{ ...cardStyle, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        fontSize: 10,
                        padding: "1px 5px",
                        borderRadius: 3,
                        background: t.type === "mcp" ? "var(--accent)" : "var(--green)",
                        color: "#fff",
                        textTransform: "uppercase",
                        fontWeight: 600,
                      }}
                    >
                      {t.type}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 500 }}>{t.name}</span>
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{t.description}</p>
                </div>
                <button
                  onClick={() => handleUnbind(t.id)}
                  style={{ fontSize: 12, padding: "4px 10px", color: "var(--red)", borderColor: "var(--red)", flexShrink: 0 }}
                >
                  Detach
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── Add integration dropdown ── */}
        {availableIntegrations.length > 0 && (
          <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
            <select
              id="add-integration"
              defaultValue=""
              style={{ flex: 1 }}
              onChange={async (e) => {
                if (e.target.value) {
                  await handleBind(e.target.value);
                  e.target.value = "";
                }
              }}
            >
              <option value="" disabled>
                + Attach an integration...
              </option>
              {availableIntegrations.map((t) => (
                <option key={t.id} value={t.id}>
                  [{t.type.toUpperCase()}] {t.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
