"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import Image from "next/image";
import { HugeiconsIcon } from "@hugeicons/react";
import { Menu01Icon, Cancel01Icon, Github01Icon } from "@hugeicons/core-free-icons";

const navItems = [
  { label: "Get Started", href: "#get-started" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Features", href: "#features" },
  { label: "Structure", href: "#structure" },
  { label: "FAQ", href: "#faq" },
];

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <header className="fixed top-3 left-0 right-0 z-50 mx-auto w-[calc(100%-2rem)] max-w-5xl">
        <div className="flex items-center justify-between rounded-3xl border border-white/10 bg-black/80 backdrop-blur-xl px-4 py-2 shadow-lg">
          <a href="#" className="flex items-center gap-2">
            <Image
              src="https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjKGZUcil50cL3l4ddD6f3aw0ebnvLr_dTXSl5LUgaMbZLIAs19H9u5TQEozHOH2M2SaRlz6GcynqLy3uF2O8pEWC5K8VDj0k19kZPGAxQ3qI0KEjRO_ql_XHAXoly_Tw7dYvja-tnddTIYtDUOkNDO7WSNBldJad3v3zEIDdt8ENoRMf1FSs63kGcjZAjr/w604-h202/Untitled%20design%20(52).png"
              alt="MODAF"
              width={100}
              height={33}
              className="h-8 w-auto"
            />
          </a>

          <nav className="hidden lg:flex items-center gap-6">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-[15px] font-medium text-white/60 hover:text-white transition-colors duration-150"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <a
              href="https://github.com/mosnin/LoxSammy"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-2 h-9 px-4 text-sm font-semibold rounded-full bg-magenta text-white hover:bg-magenta/90 transition-colors duration-150"
            >
              <HugeiconsIcon icon={Github01Icon} size={16} />
              GitHub
            </a>

            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 text-white/60 hover:text-white"
              aria-label="Open menu"
            >
              <HugeiconsIcon icon={Menu01Icon} size={24} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-0 z-[60] bg-black flex flex-col"
          >
            <div className="flex items-center justify-between px-4 py-3 h-16">
              <Image
                src="https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjKGZUcil50cL3l4ddD6f3aw0ebnvLr_dTXSl5LUgaMbZLIAs19H9u5TQEozHOH2M2SaRlz6GcynqLy3uF2O8pEWC5K8VDj0k19kZPGAxQ3qI0KEjRO_ql_XHAXoly_Tw7dYvja-tnddTIYtDUOkNDO7WSNBldJad3v3zEIDdt8ENoRMf1FSs63kGcjZAjr/w604-h202/Untitled%20design%20(52).png"
                alt="MODAF"
                width={100}
                height={33}
                className="h-8 w-auto"
                />
              <button
                onClick={() => setMobileOpen(false)}
                className="p-2 text-white/60 hover:text-white"
                aria-label="Close menu"
              >
                <HugeiconsIcon icon={Cancel01Icon} size={24} />
              </button>
            </div>

            <nav className="flex-1 flex flex-col gap-6 px-6 pt-8">
              {navItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="text-lg font-medium text-white/80 hover:text-white"
                >
                  {item.label}
                </a>
              ))}
            </nav>

            <div className="px-6 pb-8">
              <a
                href="https://github.com/mosnin/LoxSammy"
                target="_blank"
                rel="noopener noreferrer"
                className="glow-button flex items-center justify-center gap-2 w-full h-12 text-base font-semibold rounded-xl text-white"
              >
                <span className="relative z-10 flex items-center gap-2">
                  <HugeiconsIcon icon={Github01Icon} size={18} />
                  View on GitHub
                </span>
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
