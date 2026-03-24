"use client";

import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
      }}
    >
      <div style={{ display: "flex", gap: 64, alignItems: "center", maxWidth: 960, width: "100%", padding: "0 24px" }}>
        <div style={{ flex: 1 }}>
          <SignUp
            appearance={{
              elements: {
                rootBox: { width: "100%" },
                card: {
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  boxShadow: "0 4px 24px rgba(0,0,0,0.2)",
                },
              },
            }}
          />
        </div>
        <div
          className="auth-hero"
          style={{
            flex: 1,
            textAlign: "center",
            padding: 40,
          }}
        >
          <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 16, color: "var(--text)" }}>
            Get Started
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: 16, lineHeight: 1.6 }}>
            Create your workspace and start orchestrating agent swarms in minutes.
          </p>
        </div>
      </div>
    </div>
  );
}
