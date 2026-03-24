"use client";

import { Modal } from "./modal";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmVariant?: "danger" | "primary";
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  confirmVariant = "danger",
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button onClick={onClose} disabled={loading}>Cancel</button>
          <button
            className={confirmVariant === "danger" ? "danger" : "primary"}
            onClick={() => {
              onConfirm();
            }}
            disabled={loading}
            style={confirmVariant === "danger" ? {
              background: "var(--red)",
              borderColor: "var(--red)",
              color: "#fff",
            } : undefined}
          >
            {loading ? "..." : confirmLabel}
          </button>
        </>
      }
    >
      <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6 }}>
        {message}
      </p>
    </Modal>
  );
}
