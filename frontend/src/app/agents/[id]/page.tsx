"use client";

import { useEffect, useState } from "react";
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

export default function AgentConfigPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params.id as string;

  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<AgentConfig>(`/api/agents/${agentId}`)
      .then(setConfig)
      .catch(() => setError("Agent not found"));
  }, [agentId]);

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

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <label>
          <span style={{ fontSize: 13, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Name</span>
          <input
            value={config.name}
            onChange={(e) => setConfig({ ...config, name: e.target.value })}
          />
        </label>

        <label>
          <span style={{ fontSize: 13, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Model</span>
          <select
            value={config.model}
            onChange={(e) => setConfig({ ...config, model: e.target.value })}
          >
            <option value="claude-sonnet-4-20250514">Claude Sonnet 4</option>
            <option value="claude-opus-4-20250514">Claude Opus 4</option>
            <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5</option>
          </select>
        </label>

        <label>
          <span style={{ fontSize: 13, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>System Prompt</span>
          <textarea
            rows={6}
            value={config.systemPrompt}
            onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
          />
        </label>

        <label>
          <span style={{ fontSize: 13, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
            Tools (comma-separated)
          </span>
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
    </div>
  );
}
