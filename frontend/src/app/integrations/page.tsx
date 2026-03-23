"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

interface ApiTool {
  id: string;
  name: string;
  description: string;
  type: "api";
  method: "GET" | "POST" | "PUT" | "DELETE";
  url: string;
  headers: Record<string, string>;
  bodyTemplate: string;
  createdAt: string;
}

interface McpServer {
  id: string;
  name: string;
  description: string;
  type: "mcp";
  transport: "stdio" | "sse" | "streamable-http";
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  apiKey?: string;
  status: "connected" | "disconnected" | "error";
  tools: string[];
  createdAt: string;
}

type ToolIntegration = ApiTool | McpServer;

type NewApiTool = {
  type: "api";
  name: string;
  description: string;
  method: string;
  url: string;
  headers: string;
  bodyTemplate: string;
};

type NewMcpServer = {
  type: "mcp";
  name: string;
  description: string;
  transport: string;
  command: string;
  args: string;
  url: string;
  apiKey: string;
};

const emptyApi: NewApiTool = {
  type: "api",
  name: "",
  description: "",
  method: "GET",
  url: "",
  headers: "{}",
  bodyTemplate: "",
};

const emptyMcp: NewMcpServer = {
  type: "mcp",
  name: "",
  description: "",
  transport: "stdio",
  command: "",
  args: "",
  url: "",
  apiKey: "",
};

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<ToolIntegration[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<"api" | "mcp">("api");
  const [apiForm, setApiForm] = useState<NewApiTool>({ ...emptyApi });
  const [mcpForm, setMcpForm] = useState<NewMcpServer>({ ...emptyMcp });
  const [testResult, setTestResult] = useState<Record<string, unknown> | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  const fetchIntegrations = useCallback(async () => {
    try {
      setIntegrations(await api<ToolIntegration[]>("/api/integrations"));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  const handleCreate = async () => {
    if (formType === "api") {
      let headers: Record<string, string> = {};
      try {
        headers = JSON.parse(apiForm.headers);
      } catch {
        // keep empty
      }
      await api("/api/integrations", {
        method: "POST",
        body: JSON.stringify({
          type: "api",
          name: apiForm.name,
          description: apiForm.description,
          method: apiForm.method,
          url: apiForm.url,
          headers,
          bodyTemplate: apiForm.bodyTemplate,
        }),
      });
    } else {
      await api("/api/integrations", {
        method: "POST",
        body: JSON.stringify({
          type: "mcp",
          name: mcpForm.name,
          description: mcpForm.description,
          transport: mcpForm.transport,
          command: mcpForm.command || undefined,
          args: mcpForm.args ? mcpForm.args.split(" ").filter(Boolean) : [],
          url: mcpForm.url || undefined,
          apiKey: mcpForm.apiKey || undefined,
        }),
      });
    }
    setShowForm(false);
    setApiForm({ ...emptyApi });
    setMcpForm({ ...emptyMcp });
    await fetchIntegrations();
  };

  const handleDelete = async (id: string) => {
    await api(`/api/integrations/${id}`, { method: "DELETE" });
    await fetchIntegrations();
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    setTestResult(null);
    try {
      const result = await api<Record<string, unknown>>(`/api/integrations/${id}/test`, {
        method: "POST",
        body: JSON.stringify({ params: {} }),
      });
      setTestResult(result);
    } catch {
      setTestResult({ ok: false, error: "Request failed" });
    } finally {
      setTestingId(null);
    }
  };

  const labelStyle = { fontSize: 13, color: "var(--text-muted)", display: "block", marginBottom: 4 } as const;
  const cardStyle = {
    background: "var(--surface)",
    borderRadius: 8,
    border: "1px solid var(--border)",
    padding: 16,
  } as const;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 24 }}>Tool Integrations</h1>
        <button className="primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ Add Integration"}
        </button>
      </div>

      {showForm && (
        <div style={{ ...cardStyle, marginBottom: 24 }}>
          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            <button
              className={formType === "api" ? "primary" : ""}
              onClick={() => setFormType("api")}
            >
              API Tool
            </button>
            <button
              className={formType === "mcp" ? "primary" : ""}
              onClick={() => setFormType("mcp")}
            >
              MCP Server
            </button>
          </div>

          {formType === "api" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <label>
                <span style={labelStyle}>Name</span>
                <input
                  value={apiForm.name}
                  placeholder="e.g. Weather API"
                  onChange={(e) => setApiForm({ ...apiForm, name: e.target.value })}
                />
              </label>
              <label>
                <span style={labelStyle}>Description</span>
                <input
                  value={apiForm.description}
                  placeholder="What does this tool do?"
                  onChange={(e) => setApiForm({ ...apiForm, description: e.target.value })}
                />
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 12 }}>
                <label>
                  <span style={labelStyle}>Method</span>
                  <select
                    value={apiForm.method}
                    onChange={(e) => setApiForm({ ...apiForm, method: e.target.value })}
                  >
                    <option>GET</option>
                    <option>POST</option>
                    <option>PUT</option>
                    <option>DELETE</option>
                  </select>
                </label>
                <label>
                  <span style={labelStyle}>URL</span>
                  <input
                    value={apiForm.url}
                    placeholder="https://api.example.com/v1/data?q={{query}}"
                    onChange={(e) => setApiForm({ ...apiForm, url: e.target.value })}
                  />
                </label>
              </div>
              <label>
                <span style={labelStyle}>Headers (JSON)</span>
                <input
                  value={apiForm.headers}
                  placeholder='{"Authorization": "Bearer {{token}}"}'
                  onChange={(e) => setApiForm({ ...apiForm, headers: e.target.value })}
                />
              </label>
              <label>
                <span style={labelStyle}>Body Template (for POST/PUT)</span>
                <textarea
                  rows={3}
                  value={apiForm.bodyTemplate}
                  placeholder='{"query": "{{input}}"}'
                  onChange={(e) => setApiForm({ ...apiForm, bodyTemplate: e.target.value })}
                />
              </label>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <label>
                <span style={labelStyle}>Name</span>
                <input
                  value={mcpForm.name}
                  placeholder="e.g. Filesystem MCP"
                  onChange={(e) => setMcpForm({ ...mcpForm, name: e.target.value })}
                />
              </label>
              <label>
                <span style={labelStyle}>Description</span>
                <input
                  value={mcpForm.description}
                  placeholder="What does this MCP server provide?"
                  onChange={(e) => setMcpForm({ ...mcpForm, description: e.target.value })}
                />
              </label>
              <label>
                <span style={labelStyle}>Transport</span>
                <select
                  value={mcpForm.transport}
                  onChange={(e) => setMcpForm({ ...mcpForm, transport: e.target.value })}
                >
                  <option value="stdio">stdio (local process)</option>
                  <option value="sse">SSE (remote)</option>
                  <option value="streamable-http">Streamable HTTP (remote)</option>
                </select>
              </label>

              {mcpForm.transport === "stdio" ? (
                <>
                  <label>
                    <span style={labelStyle}>Command</span>
                    <input
                      value={mcpForm.command}
                      placeholder="npx"
                      onChange={(e) => setMcpForm({ ...mcpForm, command: e.target.value })}
                    />
                  </label>
                  <label>
                    <span style={labelStyle}>Arguments (space-separated)</span>
                    <input
                      value={mcpForm.args}
                      placeholder="-y @modelcontextprotocol/server-filesystem /data"
                      onChange={(e) => setMcpForm({ ...mcpForm, args: e.target.value })}
                    />
                  </label>
                </>
              ) : (
                <>
                  <label>
                    <span style={labelStyle}>Server URL</span>
                    <input
                      value={mcpForm.url}
                      placeholder="https://mcp.example.com/sse"
                      onChange={(e) => setMcpForm({ ...mcpForm, url: e.target.value })}
                    />
                  </label>
                  <label>
                    <span style={labelStyle}>API Key (optional)</span>
                    <input
                      type="password"
                      value={mcpForm.apiKey}
                      placeholder="sk-..."
                      onChange={(e) => setMcpForm({ ...mcpForm, apiKey: e.target.value })}
                    />
                  </label>
                </>
              )}
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <button
              className="primary"
              onClick={handleCreate}
              disabled={
                formType === "api"
                  ? !apiForm.name || !apiForm.url
                  : !mcpForm.name || (!mcpForm.command && !mcpForm.url)
              }
            >
              Create Integration
            </button>
          </div>
        </div>
      )}

      {/* Integration cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {integrations.length === 0 && (
          <p style={{ color: "var(--text-muted)", gridColumn: "1 / -1" }}>
            No integrations yet. Click &quot;+ Add Integration&quot; to get started.
          </p>
        )}
        {integrations.map((t) => (
          <div key={t.id} style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      fontSize: 11,
                      padding: "2px 6px",
                      borderRadius: 4,
                      background: t.type === "mcp" ? "var(--accent)" : "var(--green)",
                      color: "#fff",
                      textTransform: "uppercase",
                      fontWeight: 600,
                    }}
                  >
                    {t.type}
                  </span>
                  <strong style={{ fontSize: 15 }}>{t.name}</strong>
                </div>
                <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>{t.description}</p>
              </div>
            </div>

            {t.type === "api" && (
              <div style={{ fontSize: 12, fontFamily: "monospace", color: "var(--text-muted)", marginBottom: 8 }}>
                <span style={{ color: "var(--yellow)" }}>{t.method}</span> {t.url}
              </div>
            )}

            {t.type === "mcp" && (
              <div style={{ fontSize: 12, marginBottom: 8 }}>
                <span style={{ fontFamily: "monospace", color: "var(--text-muted)" }}>
                  {t.transport === "stdio"
                    ? `${t.command} ${(t.args || []).join(" ")}`
                    : t.url}
                </span>
                <div style={{ marginTop: 4 }}>
                  <span
                    style={{
                      fontSize: 11,
                      color: t.status === "connected" ? "var(--green)" : "var(--text-muted)",
                    }}
                  >
                    {t.status}
                  </span>
                  {t.tools.length > 0 && (
                    <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 8 }}>
                      {t.tools.length} tools discovered
                    </span>
                  )}
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button
                onClick={() => handleTest(t.id)}
                disabled={testingId === t.id}
                style={{ fontSize: 12, padding: "4px 10px" }}
              >
                {testingId === t.id ? "Testing..." : "Test"}
              </button>
              <button
                onClick={() => handleDelete(t.id)}
                style={{ fontSize: 12, padding: "4px 10px", color: "var(--red)", borderColor: "var(--red)" }}
              >
                Delete
              </button>
            </div>

            {testResult && testingId === null && (
              <div
                style={{
                  marginTop: 8,
                  padding: 8,
                  fontSize: 12,
                  fontFamily: "monospace",
                  background: "var(--bg)",
                  borderRadius: 4,
                  maxHeight: 120,
                  overflowY: "auto",
                }}
              >
                <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(testResult, null, 2)}</pre>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
