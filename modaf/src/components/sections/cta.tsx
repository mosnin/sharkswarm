"use client";

import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { CopyCommand } from "@/components/ui/copy-command";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { GlitchText } from "@/components/ui/glitch-text";

export function CTASection() {
  return (
    <section className="py-20 md:py-32 px-4 sm:px-6 bg-white/[0.02] overflow-hidden">
      <div className="mx-auto max-w-3xl w-full text-center">
        <ScrollReveal>
          <h2 className="text-3xl sm:text-4xl md:text-[44px] font-bold leading-tight">
            <GlitchText>Ready to build?</GlitchText>
          </h2>
          <p className="mt-4 text-lg text-white/50">
            Clone the framework, describe your idea, and let your AI agent
            handle the rest.
          </p>
        </ScrollReveal>

        <ScrollReveal delay={0.1}>
          <div className="mt-8 flex justify-center">
            <CopyCommand command="git clone https://github.com/mosnin/LoxSammy docs/framework" />
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.2}>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <MagneticButton
              href="https://github.com/mosnin/LoxSammy"
              target="_blank"
              rel="noopener noreferrer"
              className="glow-button inline-flex items-center justify-center h-[48px] sm:h-[52px] px-6 sm:px-8 text-sm sm:text-base font-semibold rounded-full text-white transition-all duration-150 hover:scale-[1.02]"
            >
              <span className="relative z-10">View on GitHub</span>
            </MagneticButton>
          </div>
          <p className="mt-4 text-sm text-white/30">
            Free and open source. No account required.
          </p>
        </ScrollReveal>
      </div>
    </section>
  );
}
