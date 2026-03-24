"use client";

import { AlertCircle } from "lucide-react";

interface ErrorBlockProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorBlock({ title = "Something went wrong", message, onRetry }: ErrorBlockProps) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "48px 24px",
      textAlign: "center",
      maxWidth: 400,
      margin: "0 auto",
    }}>
      <AlertCircle size={40} style={{ color: "var(--red)", marginBottom: 16 }} />
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{title}</h3>
      <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 20 }}>{message}</p>
      {onRetry && (
        <button className="primary" onClick={onRetry}>
          Try Again
        </button>
      )}
    </div>
  );
}
