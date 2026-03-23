"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import Image from "next/image";

export function Preloader() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 2200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: "easeInOut" }}
        >
          {/* Animated color swipe bars */}
          <motion.div
            className="absolute inset-0 flex"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
          >
            <motion.div
              className="h-full flex-1 bg-magenta"
              initial={{ scaleY: 0 }}
              animate={{ scaleY: [0, 1, 1, 0] }}
              transition={{ duration: 2, times: [0, 0.3, 0.7, 1], ease: "easeInOut" }}
              style={{ transformOrigin: "bottom" }}
            />
            <motion.div
              className="h-full flex-1 bg-yellow"
              initial={{ scaleY: 0 }}
              animate={{ scaleY: [0, 1, 1, 0] }}
              transition={{ duration: 2, times: [0, 0.3, 0.7, 1], ease: "easeInOut", delay: 0.1 }}
              style={{ transformOrigin: "bottom" }}
            />
            <motion.div
              className="h-full flex-1 bg-cyan"
              initial={{ scaleY: 0 }}
              animate={{ scaleY: [0, 1, 1, 0] }}
              transition={{ duration: 2, times: [0, 0.3, 0.7, 1], ease: "easeInOut", delay: 0.2 }}
              style={{ transformOrigin: "bottom" }}
            />
            <motion.div
              className="h-full flex-1 bg-magenta"
              initial={{ scaleY: 0 }}
              animate={{ scaleY: [0, 1, 1, 0] }}
              transition={{ duration: 2, times: [0, 0.3, 0.7, 1], ease: "easeInOut", delay: 0.3 }}
              style={{ transformOrigin: "bottom" }}
            />
            <motion.div
              className="h-full flex-1 bg-yellow"
              initial={{ scaleY: 0 }}
              animate={{ scaleY: [0, 1, 1, 0] }}
              transition={{ duration: 2, times: [0, 0.3, 0.7, 1], ease: "easeInOut", delay: 0.4 }}
              style={{ transformOrigin: "bottom" }}
            />
          </motion.div>

          {/* Logo */}
          <motion.div
            className="relative z-10"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }}
          >
            <Image
              src="https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjKGZUcil50cL3l4ddD6f3aw0ebnvLr_dTXSl5LUgaMbZLIAs19H9u5TQEozHOH2M2SaRlz6GcynqLy3uF2O8pEWC5K8VDj0k19kZPGAxQ3qI0KEjRO_ql_XHAXoly_Tw7dYvja-tnddTIYtDUOkNDO7WSNBldJad3v3zEIDdt8ENoRMf1FSs63kGcjZAjr/w604-h202/Untitled%20design%20(52).png"
              alt="MODAF"
              width={200}
              height={67}
              className="h-16 sm:h-20 w-auto drop-shadow-2xl"
              priority
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
