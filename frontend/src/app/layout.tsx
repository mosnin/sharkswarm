import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NanoClaw Dashboard",
  description: "Multi-agent NanoClaw management dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav
          style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
            padding: "16px 24px",
            borderBottom: "1px solid var(--border)",
            background: "var(--surface)",
          }}
        >
          <strong style={{ fontSize: 18 }}>NanoClaw Dashboard</strong>
          <a href="/">Agents</a>
          <a href="/messages">Messages</a>
          <a href="/integrations">Integrations</a>
          <a href="/logs">Logs</a>
        </nav>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
          {children}
        </div>
      </body>
    </html>
  );
}
