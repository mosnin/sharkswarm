"use client";

interface LogEntry {
  id: number;
  from_agent: string;
  to_agent: string;
  content: string;
  created_at: string;
}

export default function LogViewer({ logs }: { logs: LogEntry[] }) {
  return (
    <div style={{ background: "var(--surface)", borderRadius: 8, border: "1px solid var(--border)", padding: 16 }}>
      <h2 style={{ fontSize: 16, marginBottom: 12 }}>Message Log</h2>
      <div
        style={{
          maxHeight: 400,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          fontFamily: "monospace",
          fontSize: 13,
        }}
      >
        {logs.length === 0 && <p style={{ color: "var(--text-muted)" }}>No messages yet</p>}
        {logs.map((log) => (
          <div
            key={log.id}
            style={{
              padding: "8px 10px",
              background: "var(--bg)",
              borderRadius: 4,
              border: "1px solid var(--border)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span>
                <span style={{ color: "var(--accent)" }}>{log.from_agent}</span>
                <span style={{ color: "var(--text-muted)" }}> → </span>
                <span style={{ color: "var(--green)" }}>{log.to_agent}</span>
              </span>
              <span style={{ color: "var(--text-muted)", fontSize: 11 }}>
                {new Date(log.created_at).toLocaleString()}
              </span>
            </div>
            <div style={{ color: "var(--text)" }}>{log.content}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
