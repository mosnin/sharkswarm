"use client";

import { ScrollReveal } from "@/components/ui/scroll-reveal";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "What is MODAF exactly?",
    answer:
      "MODAF is a structured documentation framework. It contains no code. When cloned into your project, it provides your AI coding agent (like Claude Code) with detailed specs, design tokens, component rules, and a phased build process that guides it from idea to production-ready web application.",
  },
  {
    question: "Which AI coding agents does MODAF work with?",
    answer:
      "MODAF was designed primarily for Claude Code, but the framework is agent-agnostic. Any AI coding assistant that can read markdown files and follow structured instructions can use it. The documentation is written to be clear and actionable regardless of the underlying model.",
  },
  {
    question: "Do I need to know how to code?",
    answer:
      "Some technical literacy helps. You'll need to run commands in a terminal, review generated code, and understand basic concepts like databases and APIs. But MODAF's phased approach means you don't need to write code yourself. Your agent handles the implementation while you guide the product decisions.",
  },
  {
    question: "What tech stack does MODAF use?",
    answer:
      "The default stack includes Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, Prisma, PostgreSQL, Auth.js, Stripe, Resend, and Vercel. You can override any of these in the discovery phase. The framework adapts to your stack preferences.",
  },
  {
    question: "How long does it take to build a web application with MODAF?",
    answer:
      "A typical v1 with auth, dashboard, core features, billing, and marketing site can be built across multiple Claude Code sessions, often in a day or two of active work. The phased approach means you can stop and resume at any phase boundary without losing context.",
  },
  {
    question: "What types of projects does MODAF support?",
    answer:
      "MODAF is optimized for web applications with auth, billing, and multi-tenant features. For simpler projects like static sites, landing pages, or tools without user accounts, you can still use the website and foundation phases, but many internal phases won't apply.",
  },
  {
    question: "Is MODAF free and open source?",
    answer:
      "Yes. MODAF is fully open source and free to use. Clone it, modify it, build on it. The framework is designed to be forked and adapted to your specific workflow and conventions.",
  },
  {
    question: "What happens if something goes wrong?",
    answer:
      "MODAF has multiple safety nets. 46+ validation gates check structural integrity after every phase. Doctor Mode is a built-in structural linter that scans for broken references and doc drift. Error Recovery provides a phase re-run protocol so you never have to start over. The pattern snapshot system prevents code style drift across sessions and agents. That said, this is experimental software — always use version control and back up your work.",
  },
  {
    question: "Am I locked into the default tech stack?",
    answer:
      "No. MODAF includes documented escape hatches for swapping any default technology. Want Clerk instead of Auth.js? Lemon Squeezy instead of Stripe? MySQL instead of PostgreSQL? Each swap guide tells the agent exactly which files to read and what to change, so you're never locked in.",
  },
];

export function FAQSection() {
  return (
    <section id="faq" className="py-20 md:py-32 px-4 sm:px-6 overflow-hidden">
      <div className="mx-auto max-w-3xl w-full">
        <ScrollReveal>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-cyan mb-2 text-center">
            FAQ
          </p>
          <h2 className="text-3xl sm:text-4xl md:text-[44px] font-bold leading-tight text-center">
            Common questions
          </h2>
        </ScrollReveal>

        <ScrollReveal delay={0.1}>
          <Accordion
            className="mt-12"
          >
            {faqs.map((faq, i) => (
              <AccordionItem
                key={i}
                value={`item-${i}`}
                className="border-white/10"
              >
                <AccordionTrigger className="text-left text-base font-medium text-white hover:text-white/80 py-4">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-base text-white/50 leading-relaxed pb-4">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </ScrollReveal>
      </div>
    </section>
  );
}
