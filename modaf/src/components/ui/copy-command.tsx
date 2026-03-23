"use client";

import { useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Copy01Icon, CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";
import confetti from "canvas-confetti";

interface CopyCommandProps {
  command: string;
}

export function CopyCommand({ command }: CopyCommandProps) {
  const [copied, setCopied] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);

    // Burst confetti from the button
    const btn = btnRef.current;
    if (btn) {
      const rect = btn.getBoundingClientRect();
      const x = (rect.left + rect.width / 2) / window.innerWidth;
      const y = (rect.top + rect.height / 2) / window.innerHeight;
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { x, y },
        colors: ["#E91E8C", "#FFE500", "#00B4FF", "#ffffff"],
        ticks: 120,
        gravity: 1.2,
        scalar: 0.9,
        shapes: ["circle", "square"],
        disableForReducedMotion: true,
      });
    }
  };

  return (
    <div className="flex items-center gap-0 rounded-xl border border-white/10 bg-white/5 overflow-hidden w-full min-w-0">
      <code className="flex-1 px-3 sm:px-4 py-3 text-xs sm:text-sm md:text-base font-mono text-cyan overflow-x-auto overflow-y-hidden whitespace-nowrap min-w-0 scrollbar-none">
        {command}
      </code>
      <button
        ref={btnRef}
        onClick={handleCopy}
        className="flex-shrink-0 px-4 py-3 border-l border-white/10 text-white/40 hover:text-white hover:bg-white/5 transition-colors duration-150"
        aria-label={copied ? "Copied" : "Copy to clipboard"}
      >
        <HugeiconsIcon
          icon={copied ? CheckmarkCircle02Icon : Copy01Icon}
          size={18}
          className={copied ? "text-green-400" : ""}
        />
      </button>
    </div>
  );
}
