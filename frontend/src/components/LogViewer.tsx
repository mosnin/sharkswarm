"use client";

interface LogEntry {
  id: number;
  agent_id?: string;
  from_agent?: string;
  to_agent?: string;
  level?: string;
  message?: string;
  content?: string;
  created_at: string;
}

const LEVEL_COLORS: Record<string, string> = {
  info: "var(--accent)",
  warn: "var(--yellow)",
  error: "var(--red)",
  debug: "var(--text-muted)",
};

export default function LogViewer({ logs }: { logs: LogEntry[] }) {
  return (
    <div style={{ background: "var(--surface)", borderRadius: 8, border: "1px solid var(--border)", padding: 16 }}>
      <div
        style={{
          maxHeight: 500,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          fontFamily: "monospace",
          fontSize: 13,
        }}
      >
        {logs.length === 0 && <p style={{ color: "var(--text-muted)" }}>No logs yet</p>}
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
              {log.from_agent && log.to_agent ? (
                <span>
                  <span style={{ color: "var(--accent)" }}>{log.from_agent}</span>
                  <span style={{ color: "var(--text-muted)" }}> → </span>
                  <span style={{ color: "var(--green)" }}>{log.to_agent}</span>
                </span>
              ) : (
                <span>
                  <span style={{ color: LEVEL_COLORS[log.level || "info"] || "var(--text-muted)" }}>
                    [{log.level?.toUpperCase() || "INFO"}]
                  </span>{" "}
                  <span style={{ color: "var(--accent)" }}>{log.agent_id}</span>
                </span>
              )}
              <span style={{ color: "var(--text-muted)", fontSize: 11 }}>
                {new Date(log.created_at).toLocaleString()}
              </span>
            </div>
            <div style={{ color: "var(--text)" }}>{log.content || log.message}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
