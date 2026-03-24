"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Bot,
  Target,
  MessageSquare,
  Cpu,
  Zap,
  Calendar,
  CheckSquare,
  Mail,
  Plug,
  Settings,
  Activity,
  FileText,
  LayoutDashboard,
  Users,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  section?: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, section: "Overview" },
  { href: "/agents", label: "Agents", icon: Bot, section: "Orchestration" },
  { href: "/missions", label: "Missions", icon: Target, section: "Orchestration" },
  { href: "/tasks", label: "Tasks", icon: CheckSquare, section: "Orchestration" },
  { href: "/channels", label: "Channels", icon: MessageSquare, section: "Communication" },
  { href: "/messages", label: "Messages", icon: Mail, section: "Communication" },
  { href: "/models", label: "Models", icon: Cpu, section: "Configuration" },
  { href: "/skills", label: "Skills", icon: Zap, section: "Configuration" },
  { href: "/integrations", label: "Integrations", icon: Plug, section: "Configuration" },
  { href: "/schedules", label: "Schedules", icon: Calendar, section: "Configuration" },
  { href: "/health", label: "Health", icon: Activity, section: "System" },
  { href: "/logs", label: "Logs", icon: FileText, section: "System" },
  { href: "/settings", label: "Settings", icon: Settings, section: "System" },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const sections = NAV_ITEMS.reduce<Record<string, NavItem[]>>((acc, item) => {
    const section = item.section || "Other";
    if (!acc[section]) acc[section] = [];
    acc[section].push(item);
    return acc;
  }, {});

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard" || pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <aside className={`sidebar ${collapsed ? "sidebar-collapsed" : ""}`}>
      <div className="sidebar-header">
        {!collapsed && (
          <Link href="/" className="sidebar-brand">
            <span className="sidebar-logo">S</span>
            <span>SharkSwarm</span>
          </Link>
        )}
        <button
          className="sidebar-toggle"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <nav className="sidebar-nav">
        {Object.entries(sections).map(([section, items]) => (
          <div key={section} className="sidebar-section">
            {!collapsed && <span className="sidebar-section-label">{section}</span>}
            {items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`sidebar-link ${active ? "sidebar-link-active" : ""}`}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon size={18} />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard" || pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <>
      <button className="mobile-menu-btn" onClick={() => setOpen(true)} aria-label="Open menu">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <>
          <div className="mobile-overlay" onClick={() => setOpen(false)} />
          <div className="mobile-drawer">
            <div className="mobile-drawer-header">
              <span className="sidebar-brand">
                <span className="sidebar-logo">S</span>
                <span>SharkSwarm</span>
              </span>
              <button onClick={() => setOpen(false)} aria-label="Close menu">
                &times;
              </button>
            </div>
            <nav className="sidebar-nav">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`sidebar-link ${active ? "sidebar-link-active" : ""}`}
                    onClick={() => setOpen(false)}
                  >
                    <Icon size={18} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </>
      )}
    </>
  );
}
