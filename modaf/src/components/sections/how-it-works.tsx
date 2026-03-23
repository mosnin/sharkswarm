"use client";

import { useRef, useEffect, useState } from "react";
import { motion, useInView, useMotionValue, useTransform, useScroll, animate } from "motion/react";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { BorderBeam } from "@/components/ui/border-beam";
import { TiltCard } from "@/components/ui/tilt-card";
import { CharReveal } from "@/components/ui/char-reveal";

const phases = [
  {
    phase: "Phase 0-2",
    title: "Discovery & Planning",
    description: "Interactive interview, project docs generation, architecture plan",
    dotColor: "bg-cyan",
    pingColor: "bg-cyan/40",
    borderColor: "border-cyan/20",
    beamFrom: "#00B4FF",
    beamTo: "#00B4FF",
  },
  {
    phase: "Phase 3-4",
    title: "Foundation",
    description: "Next.js setup, database schema, shared utilities, validation gates",
    dotColor: "bg-cyan",
    pingColor: "bg-cyan/40",
    borderColor: "border-cyan/20",
    beamFrom: "#00B4FF",
    beamTo: "#00B4FF",
  },
  {
    phase: "Phase 5-6",
    title: "Auth & Onboarding",
    description: "Login, signup, email verification, multi-step onboarding flow",
    dotColor: "bg-yellow",
    pingColor: "bg-yellow/40",
    borderColor: "border-yellow/20",
    beamFrom: "#FFE500",
    beamTo: "#FFE500",
  },
  {
    phase: "Phase 7-8",
    title: "App Shell & Dashboard",
    description: "Responsive layout, navigation, dashboard with real metrics",
    dotColor: "bg-yellow",
    pingColor: "bg-yellow/40",
    borderColor: "border-yellow/20",
    beamFrom: "#FFE500",
    beamTo: "#FFE500",
  },
  {
    phase: "Phase 9-11",
    title: "Features & Settings",
    description: "Core CRUD, settings, Stripe billing, admin panel",
    dotColor: "bg-magenta",
    pingColor: "bg-magenta/40",
    borderColor: "border-magenta/20",
    beamFrom: "#E91E8C",
    beamTo: "#E91E8C",
  },
  {
    phase: "Phase 12-14",
    title: "Email, Marketing & Polish",
    description: "Email templates, marketing site, edge cases, QA checklist",
    dotColor: "bg-magenta",
    pingColor: "bg-magenta/40",
    borderColor: "border-magenta/20",
    beamFrom: "#E91E8C",
    beamTo: "#E91E8C",
  },
];

function CountUp({ target, suffix = "" }: { target: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const motionVal = useMotionValue(0);
  const rounded = useTransform(motionVal, (v) => Math.round(v));
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    const controls = animate(motionVal, target, {
      duration: 1.6,
      ease: "easeOut",
    });
    const unsub = rounded.on("change", (v) => setDisplay(v));
    return () => {
      controls.stop();
      unsub();
    };
  }, [isInView, target, motionVal, rounded]);

  return (
    <span ref={ref}>
      {display}
      {suffix}
    </span>
  );
}

const stats = [
  { value: 15, suffix: "", label: "Build phases", beamColor: "#00B4FF" },
  { value: 46, suffix: "+", label: "Validation gates", beamColor: "#E91E8C" },
  { value: 9, suffix: "", label: "Project docs generated", beamColor: "#FFE500" },
  { value: 60, suffix: "+", label: "Framework files", beamColor: "#00B4FF" },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 32, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.45, ease: "easeOut" as const },
  },
};

