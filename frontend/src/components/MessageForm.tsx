"use client";

import { useState } from "react";

interface Agent {
  id: string;
  name: string;
  url: string;
  status: "online" | "offline";
}

interface Props {
  agents: Agent[];
  onSend: (toAgent: string, message: string) => Promise<void>;
}

export default function MessageForm({ agents, onSend }: Props) {
  const [toAgent, setToAgent] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toAgent || !message.trim()) return;
    setSending(true);
    try {
      await onSend(toAgent, message);
      setMessage("");
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ background: "var(--surface)", borderRadius: 8, border: "1px solid var(--border)", padding: 16 }}>
      <h2 style={{ fontSize: 16, marginBottom: 12 }}>Send Message</h2>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <select value={toAgent} onChange={(e) => setToAgent(e.target.value)}>
          <option value="">Select agent...</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.id})
            </option>
          ))}
        </select>
        <textarea
          rows={3}
          placeholder="Type your message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <button type="submit" className="primary" disabled={sending || !toAgent || !message.trim()}>
          {sending ? "Sending..." : "Send"}
        </button>
      </form>
    </div>
  );
}
