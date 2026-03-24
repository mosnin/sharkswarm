import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import NavThemeToggle from "@/components/NavThemeToggle";

export const metadata: Metadata = {
  title: "SharkSwarm Dashboard",
  description: "Multi-agent OpenClaw management dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <nav className="nav-bar">
            <strong style={{ fontSize: 18, flexShrink: 0 }}>SharkSwarm</strong>
            <div className="nav-links">
              <a href="/">Agents</a>
              <a href="/channels">Channels</a>
              <a href="/models">Models</a>
              <a href="/skills">Skills</a>
              <a href="/schedules">Schedules</a>
              <a href="/tasks">Tasks</a>
              <a href="/messages">Messages</a>
              <a href="/integrations">Integrations</a>
              <a href="/settings">Settings</a>
              <a href="/health">Health</a>
              <a href="/logs">Logs</a>
            </div>
            <NavThemeToggle />
          </nav>
          <div style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
            {children}
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
