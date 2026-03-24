"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface Message {
  id: number;
  from_agent: string;
  to_agent: string;
  content: string;
  created_at: string;
}

interface AgentInfo {
  id: string;
  name: string;
  status: "online" | "offline";
  model: string;
}

export default function AgentChatPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params.id as string;

  const [agent, setAgent] = useState<AgentInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [useStreaming, setUseStreaming] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchMessages = useCallback(async () => {
    try {
      const msgs = await api<Message[]>(`/api/agents/${agentId}/messages`);
      setMessages(msgs);
    } catch {
      // ignore
    }
  }, [agentId]);

  useEffect(() => {
    api<AgentInfo>(`/api/agents/${agentId}`)
      .then(setAgent)
      .catch(() => {});
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [agentId, fetchMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  const handleSendStreaming = async () => {
    if (!input.trim() || sending) return;
    const msg = input.trim();
    setSending(true);
    setInput("");
    setStreamingText("");

    try {
      abortRef.current = new AbortController();
      const res = await fetch(`${API_URL}/api/agents/${agentId}/chat/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) {
        // Fallback to regular send
        await api("/api/send-message", {
          method: "POST",
          body: JSON.stringify({ to_agent: agentId, message: msg }),
        });
        await fetchMessages();
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              // Extract text content from various event formats
              if (data.params?.text) {
                accumulated += data.params.text;
                setStreamingText(accumulated);
              } else if (data.params?.content) {
                accumulated += data.params.content;
                setStreamingText(accumulated);
              } else if (data.params?.delta) {
                accumulated += data.params.delta;
                setStreamingText(accumulated);
              } else if (data.type === "done") {
                // Stream complete
                setStreamingText("");
                await fetchMessages();
              }
            } catch {
              // ignore parse errors
            }
          }
        }
      }

      setStreamingText("");
      await fetchMessages();
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        // Fallback: send as regular message
        try {
          await api("/api/send-message", {
            method: "POST",
            body: JSON.stringify({ to_agent: agentId, message: msg }),
          });
          await fetchMessages();
        } catch {
          // ignore
        }
      }
    } finally {
      setSending(false);
      setStreamingText("");
      abortRef.current = null;
      textareaRef.current?.focus();
    }
  };

  const handleSendRegular = async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    try {
      await api("/api/send-message", {
        method: "POST",
        body: JSON.stringify({ to_agent: agentId, message: input.trim() }),
      });
      setInput("");
      await fetchMessages();
      textareaRef.current?.focus();
    } finally {
      setSending(false);
    }
  };

  const handleSend = useStreaming ? handleSendStreaming : handleSendRegular;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleAbort = () => {
    abortRef.current?.abort();
    setSending(false);
    setStreamingText("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 90px)" }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "12px 0", borderBottom: "1px solid var(--border)", marginBottom: 12,
      }}>
        <button onClick={() => router.push("/")}>← Back</button>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%",
            background: agent?.status === "online" ? "var(--green)" : "var(--red)",
          }} />
          <strong style={{ fontSize: 16 }}>{agent?.name || agentId}</strong>
        </div>
        {agent?.model && (
          <span style={{ fontSize: 11, color: "var(--text-muted)", padding: "2px 8px", borderRadius: 10, background: "var(--bg)", border: "1px solid var(--border)" }}>
            {agent.model}
          </span>
        )}
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <label style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={useStreaming}
              onChange={(e) => setUseStreaming(e.target.checked)}
              style={{ width: "auto" }}
            />
            Stream
          </label>
          <button
            onClick={async () => {
              await fetch(`${API_URL}/api/agents/${agentId}/reset`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sender: "dashboard" }),
              });
              setMessages([]);
            }}
            style={{ fontSize: 12 }}
          >
            New Conversation
          </button>
          <button onClick={() => router.push(`/agents/${agentId}`)} style={{ fontSize: 12 }}>
            Config
          </button>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, padding: "8px 0" }}>
        {messages.length === 0 && !streamingText && (
          <p style={{ color: "var(--text-muted)", textAlign: "center", marginTop: 40 }}>
            No messages yet. Send a message to start chatting with {agent?.name || "this agent"}.
          </p>
        )}
        {messages.map((m) => {
          const isUser = m.from_agent === "dashboard";
          return (
            <div key={m.id} style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start" }}>
              <div style={{
                maxWidth: "70%", padding: "10px 14px", borderRadius: 12,
                background: isUser ? "var(--accent)" : "var(--surface)",
                border: isUser ? "none" : "1px solid var(--border)",
                color: isUser ? "#fff" : "var(--text)",
              }}>
                <div style={{ fontSize: 13, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.content}</div>
                <div style={{ fontSize: 10, marginTop: 4, opacity: 0.6, textAlign: isUser ? "right" : "left" }}>
                  {new Date(m.created_at).toLocaleTimeString()}
                </div>
              </div>
            </div>
          );
        })}

        {/* Streaming indicator */}
        {streamingText && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{
              maxWidth: "70%", padding: "10px 14px", borderRadius: 12,
              background: "var(--surface)", border: "1px solid var(--accent)",
              color: "var(--text)",
            }}>
              <div style={{ fontSize: 13, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {streamingText}
                <span style={{ animation: "blink 1s infinite", color: "var(--accent)" }}>|</span>
              </div>
            </div>
          </div>
        )}

        {sending && !streamingText && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{
              padding: "10px 14px", borderRadius: 12,
              background: "var(--surface)", border: "1px solid var(--border)",
            }}>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Thinking...</div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ display: "flex", gap: 8, padding: "12px 0", borderTop: "1px solid var(--border)" }}>
        <textarea
          ref={textareaRef}
          rows={2}
          placeholder={`Message ${agent?.name || agentId}... (Enter to send, Shift+Enter for newline)`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{ flex: 1, resize: "none" }}
          disabled={sending}
        />
        {sending ? (
          <button
            onClick={handleAbort}
            style={{ alignSelf: "flex-end", padding: "8px 20px", color: "var(--red)", borderColor: "var(--red)" }}
          >
            Stop
          </button>
        ) : (
          <button
            className="primary"
            onClick={handleSend}
            disabled={!input.trim()}
            style={{ alignSelf: "flex-end", padding: "8px 20px" }}
          >
            Send
          </button>
        )}
      </div>

      <style>{`@keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0; } }`}</style>
    </div>
  );
}
