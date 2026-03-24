"use client";

import { Toaster } from "sonner";

export function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      richColors
      duration={5000}
      closeButton
      toastOptions={{
        style: {
          background: 'var(--surface-raised)',
          border: '1px solid var(--border)',
          color: 'var(--text)',
        },
      }}
    />
  );
}
