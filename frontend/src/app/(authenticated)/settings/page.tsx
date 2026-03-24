"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

/* ── types ────────────────────────────────────────────────────────── */

interface Agent {
  id: string;
  name: string;
  status: string;
}

interface AgentFile {
  filename: string;
}

/* ── styles ───────────────────────────────────────────────────────── */

const cardStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: 16,
};

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  color: "var(--text-muted)",
  display: "block",
  marginBottom: 4,
};

const sectionTitle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
  marginBottom: 8,
  cursor: "pointer",
  userSelect: "none",
};

const textareaBase: React.CSSProperties = {
  width: "100%",
  background: "var(--bg)",
  color: "var(--text)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: 10,
  fontSize: 13,
  resize: "vertical",
};

const btnSmall: React.CSSProperties = {
  fontSize: 13,
  padding: "6px 14px",
};

/* ── helpers ──────────────────────────────────────────────────────── */

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

/* ── page ─────────────────────────────────────────────────────────── */

export default function SettingsPage() {
  /* ── agent selector state ──────────────────────────────────────── */
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [agentsError, setAgentsError] = useState<string | null>(null);

  /* ── config state ──────────────────────────────────────────────── */
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [configJson, setConfigJson] = useState("");
  const [configOpen, setConfigOpen] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [configSuccess, setConfigSuccess] = useState(false);

  /* ── system prompt state ───────────────────────────────────────── */
  const [systemPrompt, setSystemPrompt] = useState("");
  const [promptSaving, setPromptSaving] = useState(false);
  const [promptError, setPromptError] = useState<string | null>(null);
  const [promptSuccess, setPromptSuccess] = useState(false);

  /* ── md files state ────────────────────────────────────────────── */
  const [files, setFiles] = useState<AgentFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState("");
  const [fileLoading, setFileLoading] = useState(false);
  const [fileSaving, setFileSaving] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileSuccess, setFileSuccess] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [showNewFile, setShowNewFile] = useState(false);

  /* ── raw config state ──────────────────────────────────────────── */
  const [rawOpen, setRawOpen] = useState(false);
  const [rawJson, setRawJson] = useState("");
  const [rawSaving, setRawSaving] = useState(false);
  const [rawError, setRawError] = useState<string | null>(null);
  const [rawSuccess, setRawSuccess] = useState(false);

  /* ── fetch agents (poll every 15s) ─────────────────────────────── */
  const fetchAgents = useCallback(async () => {
    try {
      const data = await api<Agent[]>("/api/agents");
      setAgents(data);
      setAgentsError(null);
      if (data.length > 0 && !selectedAgentId) {
        setSelectedAgentId(data[0].id);
      }
    } catch (err) {
      setAgentsError(err instanceof Error ? err.message : "Failed to load agents");
    }
  }, [selectedAgentId]);

  useEffect(() => {
    fetchAgents();
    const interval = setInterval(fetchAgents, 15000);
    return () => clearInterval(interval);
  }, [fetchAgents]);

  /* ── fetch agent config ────────────────────────────────────────── */
  const fetchConfig = useCallback(async (agentId: string) => {
    setConfigError(null);
    try {
      const data = await api<Record<string, unknown>>(`/api/agents/${agentId}/config`);
      setConfig(data);
      setConfigJson(JSON.stringify(data, null, 2));
      setRawJson(JSON.stringify(data, null, 2));

      // extract system prompt
      const prompt = getNestedValue(data, "agents.defaults.systemPrompt");
      setSystemPrompt(typeof prompt === "string" ? prompt : "");
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : "Failed to load config");
      setConfig(null);
      setConfigJson("");
      setRawJson("");
      setSystemPrompt("");
    }
  }, []);

  /* ── fetch files list ──────────────────────────────────────────── */
  const fetchFiles = useCallback(async (agentId: string) => {
    setFilesLoading(true);
    setFilesError(null);
    try {
      const data = await api<AgentFile[]>(`/api/agents/${agentId}/files`);
      setFiles(data);
    } catch (err) {
      setFilesError(err instanceof Error ? err.message : "Failed to load files");
      setFiles([]);
    } finally {
      setFilesLoading(false);
    }
  }, []);

  /* ── when selected agent changes ───────────────────────────────── */
  useEffect(() => {
    if (!selectedAgentId) return;
    setActiveFile(null);
    setFileContent("");
    setConfigOpen(false);
    setRawOpen(false);
    fetchConfig(selectedAgentId);
    fetchFiles(selectedAgentId);
  }, [selectedAgentId, fetchConfig, fetchFiles]);

  /* ── save config patch ─────────────────────────────────────────── */
  const saveConfig = useCallback(async () => {
    if (!selectedAgentId) return;
    setConfigSaving(true);
    setConfigError(null);
    setConfigSuccess(false);
    try {
      const parsed = JSON.parse(configJson);
      await api(`/api/agents/${selectedAgentId}/config`, {
        method: "PUT",
        body: JSON.stringify(parsed),
      });
      setConfig(parsed);
      setRawJson(JSON.stringify(parsed, null, 2));
      setConfigSuccess(true);
      setTimeout(() => setConfigSuccess(false), 2000);
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : "Failed to save config");
    } finally {
      setConfigSaving(false);
    }
  }, [selectedAgentId, configJson]);

  /* ── save system prompt ────────────────────────────────────────── */
  const saveSystemPrompt = useCallback(async () => {
    if (!selectedAgentId) return;
    setPromptSaving(true);
    setPromptError(null);
    setPromptSuccess(false);
    try {
      await api(`/api/agents/${selectedAgentId}`, {
        method: "PUT",
        body: JSON.stringify({ systemPrompt }),
      });
      setPromptSuccess(true);
      setTimeout(() => setPromptSuccess(false), 2000);
    } catch (err) {
      setPromptError(err instanceof Error ? err.message : "Failed to save system prompt");
    } finally {
      setPromptSaving(false);
    }
  }, [selectedAgentId, systemPrompt]);

  /* ── load a file ───────────────────────────────────────────────── */
  const loadFile = useCallback(async (filename: string) => {
    if (!selectedAgentId) return;
    setActiveFile(filename);
    setFileLoading(true);
    setFileError(null);
    setFileSuccess(false);
    try {
      const data = await api<{ content: string }>(
        `/api/agents/${selectedAgentId}/files/${encodeURIComponent(filename)}`,
      );
      setFileContent(data.content);
    } catch (err) {
      setFileError(err instanceof Error ? err.message : "Failed to load file");
      setFileContent("");
    } finally {
      setFileLoading(false);
    }
  }, [selectedAgentId]);

  /* ── save a file ───────────────────────────────────────────────── */
  const saveFile = useCallback(async () => {
    if (!selectedAgentId || !activeFile) return;
    setFileSaving(true);
    setFileError(null);
    setFileSuccess(false);
    try {
      await api(`/api/agents/${selectedAgentId}/files/${encodeURIComponent(activeFile)}`, {
        method: "PUT",
        body: JSON.stringify({ content: fileContent }),
      });
      setFileSuccess(true);
      setTimeout(() => setFileSuccess(false), 2000);
    } catch (err) {
      setFileError(err instanceof Error ? err.message : "Failed to save file");
    } finally {
      setFileSaving(false);
    }
  }, [selectedAgentId, activeFile, fileContent]);

  /* ── create new file ───────────────────────────────────────────── */
  const createFile = useCallback(async () => {
    if (!selectedAgentId || !newFileName.trim()) return;
    const name = newFileName.trim().endsWith(".md") ? newFileName.trim() : `${newFileName.trim()}.md`;
    setFileError(null);
    try {
      await api(`/api/agents/${selectedAgentId}/files/${encodeURIComponent(name)}`, {
        method: "PUT",
        body: JSON.stringify({ content: "" }),
      });
      setNewFileName("");
      setShowNewFile(false);
      await fetchFiles(selectedAgentId);
      setActiveFile(name);
      setFileContent("");
    } catch (err) {
      setFileError(err instanceof Error ? err.message : "Failed to create file");
    }
  }, [selectedAgentId, newFileName, fetchFiles]);

  /* ── save raw config ───────────────────────────────────────────── */
  const saveRawConfig = useCallback(async () => {
    if (!selectedAgentId) return;
    setRawSaving(true);
    setRawError(null);
    setRawSuccess(false);
    try {
      const parsed = JSON.parse(rawJson);
      await api(`/api/agents/${selectedAgentId}/config`, {
        method: "PUT",
        body: JSON.stringify(parsed),
      });
      setConfig(parsed);
      setConfigJson(JSON.stringify(parsed, null, 2));
      const prompt = getNestedValue(parsed, "agents.defaults.systemPrompt");
      setSystemPrompt(typeof prompt === "string" ? prompt : "");
      setRawSuccess(true);
      setTimeout(() => setRawSuccess(false), 2000);
    } catch (err) {
      setRawError(err instanceof Error ? err.message : "Failed to save config");
    } finally {
      setRawSaving(false);
    }
  }, [selectedAgentId, rawJson]);

  /* ── render ────────────────────────────────────────────────────── */

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 24 }}>Settings</h1>

      {/* ── 1. Agent Selector ──────────────────────────────────────── */}
      <div style={{ ...cardStyle, marginBottom: 20 }}>
        <label style={labelStyle}>Agent</label>
        {agentsError && (
          <div style={{ color: "var(--red)", fontSize: 13, marginBottom: 8 }}>{agentsError}</div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <select
            value={selectedAgentId}
            onChange={(e) => setSelectedAgentId(e.target.value)}
            style={{
              flex: 1,
              background: "var(--bg)",
              color: "var(--text)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              padding: "8px 12px",
              fontSize: 14,
            }}
          >
            {agents.length === 0 && <option value="">No agents available</option>}
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name} ({agent.status})
              </option>
            ))}
          </select>
          {selectedAgent && (
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: selectedAgent.status === "online" ? "var(--green)" : "var(--red)",
                flexShrink: 0,
              }}
            />
          )}
        </div>
      </div>

      {!selectedAgentId && (
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Select an agent to configure.</p>
      )}

      {selectedAgentId && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* ── 2. OpenClaw Config Viewer/Editor ────────────────────── */}
          <div style={cardStyle}>
            <div
              style={sectionTitle}
              onClick={() => setConfigOpen(!configOpen)}
            >
              {configOpen ? "\u25BC" : "\u25B6"} OpenClaw Config
            </div>

            {configError && (
              <div style={{ color: "var(--red)", fontSize: 13, marginBottom: 8 }}>{configError}</div>
            )}

            {configOpen && (
              <>
                {config === null && !configError && (
                  <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading config...</p>
                )}
                <textarea
                  value={configJson}
                  onChange={(e) => setConfigJson(e.target.value)}
                  rows={16}
                  style={{ ...textareaBase, fontFamily: "monospace" }}
                />
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
                  <button
                    className="primary"
                    onClick={saveConfig}
                    disabled={configSaving}
                    style={btnSmall}
                  >
                    {configSaving ? "Saving..." : "Save Config"}
                  </button>
                  {configSuccess && (
                    <span style={{ color: "var(--green)", fontSize: 13 }}>Saved</span>
                  )}
                </div>
              </>
            )}
          </div>

          {/* ── 3. System Prompt Editor ─────────────────────────────── */}
          <div style={cardStyle}>
            <label style={{ ...labelStyle, fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
              System Prompt
            </label>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>
              agents.defaults.systemPrompt
            </p>
            {promptError && (
              <div style={{ color: "var(--red)", fontSize: 13, marginBottom: 8 }}>{promptError}</div>
            )}
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={12}
              style={textareaBase}
              placeholder="Enter the system prompt for this agent..."
            />
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
              <button
                className="primary"
                onClick={saveSystemPrompt}
                disabled={promptSaving}
                style={btnSmall}
              >
                {promptSaving ? "Saving..." : "Save Prompt"}
              </button>
              {promptSuccess && (
                <span style={{ color: "var(--green)", fontSize: 13 }}>Saved</span>
              )}
            </div>
          </div>

          {/* ── 4. .md File Builder ─────────────────────────────────── */}
          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 16, fontWeight: 600 }}>Markdown Files</span>
              <button
                onClick={() => setShowNewFile(!showNewFile)}
                style={btnSmall}
              >
                {showNewFile ? "Cancel" : "New File"}
              </button>
            </div>

            {filesError && (
              <div style={{ color: "var(--red)", fontSize: 13, marginBottom: 8 }}>{filesError}</div>
            )}

            {showNewFile && (
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <input
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  placeholder="filename.md"
                  style={{
                    flex: 1,
                    background: "var(--bg)",
                    color: "var(--text)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    padding: "6px 10px",
                    fontSize: 13,
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") createFile();
                  }}
                />
                <button className="primary" onClick={createFile} style={btnSmall}>
                  Create
                </button>
              </div>
            )}

            {filesLoading && (
              <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading files...</p>
            )}

            {!filesLoading && files.length === 0 && (
              <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No markdown files yet.</p>
            )}

            {files.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                {files.map((f) => (
                  <button
                    key={f.filename}
                    onClick={() => loadFile(f.filename)}
                    style={{
                      ...btnSmall,
                      background:
                        activeFile === f.filename ? "var(--accent)" : "var(--bg)",
                      color:
                        activeFile === f.filename ? "#fff" : "var(--text)",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                    }}
                  >
                    {f.filename}
                  </button>
                ))}
              </div>
            )}

            {activeFile && (
              <>
                <label style={labelStyle}>Editing: {activeFile}</label>
                {fileLoading ? (
                  <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading file...</p>
                ) : (
                  <>
                    {fileError && (
                      <div style={{ color: "var(--red)", fontSize: 13, marginBottom: 8 }}>
                        {fileError}
                      </div>
                    )}
                    <textarea
                      value={fileContent}
                      onChange={(e) => setFileContent(e.target.value)}
                      rows={16}
                      style={{ ...textareaBase, fontFamily: "monospace" }}
                    />
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
                      <button
                        className="primary"
                        onClick={saveFile}
                        disabled={fileSaving}
                        style={btnSmall}
                      >
                        {fileSaving ? "Saving..." : "Save File"}
                      </button>
                      {fileSuccess && (
                        <span style={{ color: "var(--green)", fontSize: 13 }}>Saved</span>
                      )}
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {/* ── 5. Raw Config JSON ──────────────────────────────────── */}
          <div style={cardStyle}>
            <div
              style={sectionTitle}
              onClick={() => setRawOpen(!rawOpen)}
            >
              {rawOpen ? "\u25BC" : "\u25B6"} Raw Config JSON
            </div>

            {rawOpen && (
              <>
                {rawError && (
                  <div style={{ color: "var(--red)", fontSize: 13, marginBottom: 8 }}>{rawError}</div>
                )}
                <textarea
                  value={rawJson}
                  onChange={(e) => setRawJson(e.target.value)}
                  rows={20}
                  style={{ ...textareaBase, fontFamily: "monospace" }}
                />
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
                  <button
                    className="primary"
                    onClick={saveRawConfig}
                    disabled={rawSaving}
                    style={btnSmall}
                  >
                    {rawSaving ? "Saving..." : "Save Raw Config"}
                  </button>
                  {rawSuccess && (
                    <span style={{ color: "var(--green)", fontSize: 13 }}>Saved</span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
