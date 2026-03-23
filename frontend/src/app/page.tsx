"use client";

import { useEffect, useState, useCallback } from "react";
import AgentList from "@/components/AgentList";
import MessageForm from "@/components/MessageForm";
import LogViewer from "@/components/LogViewer";

interface Agent {
  id: string;
  name: string;
  url: string;
  status: "online" | "offline";
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
      const res = await fetch("/api/agents");
      const data = await res.json();
      setAgents(data.agents);
    } catch (err) {
      console.error("Failed to fetch agents:", err);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch("/api/logs");
      const data = await res.json();
      setLogs(data.logs);
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
    await fetch("/api/send-message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toAgent, message }),
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
      <h1 style={{ fontSize: 24, marginBottom: 24 }}>OpenClaw Dashboard</h1>

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
