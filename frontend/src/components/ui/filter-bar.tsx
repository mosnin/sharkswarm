"use client";

import { Search, X } from "lucide-react";
import { useState, useEffect, useRef } from "react";

interface FilterOption {
  label: string;
  value: string;
}

interface FilterDef {
  key: string;
  label: string;
  options: FilterOption[];
}

interface FilterBarProps {
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  filters?: FilterDef[];
  filterValues?: Record<string, string>;
  onFilterChange?: (key: string, value: string) => void;
  onClearAll?: () => void;
}

export function FilterBar({
  searchPlaceholder = "Search...",
  searchValue = "",
  onSearchChange,
  filters = [],
  filterValues = {},
  onFilterChange,
  onClearAll,
}: FilterBarProps) {
  const [localSearch, setLocalSearch] = useState(searchValue);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    setLocalSearch(searchValue);
  }, [searchValue]);

  const handleSearchChange = (value: string) => {
    setLocalSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearchChange?.(value);
    }, 300);
  };

  const hasActiveFilters = Object.values(filterValues).some(Boolean) || searchValue;

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      marginBottom: 16,
      flexWrap: "wrap",
    }}>
      {onSearchChange && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "var(--bg)",
          border: "1px solid var(--border)",
          borderRadius: 6,
          padding: "4px 10px",
          minWidth: 240,
          flex: "1 1 240px",
          maxWidth: 360,
        }}>
          <Search size={14} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
          <input
            placeholder={searchPlaceholder}
            value={localSearch}
            onChange={(e) => handleSearchChange(e.target.value)}
            style={{
              background: "none",
              border: "none",
              outline: "none",
              color: "var(--text)",
              fontSize: 13,
              width: "100%",
              padding: "4px 0",
            }}
          />
          {localSearch && (
            <button
              className="ghost"
              onClick={() => handleSearchChange("")}
              style={{ padding: 2, display: "flex" }}
              aria-label="Clear search"
            >
              <X size={12} />
            </button>
          )}
        </div>
      )}

      {filters.map((filter) => (
        <select
          key={filter.key}
          value={filterValues[filter.key] || ""}
          onChange={(e) => onFilterChange?.(filter.key, e.target.value)}
          style={{
            background: filterValues[filter.key] ? "var(--accent-soft)" : "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: "6px 12px",
            fontSize: 13,
            color: filterValues[filter.key] ? "var(--accent)" : "var(--text-secondary)",
            cursor: "pointer",
            minWidth: 120,
          }}
        >
          <option value="">{filter.label}</option>
          {filter.options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      ))}

      {hasActiveFilters && onClearAll && (
        <button
          className="ghost"
          onClick={onClearAll}
          style={{ fontSize: 12, padding: "4px 8px" }}
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
