"use client";

import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { BorderBeam } from "@/components/ui/border-beam";
import { TypingCycle } from "@/components/ui/typing-cycle";
import { CharReveal } from "@/components/ui/char-reveal";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Idea01Icon,
  CommandLineIcon,
  AiBrain01Icon,
} from "@hugeicons/core-free-icons";

const steps = [
  {
    number: "01",
    icon: Idea01Icon,
    color: "text-yellow",
    shineColor: "#FFE500",
    beamFrom: "#FFE500",
    beamTo: "#E91E8C",
    title: "Describe your idea",
    description:
      "Tell your AI coding agent what you want to build. MODAF's phased discovery process will ask targeted questions to understand your users, core features, and v1 scope, then generate complete project documentation automatically.",
  },
  {
    number: "02",
    icon: CommandLineIcon,
    color: "text-cyan",
    shineColor: "#00B4FF",
    beamFrom: "#00B4FF",
    beamTo: "#FFE500",
    title: "Clone the framework",
    description:
      "Add MODAF to your project with a single command. The framework installs as structured documentation inside your repo. No runtime dependencies, no lock-in.",
  },
  {
    number: "03",
    icon: AiBrain01Icon,
    color: "text-magenta",
    shineColor: "#E91E8C",
    beamFrom: "#E91E8C",
    beamTo: "#00B4FF",
    title: "MODAF goes to work",
    description:
      "Your AI agent reads the framework docs and begins building phase by phase. From database schema to auth flows, dashboard to marketing site, MODAF guides every decision with battle-tested patterns and validation gates.",
  },
];

const cycleWords = [
  "web application",
  "web3 app",
  "social network",
  "b2b marketplace",
];

export function GetStartedSection() {
  return (
    <section id="get-started" className="py-20 md:py-32 px-4 sm:px-6 overflow-hidden">
      <div className="mx-auto max-w-5xl w-full">
        <ScrollReveal>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-magenta mb-2">
            Get Started
          </p>
          <h2 className="text-3xl sm:text-4xl md:text-[44px] font-bold leading-tight">
            <CharReveal text="Three steps to your" />
            <br />
            <span className="text-gradient-modaf">
              next <TypingCycle words={cycleWords} />
            </span>
          </h2>
          <p className="mt-4 text-lg text-white/50 max-w-xl">
            MODAF turns your AI coding agent into a senior architect. No
            boilerplate. No guesswork. Just structured, phased execution.
          </p>
        </ScrollReveal>

        <div className="mt-10 sm:mt-16 grid gap-4 sm:gap-8 md:gap-6">
          {steps.map((step, i) => (
            <ScrollReveal key={step.number} delay={i * 0.1}>
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
                <div className="p-4 sm:p-6 md:p-8">
                  <div className="flex flex-col md:flex-row md:items-start gap-3 sm:gap-4 md:gap-6">
                    <div
                      className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl border border-white/10 bg-white/[0.03] flex-shrink-0"
                    >
                      <HugeiconsIcon
                        icon={step.icon}
                        size={20}
                        className={step.color}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 sm:gap-3 mb-1.5 sm:mb-2">
                        <span
                          className={`text-xs font-mono font-bold ${step.color}`}
                        >
                          {step.number}
                        </span>
                        <h3 className="text-lg sm:text-xl font-semibold text-white">
                          {step.title}
                        </h3>
                      </div>
                      <p className="text-sm sm:text-base text-white/50 leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </div>
                <BorderBeam
                  size={100}
                  duration={14}
                  delay={i * 2}
                  colorFrom={step.beamFrom}
                  colorTo={step.beamTo}
                  borderWidth={1}
                />
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
