"use client";

import { UserButton } from "@clerk/nextjs";
import { ThemeToggle } from "./ThemeProvider";
import { MobileNav } from "./sidebar";
import { Bell, Search } from "lucide-react";
import { useState } from "react";

export function Topbar() {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <header className="topbar">
      <div className="topbar-left">
        <MobileNav />
        {searchOpen ? (
          <div className="topbar-search">
            <Search size={16} />
            <input
              autoFocus
              placeholder="Search agents, missions, logs..."
              onBlur={() => setSearchOpen(false)}
              onKeyDown={(e) => e.key === "Escape" && setSearchOpen(false)}
            />
          </div>
        ) : (
          <button
            className="topbar-icon-btn"
            onClick={() => setSearchOpen(true)}
            aria-label="Search"
          >
            <Search size={18} />
          </button>
        )}
      </div>

      <div className="topbar-right">
        <ThemeToggle />
        <button className="topbar-icon-btn" aria-label="Notifications">
          <Bell size={18} />
        </button>
        <UserButton
          appearance={{
            elements: {
              avatarBox: { width: 32, height: 32 },
            },
          }}
        />
      </div>
    </header>
  );
}
