"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";

interface CharRevealProps {
  text: string;
  className?: string;
  delay?: number;
}

export function CharReveal({ text, className, delay = 0 }: CharRevealProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-15% 0px" });

  return (
    <span ref={ref} className={className} aria-label={text}>
      {text.split("").map((char, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
          animate={
            isInView
              ? { opacity: 1, y: 0, filter: "blur(0px)" }
              : { opacity: 0, y: 20, filter: "blur(8px)" }
          }
          transition={{
            duration: 0.4,
            delay: delay + i * 0.03,
            ease: "easeOut",
          }}
          className="inline-block"
          style={{ whiteSpace: char === " " ? "pre" : undefined }}
          aria-hidden
        >
          {char === " " ? "\u00A0" : char}
        </motion.span>
      ))}
    </span>
  );
}
