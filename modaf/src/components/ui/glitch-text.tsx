"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface GlitchTextProps {
  children: string;
  className?: string;
  as?: "span" | "h1" | "h2" | "h3" | "p";
}

export function GlitchText({ children, className, as: Tag = "span" }: GlitchTextProps) {
  const [glitching, setGlitching] = useState(false);

  return (
    <Tag
      className={cn("relative inline-block cursor-default", className)}
      onMouseEnter={() => setGlitching(true)}
      onMouseLeave={() => setGlitching(false)}
    >
      <span className="relative z-10">{children}</span>
      {glitching && (
        <>
          <span
            className="absolute inset-0 z-20 animate-glitch-1"
            style={{ color: "#00B4FF", clipPath: "inset(20% 0 40% 0)" }}
            aria-hidden
          >
            {children}
          </span>
          <span
            className="absolute inset-0 z-20 animate-glitch-2"
            style={{ color: "#E91E8C", clipPath: "inset(60% 0 10% 0)" }}
            aria-hidden
          >
            {children}
          </span>
        </>
      )}
    </Tag>
  );
}
