"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import AgentList from "@/components/AgentList";
import MessageForm from "@/components/MessageForm";
import LogViewer from "@/components/LogViewer";

interface Agent {
  id: string;
  name: string;
  status: "online" | "offline";
  model: string;
  tools: string[];
}

interface LogEntry {
  id: number;
  from_agent: string;
  to_agent: string;
  content: string;
  created_at: string;
}

export default function Home() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAgents = useCallback(async () => {
    try {
      setAgents(await api<Agent[]>("/api/agents"));
    } catch (err) {
      console.error("Failed to fetch agents:", err);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      setLogs(await api<LogEntry[]>("/api/messages"));
    } catch (err) {
      console.error("Failed to fetch logs:", err);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchAgents(), fetchLogs()]).then(() => setLoading(false));
    const interval = setInterval(() => {
      fetchAgents();
      fetchLogs();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchAgents, fetchLogs]);

  const handleSend = async (toAgent: string, message: string) => {
    await api("/api/send-message", {
      method: "POST",
      body: JSON.stringify({ to_agent: toAgent, message }),
    });
    await fetchLogs();
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: "24px" }}>
      <h1 style={{ fontSize: 24, marginBottom: 24 }}>NanoClaw Dashboard</h1>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 24 }}>
        <div>
          <AgentList agents={agents} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <MessageForm agents={agents} onSend={handleSend} />
          <LogViewer logs={logs} />
        </div>
      </div>
    </main>
  );
}
