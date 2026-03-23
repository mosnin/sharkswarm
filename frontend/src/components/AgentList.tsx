"use client";

interface Agent {
  id: string;
  name: string;
  status: "online" | "offline";
  model?: string;
  tools?: string[];
}

interface Props {
  agents: Agent[];
  onDelete?: (id: string) => void;
}

export default function AgentList({ agents, onDelete }: Props) {
  return (
    <div style={{ background: "var(--surface)", borderRadius: 8, border: "1px solid var(--border)", padding: 16 }}>
      <h2 style={{ fontSize: 16, marginBottom: 12 }}>Agents ({agents.length})</h2>
      {agents.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No agents found</p>}
      <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
        {agents.map((agent) => (
          <li
            key={agent.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
              background: "var(--bg)",
              borderRadius: 6,
              border: "1px solid var(--border)",
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: agent.status === "online" ? "var(--green)" : "var(--red)",
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{agent.name}</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <a href={`/agents/${agent.id}/chat`} style={{ fontSize: 12 }}>Chat</a>
                  <a href={`/agents/${agent.id}`} style={{ fontSize: 12 }}>Config</a>
                  {onDelete && !["agent-1", "agent-2"].includes(agent.id) && (
                    <button
                      onClick={() => onDelete(agent.id)}
                      style={{ fontSize: 11, padding: "2px 8px", color: "var(--red)", borderColor: "var(--red)" }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{agent.id}</div>
              {agent.model && (
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{agent.model}</div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
