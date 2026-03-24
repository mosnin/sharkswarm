"use client";

import { useEffect, useRef, ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  size?: "sm" | "md" | "lg";
  children: ReactNode;
  footer?: ReactNode;
}

const SIZES = { sm: 400, md: 560, lg: 720 };

export function Modal({ open, onClose, title, size = "md", children, footer }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      onClick={(e) => e.target === overlayRef.current && onClose()}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 16,
      }}
    >
      <div
        style={{
          background: "var(--surface-raised)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          width: "100%",
          maxWidth: SIZES[size],
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 20px",
          borderBottom: "1px solid var(--border)",
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>{title}</h2>
          <button
            onClick={onClose}
            className="ghost"
            style={{ padding: "4px 8px", fontSize: 18, lineHeight: 1 }}
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 12,
            padding: "12px 20px",
            borderTop: "1px solid var(--border)",
          }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
