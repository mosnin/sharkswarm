"use client";

import LogViewer from "@/components/LogViewer";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

interface LogEntry {
  id: number;
  agent_id: string;
  level: string;
  message: string;
  created_at: string;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const fetchLogs = useCallback(async () => {
    try {
      setLogs(await api<LogEntry[]>("/api/logs?type=agent_logs"));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 24 }}>Agent Logs</h1>
      <LogViewer logs={logs} />
    </div>
  );
}
