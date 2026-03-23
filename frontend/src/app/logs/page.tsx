"use client";

import LogViewer from "@/components/LogViewer";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

interface AgentInfo {
  id: string;
  name: string;
}

interface LogEntry {
  id: number;
  agent_id: string;
  level: string;
  message: string;
  created_at: string;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [filterAgent, setFilterAgent] = useState("");
  const [filterLevel, setFilterLevel] = useState("");
  const [filterSince, setFilterSince] = useState("");

  const fetchLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterAgent) params.set("agent", filterAgent);
      if (filterLevel) params.set("level", filterLevel);
      if (filterSince) params.set("since", new Date(filterSince).toISOString());
      const qs = params.toString();
      setLogs(await api<LogEntry[]>(`/api/logs/filtered${qs ? `?${qs}` : ""}`));
    } catch {
      // ignore
    }
  }, [filterAgent, filterLevel, filterSince]);

  useEffect(() => {
    api<AgentInfo[]>("/api/agents").then(setAgents).catch(() => {});
  }, []);

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>Agent Logs</h1>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <select
          value={filterAgent}
          onChange={(e) => setFilterAgent(e.target.value)}
          style={{ width: "auto", padding: "6px 12px", fontSize: 13 }}
        >
          <option value="">All agents</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>{a.name} ({a.id})</option>
          ))}
        </select>

        <select
          value={filterLevel}
          onChange={(e) => setFilterLevel(e.target.value)}
          style={{ width: "auto", padding: "6px 12px", fontSize: 13 }}
        >
          <option value="">All levels</option>
          <option value="debug">Debug</option>
          <option value="info">Info</option>
          <option value="warn">Warn</option>
          <option value="error">Error</option>
        </select>

        <input
          type="datetime-local"
          value={filterSince}
          onChange={(e) => setFilterSince(e.target.value)}
          style={{ width: "auto", padding: "6px 12px", fontSize: 13 }}
        />

        {(filterAgent || filterLevel || filterSince) && (
          <button
            onClick={() => {
              setFilterAgent("");
              setFilterLevel("");
              setFilterSince("");
            }}
            style={{ fontSize: 13, padding: "6px 12px" }}
          >
            Clear filters
          </button>
        )}
      </div>

      <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>
        {logs.length} log entries
      </div>

      <LogViewer logs={logs} />
    </div>
  );
}
