"use client";

import { motion } from "motion/react";

const GRID_SIZE = 60;
const COLS = 21;
const ROWS = 15;

const colors = [
  "rgba(233, 30, 140, 0.35)", // magenta
  "rgba(0, 180, 255, 0.35)",  // cyan
  "rgba(255, 229, 0, 0.25)",  // yellow
];

// Deterministic "random" based on index
function seeded(i: number) {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// Pre-compute which intersections get a dot glow
const glowDots = Array.from({ length: 14 }, (_, i) => {
  const col = Math.floor(seeded(i * 3) * COLS);
  const row = Math.floor(seeded(i * 3 + 1) * ROWS);
  const colorIndex = Math.floor(seeded(i * 3 + 2) * colors.length);
  return {
    id: i,
    x: col * GRID_SIZE,
    y: row * GRID_SIZE,
    color: colors[colorIndex],
    delay: seeded(i * 7) * 6,
    duration: 3 + seeded(i * 11) * 4,
  };
});

export function AnimatedGridBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Static grid lines */}
      <svg
        className="absolute inset-0 w-full h-full"
        style={{
          maskImage: "radial-gradient(ellipse at center, black 15%, transparent 65%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 15%, transparent 65%)",
        }}
      >
        <defs>
          <pattern id="hero-grid" width={GRID_SIZE} height={GRID_SIZE} patternUnits="userSpaceOnUse">
            <path
              d={`M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}`}
              fill="none"
              stroke="rgba(255,255,255,0.04)"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hero-grid)" />
      </svg>

      {/* Animated glow dots at intersections */}
      {glowDots.map((dot) => (
        <motion.div
          key={dot.id}
          className="absolute rounded-full"
          style={{
            left: dot.x,
            top: dot.y,
            width: 4,
            height: 4,
            backgroundColor: dot.color,
            boxShadow: `0 0 12px 4px ${dot.color}`,
            transform: "translate(-50%, -50%)",
            maskImage: "radial-gradient(ellipse at center, black 15%, transparent 65%)",
            WebkitMaskImage: "radial-gradient(ellipse at center, black 15%, transparent 65%)",
          }}
          animate={{
            opacity: [0, 0.8, 0],
            scale: [0.5, 1.2, 0.5],
          }}
          transition={{
            duration: dot.duration,
            repeat: Infinity,
            delay: dot.delay,
            ease: "easeInOut",
          }}
        />
      ))}

      {/* Slow sweeping horizontal line */}
      <motion.div
        className="absolute left-0 w-full h-px"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(233,30,140,0.08) 30%, rgba(0,180,255,0.08) 70%, transparent)",
        }}
        animate={{
          top: ["-5%", "105%"],
        }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: "linear",
        }}
      />
    </div>
  );
}
