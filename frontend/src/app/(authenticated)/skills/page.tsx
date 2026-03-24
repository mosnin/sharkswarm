"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

interface Agent {
  id: string;
  name: string;
  status: string;
}

interface Skill {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  source: string;
}

interface Tool {
  name: string;
  description: string;
  type: string;
}

interface SkillSettings {
  enabled: boolean;
  apiKey?: string;
  env?: Record<string, string>;
  config?: Record<string, unknown>;
}

interface AgentConfig {
  skills?: {
    entries?: Record<string, SkillSettings>;
  };
  [key: string]: unknown;
}

export default function SkillsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [skills, setSkills] = useState<Skill[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [agentConfig, setAgentConfig] = useState<AgentConfig>({});
  const [installInput, setInstallInput] = useState("");
  const [installing, setInstalling] = useState(false);
  const [expandedSkillId, setExpandedSkillId] = useState<string | null>(null);
  const [settingsForm, setSettingsForm] = useState<{
    enabled: boolean;
    apiKey: string;
    env: string;
    config: string;
  }>({ enabled: true, apiKey: "", env: "", config: "{}" });
  const [saving, setSaving] = useState(false);
  const [updatingSkillId, setUpdatingSkillId] = useState<string | null>(null);

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

  const fetchSkills = useCallback(async () => {
    if (!selectedAgentId) return;
    try {
      const data = await api<Skill[]>(`/api/agents/${selectedAgentId}/skills`);
      setSkills(data);
    } catch {
      setSkills([]);
    }
  }, [selectedAgentId]);

  const fetchTools = useCallback(async () => {
    if (!selectedAgentId) return;
    try {
      const data = await api<Tool[]>(`/api/agents/${selectedAgentId}/tools-catalog`);
      setTools(data);
    } catch {
      setTools([]);
    }
  }, [selectedAgentId]);

  const fetchConfig = useCallback(async () => {
    if (!selectedAgentId) return;
    try {
      const data = await api<AgentConfig>(`/api/agents/${selectedAgentId}/config`);
      setAgentConfig(data);
    } catch {
      setAgentConfig({});
    }
  }, [selectedAgentId]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  useEffect(() => {
    if (selectedAgentId) {
      fetchSkills();
      fetchTools();
      fetchConfig();
    }
  }, [selectedAgentId, fetchSkills, fetchTools, fetchConfig]);

  const handleToggleSkill = async (skillId: string, enabled: boolean) => {
    if (!selectedAgentId) return;
    try {
      await api(`/api/agents/${selectedAgentId}/config`, {
        method: "PUT",
        body: JSON.stringify({
          skills: {
            entries: {
              [skillId]: { enabled },
            },
          },
        }),
      });
      setSkills((prev) =>
        prev.map((s) => (s.id === skillId ? { ...s, enabled } : s))
      );
      await fetchConfig();
    } catch {
      // ignore
    }
  };

  const handleUpdateSkill = async (skillId: string) => {
    if (!selectedAgentId) return;
    setUpdatingSkillId(skillId);
    try {
      await api(`/api/agents/${selectedAgentId}/gateway/skills.update`, {
        method: "POST",
        body: JSON.stringify({ id: skillId }),
      });
      await fetchSkills();
    } catch {
      // ignore
    } finally {
      setUpdatingSkillId(null);
    }
  };

  const handleInstall = async () => {
    if (!selectedAgentId || !installInput.trim()) return;
    setInstalling(true);
    try {
      await api(`/api/agents/${selectedAgentId}/gateway/skills.install`, {
        method: "POST",
        body: JSON.stringify({ id: installInput.trim() }),
      });
      setInstallInput("");
      await fetchSkills();
    } catch {
      // ignore
    } finally {
      setInstalling(false);
    }
  };

  const openSkillSettings = (skill: Skill) => {
    const entries = agentConfig?.skills?.entries ?? {};
    const entry = entries[skill.id] ?? {};
    setExpandedSkillId(skill.id);
    setSettingsForm({
      enabled: skill.enabled,
      apiKey: entry.apiKey ?? "",
      env: entry.env ? Object.entries(entry.env).map(([k, v]) => `${k}=${v}`).join("\n") : "",
      config: entry.config ? JSON.stringify(entry.config, null, 2) : "{}",
    });
  };

  const handleSaveSettings = async () => {
    if (!selectedAgentId || !expandedSkillId) return;
    setSaving(true);
    try {
      const envPairs: Record<string, string> = {};
      if (settingsForm.env.trim()) {
        settingsForm.env
          .split("\n")
          .filter((l) => l.includes("="))
          .forEach((line) => {
            const idx = line.indexOf("=");
            envPairs[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
          });
      }

      let customConfig: Record<string, unknown> = {};
      try {
        customConfig = JSON.parse(settingsForm.config);
      } catch {
        // keep empty
      }

      const payload: SkillSettings = {
        enabled: settingsForm.enabled,
        env: Object.keys(envPairs).length > 0 ? envPairs : undefined,
        config: Object.keys(customConfig).length > 0 ? customConfig : undefined,
      };
      if (settingsForm.apiKey) {
        payload.apiKey = settingsForm.apiKey;
      }

      await api(`/api/agents/${selectedAgentId}/config`, {
        method: "PUT",
        body: JSON.stringify({
          skills: {
            entries: {
              [expandedSkillId]: payload,
            },
          },
        }),
      });

      await Promise.all([fetchSkills(), fetchConfig()]);
      setExpandedSkillId(null);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const sourceBadgeColor = (source: string) => {
    switch (source) {
      case "bundled":
        return "var(--accent)";
      case "managed":
        return "var(--green)";
      case "workspace":
        return "var(--yellow)";
      default:
        return "var(--text-muted)";
    }
  };

  const toolTypeBadgeColor = (type: string) => {
    switch (type) {
      case "built-in":
        return "var(--accent)";
      case "MCP":
        return "var(--green)";
      case "API":
        return "var(--yellow)";
      default:
        return "var(--text-muted)";
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 24 }}>Skills</h1>

      {/* Agent Selector */}
      <div style={{ marginBottom: 24 }}>
        <label>
          <span style={labelStyle}>Select Agent</span>
          <select
            value={selectedAgentId}
            onChange={(e) => {
              setSelectedAgentId(e.target.value);
              setExpandedSkillId(null);
            }}
            style={{ minWidth: 240 }}
          >
            {agents.length === 0 && <option value="">No agents available</option>}
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.status})
              </option>
            ))}
          </select>
        </label>
      </div>

      {!selectedAgentId && (
        <p style={{ color: "var(--text-muted)" }}>
          Select an agent to manage its skills.
        </p>
      )}

      {selectedAgentId && (
        <>
          {/* Installed Skills */}
          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 18, marginBottom: 12 }}>Installed Skills</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {skills.length === 0 && (
                <p style={{ color: "var(--text-muted)", gridColumn: "1 / -1" }}>
                  No skills installed for this agent.
                </p>
              )}
              {skills.map((skill) => (
                <div
                  key={skill.id}
                  style={{
                    ...cardStyle,
                    cursor: "pointer",
                    outline:
                      expandedSkillId === skill.id
                        ? "2px solid var(--accent)"
                        : "none",
                  }}
                  onClick={() => {
                    if (expandedSkillId === skill.id) {
                      setExpandedSkillId(null);
                    } else {
                      openSkillSettings(skill);
                    }
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 4,
                        }}
                      >
                        <strong style={{ fontSize: 15 }}>{skill.name}</strong>
                        <span
                          style={{
                            fontSize: 11,
                            padding: "2px 6px",
                            borderRadius: 4,
                            background: sourceBadgeColor(skill.source),
                            color: "#fff",
                            textTransform: "uppercase",
                            fontWeight: 600,
                          }}
                        >
                          {skill.source}
                        </span>
                      </div>
                      <p
                        style={{
                          fontSize: 13,
                          color: "var(--text-muted)",
                          marginTop: 2,
                        }}
                      >
                        {skill.description}
                      </p>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      marginTop: 12,
                    }}
                  >
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        cursor: "pointer",
                        fontSize: 13,
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={skill.enabled}
                        onChange={(e) =>
                          handleToggleSkill(skill.id, e.target.checked)
                        }
                      />
                      {skill.enabled ? (
                        <span style={{ color: "var(--green)" }}>Enabled</span>
                      ) : (
                        <span style={{ color: "var(--text-muted)" }}>
                          Disabled
                        </span>
                      )}
                    </label>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUpdateSkill(skill.id);
                      }}
                      disabled={updatingSkillId === skill.id}
                      style={{ fontSize: 12, padding: "4px 10px" }}
                    >
                      {updatingSkillId === skill.id ? "Updating..." : "Update"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Skill Settings (expanded) */}
          {expandedSkillId && (
            <section style={{ marginBottom: 32 }}>
              <div style={cardStyle}>
                <h3 style={{ fontSize: 16, marginBottom: 12 }}>
                  Skill Settings:{" "}
                  {skills.find((s) => s.id === expandedSkillId)?.name}
                </h3>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      cursor: "pointer",
                      fontSize: 13,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={settingsForm.enabled}
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          enabled: e.target.checked,
                        })
                      }
                    />
                    Enabled
                  </label>

                  <label>
                    <span style={labelStyle}>API Key</span>
                    <input
                      type="password"
                      value={settingsForm.apiKey}
                      placeholder="sk-..."
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          apiKey: e.target.value,
                        })
                      }
                    />
                  </label>

                  <label>
                    <span style={labelStyle}>
                      Environment Variables (one KEY=VALUE per line)
                    </span>
                    <textarea
                      rows={4}
                      value={settingsForm.env}
                      placeholder={"API_URL=https://example.com\nDEBUG=true"}
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          env: e.target.value,
                        })
                      }
                    />
                  </label>

                  <label>
                    <span style={labelStyle}>Custom Config (JSON)</span>
                    <textarea
                      rows={5}
                      value={settingsForm.config}
                      style={{ fontFamily: "monospace", fontSize: 12 }}
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          config: e.target.value,
                        })
                      }
                    />
                  </label>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      className="primary"
                      onClick={handleSaveSettings}
                      disabled={saving}
                    >
                      {saving ? "Saving..." : "Save Settings"}
                    </button>
                    <button onClick={() => setExpandedSkillId(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Available Tools */}
          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 18, marginBottom: 12 }}>Available Tools</h2>
            <div style={cardStyle}>
              {tools.length === 0 ? (
                <p style={{ color: "var(--text-muted)" }}>
                  No tools found in the catalog.
                </p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr
                      style={{
                        borderBottom: "1px solid var(--border)",
                        textAlign: "left",
                      }}
                    >
                      <th
                        style={{
                          padding: "8px 12px",
                          fontSize: 13,
                          color: "var(--text-muted)",
                          fontWeight: 500,
                        }}
                      >
                        Name
                      </th>
                      <th
                        style={{
                          padding: "8px 12px",
                          fontSize: 13,
                          color: "var(--text-muted)",
                          fontWeight: 500,
                        }}
                      >
                        Description
                      </th>
                      <th
                        style={{
                          padding: "8px 12px",
                          fontSize: 13,
                          color: "var(--text-muted)",
                          fontWeight: 500,
                        }}
                      >
                        Type
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {tools.map((tool, idx) => (
                      <tr
                        key={idx}
                        style={{
                          borderBottom: "1px solid var(--border)",
                        }}
                      >
                        <td
                          style={{
                            padding: "8px 12px",
                            fontSize: 14,
                            fontWeight: 500,
                          }}
                        >
                          {tool.name}
                        </td>
                        <td
                          style={{
                            padding: "8px 12px",
                            fontSize: 13,
                            color: "var(--text-muted)",
                          }}
                        >
                          {tool.description}
                        </td>
                        <td style={{ padding: "8px 12px" }}>
                          <span
                            style={{
                              fontSize: 11,
                              padding: "2px 6px",
                              borderRadius: 4,
                              background: toolTypeBadgeColor(tool.type),
                              color: "#fff",
                              textTransform: "uppercase",
                              fontWeight: 600,
                            }}
                          >
                            {tool.type}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          {/* Install New Skill */}
          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 18, marginBottom: 12 }}>
              Install New Skill
            </h2>
            <div style={{ ...cardStyle, display: "flex", gap: 12, alignItems: "flex-end" }}>
              <label style={{ flex: 1 }}>
                <span style={labelStyle}>Skill name or URL</span>
                <input
                  value={installInput}
                  placeholder="e.g. web-search or https://github.com/org/skill"
                  onChange={(e) => setInstallInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleInstall();
                  }}
                />
              </label>
              <button
                className="primary"
                onClick={handleInstall}
                disabled={installing || !installInput.trim()}
                style={{ whiteSpace: "nowrap" }}
              >
                {installing ? "Installing..." : "Install"}
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
