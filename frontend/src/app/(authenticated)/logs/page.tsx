"use client";

import LogViewer from "@/components/LogViewer";
import { useEffect, useState, useCallback } from "react";
import { useApi } from "@/lib/useApi";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBlock } from "@/components/ui/error-block";
import { showError } from "@/lib/toast";
import { FileText } from "lucide-react";
import { Pagination } from "@/components/ui/pagination";

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
  const api = useApi();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [filterAgent, setFilterAgent] = useState("");
  const [filterLevel, setFilterLevel] = useState("");
  const [filterSince, setFilterSince] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const LOGS_PER_PAGE = 50;

  const fetchLogs = useCallback(async () => {
    setError("");
    try {
      const params = new URLSearchParams();
      if (filterAgent) params.set("agent", filterAgent);
      if (filterLevel) params.set("level", filterLevel);
      if (filterSince) params.set("since", new Date(filterSince).toISOString());
      const qs = params.toString();
      setLogs(await api<LogEntry[]>(`/api/logs/filtered${qs ? `?${qs}` : ""}`));
    } catch {
      setError("Failed to load logs");
    } finally {
      setLoading(false);
    }
  }, [filterAgent, filterLevel, filterSince]);

  const totalPages = Math.ceil(logs.length / LOGS_PER_PAGE);
  const paginatedLogs = logs.slice((page - 1) * LOGS_PER_PAGE, page * LOGS_PER_PAGE);

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
      <PageHeader title="Agent Logs" description={`${logs.length} entries`} />

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <select
          value={filterAgent}
          onChange={(e) => { setFilterAgent(e.target.value); setPage(1); }}
          style={{ width: "auto", padding: "6px 12px", fontSize: 13 }}
        >
          <option value="">All agents</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>{a.name} ({a.id})</option>
          ))}
        </select>

        <select
          value={filterLevel}
          onChange={(e) => { setFilterLevel(e.target.value); setPage(1); }}
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
          onChange={(e) => { setFilterSince(e.target.value); setPage(1); }}
          style={{ width: "auto", padding: "6px 12px", fontSize: 13 }}
        />

        {(filterAgent || filterLevel || filterSince) && (
          <button
            onClick={() => {
              setFilterAgent("");
              setFilterLevel("");
              setFilterSince("");
              setPage(1);
            }}
            style={{ fontSize: 13, padding: "6px 12px" }}
          >
            Clear filters
          </button>
        )}
      </div>

      {loading ? (
        <TableSkeleton rows={8} cols={3} />
      ) : error ? (
        <ErrorBlock message={error} onRetry={fetchLogs} />
      ) : logs.length === 0 ? (
        <EmptyState
          icon={<FileText size={40} />}
          title="No logs yet"
          description="Logs will appear as your agents process tasks."
        />
      ) : (
        <>
          <LogViewer logs={paginatedLogs} />
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
