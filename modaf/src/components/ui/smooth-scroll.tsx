"use client";

import { useEffect, useRef } from "react";
import Lenis from "lenis";

// Pre-compute 101 colors so we never run parseInt during scroll
const COLORS: string[] = [];
function lerpColor(a: string, b: string, t: number): string {
  const ar = parseInt(a.slice(1, 3), 16);
  const ag = parseInt(a.slice(3, 5), 16);
  const ab = parseInt(a.slice(5, 7), 16);
  const br = parseInt(b.slice(1, 3), 16);
  const bg = parseInt(b.slice(3, 5), 16);
  const bb = parseInt(b.slice(5, 7), 16);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${bl.toString(16).padStart(2, "0")}`;
}
for (let i = 0; i <= 100; i++) {
  const p = i / 100;
  if (p < 0.33) COLORS.push(lerpColor("#E91E8C", "#FFE500", p / 0.33));
  else if (p < 0.66) COLORS.push(lerpColor("#FFE500", "#00B4FF", (p - 0.33) / 0.33));
  else COLORS.push(lerpColor("#00B4FF", "#E91E8C", (p - 0.66) / 0.34));
}

export function SmoothScroll() {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      touchMultiplier: 2,
    });

    lenis.on("scroll", (e: any) => {
      const el = barRef.current;
      if (!el) return;
      const p = Math.max(0, Math.min(1, e.progress as number));
      const idx = Math.round(p * 100);
      const color = COLORS[idx];
      // Use scaleY instead of height to avoid layout thrashing
      el.style.transform = `scaleY(${Math.max(p, 0.005)})`;
      el.style.backgroundColor = color;
      el.style.boxShadow = `0 0 10px ${color}60`;
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);

    return () => lenis.destroy();
  }, []);

  return (
    <div className="fixed top-0 right-0 z-[90] w-1.5 h-full pointer-events-none">
      <div
        ref={barRef}
        className="w-full h-full rounded-full origin-top will-change-transform"
        style={{ transform: "scaleY(0.005)" }}
      />
    </div>
  );
}
