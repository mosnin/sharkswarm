"use client";

interface Agent {
  id: string;
  name: string;
  url: string;
  status: "online" | "offline";
}

export default function AgentList({ agents }: { agents: Agent[] }) {
  return (
    <div style={{ background: "var(--surface)", borderRadius: 8, border: "1px solid var(--border)", padding: 16 }}>
      <h2 style={{ fontSize: 16, marginBottom: 12 }}>Agents</h2>
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
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{agent.name}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{agent.id}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
