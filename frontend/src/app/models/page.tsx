"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Agent {
  id: string;
  name: string;
  status: string;
  model: string; // "provider/model-id"
}

interface ModelEntry {
  id: string;
  name: string;
  reasoning: boolean;
  contextWindow: number;
  maxTokens: number;
}

interface ProviderConfig {
  baseUrl: string;
  apiKey: string;
  models: ModelEntry[];
}

interface AgentConfig {
  models: {
    providers: Record<string, ProviderConfig>;
  };
  [key: string]: unknown;
}

interface CatalogProvider {
  provider: string;
  models: ModelEntry[];
}

/* ------------------------------------------------------------------ */
/*  Quick-switch presets                                                */
/* ------------------------------------------------------------------ */

const QUICK_MODELS: { provider: string; id: string; label: string }[] = [
  { provider: "openai", id: "gpt-4.1", label: "GPT-4.1" },
  { provider: "openai", id: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
  { provider: "openai", id: "gpt-4.1-nano", label: "GPT-4.1 Nano" },
  { provider: "openai", id: "o4-mini", label: "o4-mini" },
  { provider: "openai", id: "o3", label: "o3" },
  { provider: "anthropic", id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  { provider: "anthropic", id: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
  { provider: "google", id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { provider: "google", id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
];

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const cardStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: 16,
} as const;

const labelStyle = {
  fontSize: 13,
  color: "var(--text-muted)",
  display: "block",
  marginBottom: 4,
} as const;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ModelsPage() {
  /* ---- state ---- */
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [catalog, setCatalog] = useState<CatalogProvider[]>([]);
  const [switching, setSwitching] = useState(false);
  const [expandedProviders, setExpandedProviders] = useState<Record<string, boolean>>({});
  const [showAddProvider, setShowAddProvider] = useState(false);
  const [newProvider, setNewProvider] = useState({ name: "", baseUrl: "", apiKey: "" });
  const [savingProvider, setSavingProvider] = useState<string | null>(null);

  /* ---- derived ---- */
  const selectedAgent = agents.find((a) => a.id === selectedAgentId) ?? null;
  const activeProvider = selectedAgent?.model?.split("/")[0] ?? "";
  const activeModelId = selectedAgent?.model?.split("/").slice(1).join("/") ?? "";
  const providers = config?.models?.providers ?? {};

  /* ---- helpers to find model metadata ---- */
  const findModelMeta = (provider: string, modelId: string): ModelEntry | undefined => {
    const pConfig = providers[provider];
    if (pConfig) {
      const found = pConfig.models.find((m) => m.id === modelId);
      if (found) return found;
    }
    for (const cp of catalog) {
      if (cp.provider === provider) {
        const found = cp.models.find((m) => m.id === modelId);
        if (found) return found;
      }
    }
    return undefined;
  };

  const currentMeta = findModelMeta(activeProvider, activeModelId);

  /* ---- data fetching ---- */
  const fetchAgents = useCallback(async () => {
    try {
      const data = await api<Agent[]>("/api/agents");
      setAgents(data);
      if (data.length > 0 && !selectedAgentId) {
        setSelectedAgentId(data[0].id);
      }
    } catch {
      // ignore
    }
  }, [selectedAgentId]);

  const fetchAgentData = useCallback(async (agentId: string) => {
    try {
      const [cfgData, catalogData] = await Promise.all([
        api<AgentConfig>(`/api/agents/${agentId}/config`),
        api<CatalogProvider[]>(`/api/agents/${agentId}/models`),
      ]);
      setConfig(cfgData);
      setCatalog(catalogData);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  useEffect(() => {
    if (selectedAgentId) {
      fetchAgentData(selectedAgentId);
    }
  }, [selectedAgentId, fetchAgentData]);

  /* ---- actions ---- */
  const switchModel = async (provider: string, modelId: string) => {
    if (!selectedAgentId) return;
    const newModel = `${provider}/${modelId}`;
    if (selectedAgent?.model === newModel) return;
    setSwitching(true);
    try {
      await api(`/api/agents/${selectedAgentId}`, {
        method: "PUT",
        body: JSON.stringify({ model: newModel }),
      });
      await fetchAgents();
    } catch {
      // ignore
    } finally {
      setSwitching(false);
    }
  };

  const saveProviderConfig = async (providerName: string, updated: ProviderConfig) => {
    if (!selectedAgentId || !config) return;
    setSavingProvider(providerName);
    try {
      const updatedProviders = { ...providers, [providerName]: updated };
      await api(`/api/agents/${selectedAgentId}/config`, {
        method: "PUT",
        body: JSON.stringify({ models: { providers: updatedProviders } }),
      });
      await fetchAgentData(selectedAgentId);
    } catch {
      // ignore
    } finally {
      setSavingProvider(null);
    }
  };

  const addProvider = async () => {
    if (!selectedAgentId || !config || !newProvider.name.trim()) return;
    setSavingProvider(newProvider.name);
    try {
      const updatedProviders = {
        ...providers,
        [newProvider.name.toLowerCase().trim()]: {
          baseUrl: newProvider.baseUrl,
          apiKey: newProvider.apiKey,
          models: [],
        },
      };
      await api(`/api/agents/${selectedAgentId}/config`, {
        method: "PUT",
        body: JSON.stringify({ models: { providers: updatedProviders } }),
      });
      setNewProvider({ name: "", baseUrl: "", apiKey: "" });
      setShowAddProvider(false);
      await fetchAgentData(selectedAgentId);
    } catch {
      // ignore
    } finally {
      setSavingProvider(null);
    }
  };

  const toggleProvider = (name: string) => {
    setExpandedProviders((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  /* ---- build quick-switch list (include ollama if configured) ---- */
  const quickModels = [...QUICK_MODELS];
  if (providers["ollama"]) {
    for (const m of providers["ollama"].models) {
      quickModels.push({ provider: "ollama", id: m.id, label: m.name || m.id });
    }
  }

  /* ---- build full catalog rows ---- */
  const catalogRows: { provider: string; model: ModelEntry }[] = [];
  for (const cp of catalog) {
    for (const m of cp.models) {
      catalogRows.push({ provider: cp.provider, model: m });
    }
  }

  /* ---- format helpers ---- */
  const fmtCtx = (n: number) => {
    if (!n) return "-";
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return String(n);
  };

  /* ================================================================ */
  /*  Render                                                           */
  /* ================================================================ */

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 24 }}>Models &amp; Providers</h1>

      {/* ---- 1. Agent Selector ---- */}
      <div style={{ ...cardStyle, marginBottom: 24 }}>
        <label style={labelStyle}>Select Agent</label>
        <select
          value={selectedAgentId}
          onChange={(e) => setSelectedAgentId(e.target.value)}
          style={{
            width: "100%",
            padding: "8px 12px",
            borderRadius: 6,
            border: "1px solid var(--border)",
            background: "var(--bg)",
            color: "var(--text)",
            fontSize: 14,
          }}
        >
          {agents.length === 0 && <option value="">No agents available</option>}
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.status})
            </option>
          ))}
        </select>
      </div>

      {selectedAgent && (
        <>
          {/* ---- 2. Current Model ---- */}
          <div
            style={{
              ...cardStyle,
              marginBottom: 24,
              borderLeft: "4px solid var(--accent)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <span style={{ ...labelStyle, marginBottom: 8 }}>Current Model</span>
                <div style={{ fontSize: 20, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>
                  {activeModelId || "Not set"}
                </div>
                <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 8 }}>
                  Provider: <strong style={{ color: "var(--text)" }}>{activeProvider || "-"}</strong>
                </div>
                {currentMeta && (
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                    <span
                      style={{
                        fontSize: 12,
                        padding: "2px 8px",
                        borderRadius: 4,
                        background: currentMeta.reasoning ? "var(--green)" : "var(--surface)",
                        color: currentMeta.reasoning ? "#fff" : "var(--text-muted)",
                        border: currentMeta.reasoning ? "none" : "1px solid var(--border)",
                      }}
                    >
                      {currentMeta.reasoning ? "Reasoning" : "Standard"}
                    </span>
                    <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                      Context: {fmtCtx(currentMeta.contextWindow)}
                    </span>
                    <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                      Max tokens: {fmtCtx(currentMeta.maxTokens)}
                    </span>
                  </div>
                )}
              </div>
              {switching && (
                <span style={{ fontSize: 13, color: "var(--yellow)" }}>Switching...</span>
              )}
            </div>
          </div>

          {/* ---- 3. Quick Model Switcher ---- */}
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 18, marginBottom: 12 }}>Quick Switch</h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                gap: 12,
              }}
            >
              {quickModels.map((qm) => {
                const isActive =
                  activeProvider === qm.provider && activeModelId === qm.id;
                const meta = findModelMeta(qm.provider, qm.id);
                return (
                  <button
                    key={`${qm.provider}/${qm.id}`}
                    onClick={() => switchModel(qm.provider, qm.id)}
                    disabled={switching}
                    style={{
                      ...cardStyle,
                      cursor: switching ? "wait" : "pointer",
                      textAlign: "left",
                      outline: isActive ? "2px solid var(--accent)" : "none",
                      outlineOffset: -2,
                      opacity: switching ? 0.7 : 1,
                    }}
                  >
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, textTransform: "capitalize" }}>
                      {qm.provider}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>
                      {qm.label}
                    </div>
                    {meta && (
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {meta.reasoning && (
                          <span style={{ fontSize: 11, color: "var(--green)" }}>reasoning</span>
                        )}
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                          {fmtCtx(meta.contextWindow)}
                        </span>
                      </div>
                    )}
                    {isActive && (
                      <div style={{ fontSize: 11, color: "var(--accent)", marginTop: 6, fontWeight: 600 }}>
                        Active
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ---- 4. Provider Configuration ---- */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h2 style={{ fontSize: 18 }}>Provider Configuration</h2>
              <button className="primary" onClick={() => setShowAddProvider(!showAddProvider)}>
                {showAddProvider ? "Cancel" : "+ Add Provider"}
              </button>
            </div>

            {showAddProvider && (
              <div style={{ ...cardStyle, marginBottom: 16 }}>
                <h3 style={{ fontSize: 15, marginBottom: 12 }}>New Provider</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <label>
                    <span style={labelStyle}>Provider Name (e.g. openrouter, together, groq)</span>
                    <input
                      value={newProvider.name}
                      onChange={(e) => setNewProvider({ ...newProvider, name: e.target.value })}
                      placeholder="openrouter"
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: 6,
                        border: "1px solid var(--border)",
                        background: "var(--bg)",
                        color: "var(--text)",
                      }}
                    />
                  </label>
                  <label>
                    <span style={labelStyle}>Base URL</span>
                    <input
                      value={newProvider.baseUrl}
                      onChange={(e) => setNewProvider({ ...newProvider, baseUrl: e.target.value })}
                      placeholder="https://openrouter.ai/api/v1"
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: 6,
                        border: "1px solid var(--border)",
                        background: "var(--bg)",
                        color: "var(--text)",
                      }}
                    />
                  </label>
                  <label>
                    <span style={labelStyle}>API Key</span>
                    <input
                      type="password"
                      value={newProvider.apiKey}
                      onChange={(e) => setNewProvider({ ...newProvider, apiKey: e.target.value })}
                      placeholder="sk-..."
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: 6,
                        border: "1px solid var(--border)",
                        background: "var(--bg)",
                        color: "var(--text)",
                      }}
                    />
                  </label>
                  <button
                    className="primary"
                    onClick={addProvider}
                    disabled={!newProvider.name.trim() || savingProvider !== null}
                  >
                    {savingProvider ? "Saving..." : "Add Provider"}
                  </button>
                </div>
              </div>
            )}

            {Object.entries(providers).map(([providerName, pConfig]) => (
              <ProviderSection
                key={providerName}
                name={providerName}
                config={pConfig}
                expanded={!!expandedProviders[providerName]}
                onToggle={() => toggleProvider(providerName)}
                onSave={(updated) => saveProviderConfig(providerName, updated)}
                saving={savingProvider === providerName}
              />
            ))}
          </div>

          {/* ---- 5. Model Catalog ---- */}
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 18, marginBottom: 12 }}>Model Catalog</h2>
            <div style={{ ...cardStyle, overflowX: "auto" }}>
              {catalogRows.length === 0 ? (
                <div style={{ color: "var(--text-muted)", fontSize: 14 }}>
                  No models found. Select an agent to load the catalog.
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-muted)", fontWeight: 500 }}>
                        Provider
                      </th>
                      <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-muted)", fontWeight: 500 }}>
                        Model
                      </th>
                      <th style={{ textAlign: "center", padding: "8px 12px", color: "var(--text-muted)", fontWeight: 500 }}>
                        Reasoning
                      </th>
                      <th style={{ textAlign: "right", padding: "8px 12px", color: "var(--text-muted)", fontWeight: 500 }}>
                        Context Window
                      </th>
                      <th style={{ textAlign: "right", padding: "8px 12px", color: "var(--text-muted)", fontWeight: 500 }}>
                        Max Tokens
                      </th>
                      <th style={{ textAlign: "center", padding: "8px 12px", color: "var(--text-muted)", fontWeight: 500 }}>
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {catalogRows.map((row) => {
                      const isActive =
                        activeProvider === row.provider && activeModelId === row.model.id;
                      return (
                        <tr
                          key={`${row.provider}/${row.model.id}`}
                          style={{
                            borderBottom: "1px solid var(--border)",
                            background: isActive ? "rgba(var(--accent-rgb, 99,102,241), 0.08)" : "transparent",
                          }}
                        >
                          <td style={{ padding: "8px 12px", textTransform: "capitalize" }}>
                            {row.provider}
                          </td>
                          <td style={{ padding: "8px 12px", fontWeight: 500 }}>
                            {row.model.name || row.model.id}
                          </td>
                          <td style={{ padding: "8px 12px", textAlign: "center" }}>
                            {row.model.reasoning ? (
                              <span style={{ color: "var(--green)", fontWeight: 600 }}>Yes</span>
                            ) : (
                              <span style={{ color: "var(--text-muted)" }}>No</span>
                            )}
                          </td>
                          <td style={{ padding: "8px 12px", textAlign: "right" }}>
                            {fmtCtx(row.model.contextWindow)}
                          </td>
                          <td style={{ padding: "8px 12px", textAlign: "right" }}>
                            {fmtCtx(row.model.maxTokens)}
                          </td>
                          <td style={{ padding: "8px 12px", textAlign: "center" }}>
                            {isActive ? (
                              <span style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600 }}>Active</span>
                            ) : (
                              <button
                                className="primary"
                                style={{ fontSize: 12, padding: "4px 12px" }}
                                disabled={switching}
                                onClick={() => switchModel(row.provider, row.model.id)}
                              >
                                Use
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ================================================================== */
/*  Provider Section (sub-component)                                   */
/* ================================================================== */

function ProviderSection({
  name,
  config,
  expanded,
  onToggle,
  onSave,
  saving,
}: {
  name: string;
  config: ProviderConfig;
  expanded: boolean;
  onToggle: () => void;
  onSave: (updated: ProviderConfig) => void;
  saving: boolean;
}) {
  const [baseUrl, setBaseUrl] = useState(config.baseUrl);
  const [apiKey, setApiKey] = useState(config.apiKey);

  useEffect(() => {
    setBaseUrl(config.baseUrl);
    setApiKey(config.apiKey);
  }, [config.baseUrl, config.apiKey]);

  const dirty = baseUrl !== config.baseUrl || apiKey !== config.apiKey;

  const cardStyle = {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: 16,
  } as const;

  const labelStyle = {
    fontSize: 13,
    color: "var(--text-muted)",
    display: "block",
    marginBottom: 4,
  } as const;

  return (
    <div style={{ ...cardStyle, marginBottom: 12 }}>
      <button
        onClick={onToggle}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          width: "100%",
          background: "none",
          border: "none",
          color: "var(--text)",
          cursor: "pointer",
          padding: 0,
          fontSize: 15,
          fontWeight: 600,
          textTransform: "capitalize",
        }}
      >
        <span>{name}</span>
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
          {config.models.length} model{config.models.length !== 1 ? "s" : ""} {expanded ? "▲" : "▼"}
        </span>
      </button>

      {expanded && (
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <label>
            <span style={labelStyle}>Base URL</span>
            <input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "var(--bg)",
                color: "var(--text)",
              }}
            />
          </label>
          <label>
            <span style={labelStyle}>API Key</span>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "var(--bg)",
                color: "var(--text)",
              }}
            />
          </label>

          {dirty && (
            <button
              className="primary"
              onClick={() => onSave({ ...config, baseUrl, apiKey })}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          )}

          {config.models.length > 0 && (
            <div>
              <span style={labelStyle}>Available Models</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {config.models.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "6px 10px",
                      borderRadius: 6,
                      background: "var(--bg)",
                      border: "1px solid var(--border)",
                      fontSize: 13,
                    }}
                  >
                    <span style={{ fontWeight: 500, color: "var(--text)" }}>{m.name || m.id}</span>
                    <div style={{ display: "flex", gap: 12, alignItems: "center", color: "var(--text-muted)", fontSize: 12 }}>
                      {m.reasoning && <span style={{ color: "var(--green)" }}>reasoning</span>}
                      <span>{m.contextWindow ? `${(m.contextWindow / 1000).toFixed(0)}K ctx` : ""}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
