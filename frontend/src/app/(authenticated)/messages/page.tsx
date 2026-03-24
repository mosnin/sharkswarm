"use client";

import MessageForm from "@/components/MessageForm";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { CardListSkeleton } from "@/components/ui/skeleton";
import { showSuccess, showError } from "@/lib/toast";
import { Mail } from "lucide-react";

interface Agent {
  id: string;
  name: string;
  status: "online" | "offline";
}

interface Message {
  id: number;
  from_agent: string;
  to_agent: string;
  content: string;
  created_at: string;
}

export default function MessagesPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAgents = useCallback(async () => {
    try {
      setAgents(await api<Agent[]>("/api/agents"));
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to load agents");
    }
  }, []);

  const fetchMessages = useCallback(async () => {
    try {
      setMessages(await api<Message[]>("/api/messages"));
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to load messages");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [fetchAgents, fetchMessages]);

  const handleSend = async (toAgent: string, message: string) => {
    await api("/api/send-message", {
      method: "POST",
      body: JSON.stringify({ to_agent: toAgent, message }),
    });
    await fetchMessages();
  };

  return (
    <div>
      <PageHeader title="Messages" description="Inter-agent communication" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <MessageForm agents={agents} onSend={handleSend} />
        <div style={{ background: "var(--surface)", borderRadius: 8, border: "1px solid var(--border)", padding: 16 }}>
          <h2 style={{ fontSize: 16, marginBottom: 12 }}>History</h2>
          <div style={{ maxHeight: 400, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, fontFamily: "monospace", fontSize: 13 }}>
            {loading && <CardListSkeleton count={3} />}
            {!loading && messages.length === 0 && (
              <EmptyState
                icon={<Mail size={40} />}
                title="No messages yet"
                description="Messages between agents will appear here."
              />
            )}
            {messages.map((m) => (
              <div key={m.id} style={{ padding: "8px 10px", background: "var(--bg)", borderRadius: 4, border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span>
                    <span style={{ color: "var(--accent)" }}>{m.from_agent}</span>
                    <span style={{ color: "var(--text-muted)" }}> → </span>
                    <span style={{ color: "var(--green)" }}>{m.to_agent}</span>
                  </span>
                  <span style={{ color: "var(--text-muted)", fontSize: 11 }}>
                    {new Date(m.created_at).toLocaleString()}
                  </span>
                </div>
                <div>{m.content}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
