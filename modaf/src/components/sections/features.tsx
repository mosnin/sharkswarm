"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { BorderBeam } from "@/components/ui/border-beam";
import { TiltCard } from "@/components/ui/tilt-card";
import { CharReveal } from "@/components/ui/char-reveal";

const features = [
  {
    tag: "Navigation",
    title: "Quick Start & Glossary",
    description:
      "QUICK_START.md is a task-to-file decision tree so you never read the wrong doc. GLOSSARY.md defines every framework term. MANIFEST.md maps every file in one glance.",
    color: "cyan" as const,
  },
  {
    tag: "Resilience",
    title: "Doctor Mode",
    description:
      "A structural linter that scans your generated codebase for broken references, missing files, and doc drift — then tells you exactly what to fix.",
    color: "magenta" as const,
  },
  {
    tag: "Resilience",
    title: "Error Recovery",
    description:
      "Phase re-run protocol. When a build step fails, MODAF provides a structured recovery path to diagnose, fix, and re-validate without starting over.",
    color: "magenta" as const,
  },
  {
    tag: "Flexibility",
    title: "Escape Hatches",
    description:
      "Swap any default technology — replace Stripe with Lemon Squeezy, Auth.js with Clerk, PostgreSQL with MySQL. Documented swap guides eliminate lock-in concerns.",
    color: "yellow" as const,
  },
  {
    tag: "Drift Prevention",
    title: "Pattern Snapshot",
    description:
      "Captures your code conventions after Phase 7 and enforces them across all future phases and agent sessions — preventing style drift at scale.",
    color: "cyan" as const,
  },
  {
    tag: "Build Guide",
    title: "Implementation Recipes",
    description:
      "Phase 9 includes step-by-step feature build recipes so your agent follows a repeatable, validated workflow for every CRUD feature it creates.",
    color: "yellow" as const,
  },
  {
    tag: "Quality",
    title: "Observability & Performance",
    description:
      "Built-in guidance for logging, health checks, Core Web Vitals targets, and bundle budgets — production-grade standards from day one.",
    color: "cyan" as const,
  },
  {
    tag: "Quality",
    title: "Accessibility",
    description:
      "WCAG 2.1 AA compliance baked into component specs and validation gates. Keyboard navigation, screen reader support, and contrast ratios are checked, not optional.",
    color: "magenta" as const,
  },
];

const colorMap = {
  cyan: {
    tag: "text-cyan bg-cyan/10 border-cyan/20",
    border: "border-cyan/20",
    beam: "#00B4FF",
  },
  magenta: {
    tag: "text-magenta bg-magenta/10 border-magenta/20",
    border: "border-magenta/20",
    beam: "#E91E8C",
  },
  yellow: {
    tag: "text-yellow bg-yellow/10 border-yellow/20",
    border: "border-yellow/20",
    beam: "#FFE500",
  },
};

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 32, scale: 0.95, rotateX: 4 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    rotateX: 0,
    transition: { duration: 0.5, ease: "easeOut" as const },
  },
};

function StaggeredGrid({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-15% 0px" });

  return (
    <motion.div
      ref={ref}
      variants={containerVariants}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      className="mt-16 grid gap-4 sm:grid-cols-2"
      style={{ perspective: 800 }}
    >
      {children}
    </motion.div>
  );
}

export function FeaturesSection() {
  return (
    <section
      id="features"
      className="py-20 md:py-32 px-4 sm:px-6 bg-white/[0.02] overflow-hidden"
    >
      <div className="mx-auto max-w-5xl w-full">
        <ScrollReveal>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-magenta mb-2">
            v1.11 Features
          </p>
          <h2 className="text-3xl sm:text-4xl md:text-[44px] font-bold leading-tight">
            <CharReveal text="Built to be" />
            <br />
            <span className="text-magenta">
              <CharReveal text="resilient" delay={0.35} />
            </span>
          </h2>
          <p className="mt-4 text-lg text-white/50 max-w-xl">
            Self-healing diagnostics, technology escape hatches, drift
            prevention, and a navigation layer that makes 60+ files instantly
            usable. MODAF doesn&apos;t just build — it recovers, adapts, and
            enforces quality.
          </p>
        </ScrollReveal>

        <StaggeredGrid>
          {features.map((feature, i) => {
            const c = colorMap[feature.color];
            return (
              <motion.div
                key={feature.title}
                variants={cardVariants}
              >
                <TiltCard className="h-full">
                  <div
                    className={`relative overflow-hidden rounded-2xl border ${c.border} bg-white/[0.02] p-5 sm:p-6 h-full hover:bg-white/[0.04] transition-colors duration-300`}
                  >
                    <span
                      className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border mb-3 ${c.tag}`}
                    >
                      {feature.tag}
                    </span>
                    <h3 className="text-lg font-semibold text-white mb-1.5">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-white/40 leading-relaxed">
                      {feature.description}
                    </p>
                    <BorderBeam
                      size={80}
                      duration={14}
                      delay={i * 1.5}
                      colorFrom={c.beam}
                      colorTo={c.beam}
                      borderWidth={1}
                    />
                  </div>
                </TiltCard>
              </motion.div>
            );
          })}
        </StaggeredGrid>
      </div>
    </section>
  );
}
