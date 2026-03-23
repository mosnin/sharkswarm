import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type ShineBorderProps = {
  children: ReactNode;
  className?: string;
  borderWidth?: number;
  duration?: number;
  color?: string;
};

export function ShineBorder({
  children,
  className,
  borderWidth = 1,
  duration = 6,
  color = "#E91E8C",
}: ShineBorderProps) {
  return (
    <div
      className={cn("relative rounded-xl sm:rounded-2xl", className)}
      style={{ padding: borderWidth }}
    >
      {/* Solid base border */}
      <div
        className="absolute inset-0 rounded-[inherit]"
        style={{ background: `${color}25` }}
      />
      {/* Animated shine sweep */}
      <div className="absolute inset-0 rounded-[inherit] overflow-hidden">
        <div
          className="absolute -inset-full animate-spin"
          style={{
            animationDuration: `${duration}s`,
            background: `conic-gradient(from 0deg, transparent 60%, ${color} 78%, ${color} 82%, transparent 100%)`,
          }}
        />
      </div>
      {/* Content layer */}
      <div className="relative rounded-[inherit] bg-black">
        {children}
      </div>
    </div>
  );
}
