"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Copy, Check } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { showSuccess, showError } from "@/lib/toast";

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
  const [loading, setLoading] = useState(true);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchMessages = useCallback(async () => {
    try {
      const msgs = await api<Message[]>(`/api/agents/${agentId}/messages`);
      setMessages(msgs);
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    api<AgentInfo>(`/api/agents/${agentId}`)
      .then(setAgent)
      .catch((err) => console.error("Failed to fetch agent info:", err));
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
              if (data.type === "text") {
                accumulated += data.content;
                setStreamingText(accumulated);
              } else if (data.type === "done") {
                // Stream complete
                setStreamingText("");
                await fetchMessages();
              }
            } catch (err) {
              console.error("Failed to parse streaming data:", err);
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
        } catch (err) {
          showError("Failed to send message");
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

  const handleCopy = async (messageId: number, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(messageId);
      showSuccess("Copied!");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      showError("Failed to copy to clipboard");
    }
  };

  const handleNewConversation = async () => {
    await fetch(`${API_URL}/api/agents/${agentId}/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sender: "dashboard" }),
    });
    setMessages([]);
    setShowResetConfirm(false);
  };

  if (loading && !agent) {
    return (
      <div>
        <div style={{ height: 20, width: 200, background: "var(--surface)", borderRadius: 6, marginBottom: 16 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 24 }}>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <div style={{ width: "60%", height: 48, background: "var(--surface)", borderRadius: 12 }} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{ width: "55%", height: 64, background: "var(--surface)", borderRadius: 12 }} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <div style={{ width: "50%", height: 40, background: "var(--surface)", borderRadius: 12 }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 90px)" }}>
      <PageHeader
        title="Chat"
        breadcrumbs={[
          { label: "Agents", href: "/agents" },
          { label: agent?.name || agentId, href: `/agents/${agentId}` },
          { label: "Chat" },
        ]}
      />

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
            onClick={() => setShowResetConfirm(true)}
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
                position: "relative",
              }}>
                {!isUser && (
                  <button
                    onClick={() => handleCopy(m.id, m.content)}
                    style={{
                      position: "absolute", top: 6, right: 6,
                      background: "none", border: "none", padding: 2,
                      cursor: "pointer", color: "var(--text-muted)",
                      opacity: 0.6, lineHeight: 1,
                    }}
                    title="Copy message"
                  >
                    {copiedId === m.id ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                )}
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
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                Thinking<span className="thinking-dots"><span>.</span><span>.</span><span>.</span></span>
              </div>
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

      <ConfirmDialog
        open={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={handleNewConversation}
        title="Start New Conversation?"
        message="This will clear the current conversation history. This action cannot be undone."
        confirmLabel="Clear & Start New"
        confirmVariant="danger"
      />

      <style>{`
        @keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0; } }
        .thinking-dots span {
          animation: bounce 1.4s infinite;
          display: inline-block;
        }
        .thinking-dots span:nth-child(2) { animation-delay: 0.2s; }
        .thinking-dots span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}