function PhaseDot({ dotColor, pingColor, index }: { dotColor: string; pingColor: string; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-20% 0px" });

  return (
    <div ref={ref} className="relative w-2.5 h-2.5">
      <div className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
      {isInView && (
        <motion.div
          className={`absolute inset-0 rounded-full ${pingColor}`}
          initial={{ scale: 1, opacity: 0.7 }}
          animate={{ scale: 3.5, opacity: 0 }}
          transition={{
            duration: 1,
            delay: index * 0.15,
            ease: "easeOut",
          }}
        />
      )}
    </div>
  );
}

function ScrollTimeline() {
  const timelineRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: timelineRef,
    offset: ["start 80%", "end 20%"],
  });

  const gradientColors = ["#00B4FF", "#00B4FF", "#FFE500", "#FFE500", "#E91E8C", "#E91E8C"];

  return (
    <div
      ref={timelineRef}
      className="absolute left-4 sm:left-6 top-0 bottom-0 w-px hidden lg:block"
      style={{ zIndex: 1 }}
    >
      {/* Track */}
      <div className="absolute inset-0 bg-white/5 rounded-full" />
      {/* Animated fill */}
      <motion.div
        className="absolute top-0 left-0 w-full rounded-full origin-top"
        style={{
          scaleY: scrollYProgress,
          background: `linear-gradient(to bottom, ${gradientColors.join(", ")})`,
          height: "100%",
          boxShadow: "0 0 8px rgba(0, 180, 255, 0.4)",
        }}
      />
    </div>
  );
}

export function HowItWorksSection() {
  const gridRef = useRef<HTMLDivElement>(null);
  const gridInView = useInView(gridRef, { once: true, margin: "-15% 0px" });

  return (
    <section id="how-it-works" className="py-20 md:py-32 px-4 sm:px-6 bg-white/[0.02] overflow-hidden">
      <div className="mx-auto max-w-5xl w-full">
        <ScrollReveal>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-cyan mb-2">
            How It Works
          </p>
          <h2 className="text-3xl sm:text-4xl md:text-[44px] font-bold leading-tight">
            <CharReveal text="14 phases from idea" />
            <br />
            <span className="text-cyan">
              <CharReveal text="to production" delay={0.5} />
            </span>
          </h2>
          <p className="mt-4 text-lg text-white/50 max-w-xl">
            MODAF guides your AI agent through a structured, phased build
            process. Each phase reads only the files it needs, builds,
            validates, and waits for your approval before continuing.
          </p>
        </ScrollReveal>

        {/* Stats band */}
        <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat, i) => (
            <ScrollReveal key={stat.label} delay={i * 0.08}>
              <div className="relative overflow-hidden text-center py-6 px-4 rounded-xl border border-white/10 bg-white/[0.02]">
                <div className="text-3xl md:text-4xl font-bold text-white">
                  <CountUp target={stat.value} suffix={stat.suffix} />
                </div>
                <div className="text-sm text-white/40 mt-1">{stat.label}</div>
                <BorderBeam
                  size={60}
                  duration={12}
                  delay={i * 2}
                  colorFrom={stat.beamColor}
                  colorTo={stat.beamColor}
                  borderWidth={1}
                />
              </div>
            </ScrollReveal>
          ))}
        </div>

        {/* Phase cards grid */}
        <div className="relative">
          <ScrollTimeline />
          <motion.div
            ref={gridRef}
            variants={containerVariants}
            initial="hidden"
            animate={gridInView ? "visible" : "hidden"}
            className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:pl-10"
          >
          {phases.map((phase, i) => (
            <motion.div key={phase.phase} variants={cardVariants}>
              <TiltCard className="h-full">
                <div className={`relative overflow-hidden rounded-2xl border ${phase.borderColor} bg-white/[0.02] p-5 sm:p-6 h-full hover:bg-white/[0.04] transition-colors duration-300`}>
                  {/* Phase dot + label */}
                  <div className="flex items-center gap-3 mb-3">
                    <PhaseDot dotColor={phase.dotColor} pingColor={phase.pingColor} index={i} />
                    <span className="text-xs font-mono font-bold text-white/40">
                      {phase.phase}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-1.5">
                    {phase.title}
                  </h3>
                  <p className="text-sm text-white/40 leading-relaxed">
                    {phase.description}
                  </p>
                  <BorderBeam
                    size={80}
                    duration={14}
                    delay={i * 1.5}
                    colorFrom={phase.beamFrom}
                    colorTo={phase.beamTo}
                    borderWidth={1}
                  />
                </div>
              </TiltCard>
            </motion.div>
          ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
