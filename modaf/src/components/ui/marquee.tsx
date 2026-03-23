import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface MarqueeProps {
  children: ReactNode;
  reverse?: boolean;
  className?: string;
}

export function Marquee({ children, reverse, className }: MarqueeProps) {
  return (
    <div className={cn("relative overflow-hidden marquee-container", className)}>
      <div
        className={cn(
          "flex w-max gap-4",
          reverse ? "animate-marquee-reverse" : "animate-marquee"
        )}
      >
        {children}
        {children}
        {children}
        {children}
      </div>
    </div>
  );
}
