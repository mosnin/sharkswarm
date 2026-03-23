"use client";

import { motion } from "motion/react";
import Image from "next/image";

export function LanyardCard() {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pointer-events-none">
      {/* Strap */}
      <div className="flex flex-col items-center">
        <motion.div
          className="w-6 overflow-hidden"
          initial={{ height: 0 }}
          animate={{ height: 120 }}
          exit={{ height: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <div className="w-full h-full bg-gradient-to-b from-magenta via-yellow to-cyan rounded-b-sm" />
        </motion.div>

        {/* Clip */}
        <motion.div
          className="w-3 h-4 bg-zinc-400 rounded-b-sm -mt-px"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ delay: 0.3, duration: 0.2 }}
        />

        {/* Card */}
        <motion.div
          className="relative mt-1 pointer-events-auto"
          initial={{ opacity: 0, y: -20, rotateZ: -8 }}
          animate={{
            opacity: 1,
            y: 0,
            rotateZ: [0, 6, -4, 2, 0],
          }}
          exit={{ opacity: 0, y: -30 }}
          transition={{
            opacity: { duration: 0.3, delay: 0.35 },
            y: { duration: 0.5, delay: 0.35, ease: "easeOut" },
            rotateZ: {
              duration: 1.5,
              delay: 0.5,
              ease: "easeInOut",
            },
          }}
        >
          <div className="w-48 sm:w-56 rounded-2xl border border-white/15 bg-black/90 backdrop-blur-xl p-5 shadow-[0_0_40px_rgba(233,30,140,0.2),0_20px_60px_rgba(0,0,0,0.6)]">
            {/* Logo */}
            <div className="flex justify-center mb-4">
              <Image
                src="https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjKGZUcil50cL3l4ddD6f3aw0ebnvLr_dTXSl5LUgaMbZLIAs19H9u5TQEozHOH2M2SaRlz6GcynqLy3uF2O8pEWC5K8VDj0k19kZPGAxQ3qI0KEjRO_ql_XHAXoly_Tw7dYvja-tnddTIYtDUOkNDO7WSNBldJad3v3zEIDdt8ENoRMf1FSs63kGcjZAjr/w604-h202/Untitled%20design%20(52).png"
                alt="MODAF"
                width={200}
                height={67}
                className="h-10 sm:h-12 w-auto"
              />
            </div>

            {/* Divider */}
            <div className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent mb-3" />

            {/* Info */}
            <p className="text-center text-xs text-white/50 leading-relaxed">
              Framework for AI-driven
              <br />
              web application development
            </p>

            {/* Badge */}
            <div className="mt-3 flex justify-center">
              <span className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full bg-magenta/20 text-magenta border border-magenta/30">
                Open Source
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
