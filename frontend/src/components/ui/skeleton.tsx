"use client";

interface SkeletonProps {
  variant?: "line" | "card" | "row" | "circle" | "stat";
  width?: string | number;
  height?: string | number;
  count?: number;
  className?: string;
}

export function Skeleton({ variant = "line", width, height, count = 1, className = "" }: SkeletonProps) {
  const items = Array.from({ length: count });

  const variantClass = {
    line: "skeleton-line",
    card: "skeleton-card",
    row: "skeleton-row",
    circle: "",
    stat: "",
  }[variant];

  return (
    <>
      {items.map((_, i) => (
        <div
          key={i}
          className={`skeleton ${variantClass} ${className}`}
          style={{
            width: width ?? (variant === "circle" ? 40 : undefined),
            height: height ?? (variant === "circle" ? 40 : variant === "stat" ? 80 : undefined),
            borderRadius: variant === "circle" ? "50%" : undefined,
          }}
        />
      ))}
    </>
  );
}

/** Pre-composed skeleton for stat card grids */
export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="stat-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="stat-card">
          <div className="skeleton skeleton-line" style={{ width: "60%", height: 12 }} />
          <div className="skeleton skeleton-line" style={{ width: "40%", height: 28, marginTop: 8 }} />
          <div className="skeleton skeleton-line" style={{ width: "50%", height: 12, marginTop: 8 }} />
        </div>
      ))}
    </div>
  );
}

/** Pre-composed skeleton for table */
export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i}><div className="skeleton skeleton-line" style={{ width: "70%", height: 12 }} /></th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: cols }).map((_, c) => (
                <td key={c}><div className="skeleton skeleton-line" style={{ width: `${60 + Math.random() * 30}%`, height: 14 }} /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Pre-composed skeleton for card list */
export function CardListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card">
          <div className="skeleton skeleton-line" style={{ width: "40%", height: 16, marginBottom: 12 }} />
          <div className="skeleton skeleton-line" style={{ width: "80%", height: 14 }} />
          <div className="skeleton skeleton-line" style={{ width: "60%", height: 14 }} />
        </div>
      ))}
    </div>
  );
}
