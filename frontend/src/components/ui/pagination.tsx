"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 8,
      marginTop: 16,
    }}>
      <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
        Page {page} of {totalPages}
      </span>
      <button
        className="ghost"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        style={{ padding: "4px 8px", display: "flex", alignItems: "center" }}
        aria-label="Previous page"
      >
        <ChevronLeft size={16} />
      </button>
      <button
        className="ghost"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        style={{ padding: "4px 8px", display: "flex", alignItems: "center" }}
        aria-label="Next page"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
