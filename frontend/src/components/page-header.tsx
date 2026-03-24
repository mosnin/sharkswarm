"use client";

import { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  breadcrumbs?: Array<{ label: string; href?: string }>;
}

export function PageHeader({ title, description, action, breadcrumbs }: PageHeaderProps) {
  return (
    <div>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 8, display: "flex", gap: 4, alignItems: "center" }}>
          {breadcrumbs.map((crumb, i) => (
            <span key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {i > 0 && <span>/</span>}
              {crumb.href ? (
                <a href={crumb.href} style={{ color: "var(--text-muted)" }}>{crumb.label}</a>
              ) : (
                <span>{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="page-header">
        <div>
          <h1 className="page-title">{title}</h1>
          {description && <p className="page-description">{description}</p>}
        </div>
        {action && <div className="page-action">{action}</div>}
      </div>
    </div>
  );
}
