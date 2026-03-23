"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

export function FloatingPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [autoStarted, setAutoStarted] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const startAudio = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || autoStarted) return;
    setAutoStarted(true);
    audio.volume = 0.3;
    audio.play().then(() => setIsPlaying(true)).catch(() => {
      // Browser blocked autoplay, user will need to tap the button
    });
  }, [autoStarted]);

  // Auto-play on first user interaction anywhere on the page
  useEffect(() => {
    if (autoStarted) return;

    const handler = (e: Event) => {
      // Skip if the click/touch was on the player button itself
      if (buttonRef.current?.contains(e.target as Node)) return;
      startAudio();
    };
    window.addEventListener("click", handler, { once: true });
    window.addEventListener("touchend", handler, { once: true });

    return () => {
      window.removeEventListener("click", handler);
      window.removeEventListener("touchend", handler);
    };
  }, [autoStarted, startAudio]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.volume = 0.3;
      audio.play().then(() => {
        setIsPlaying(true);
        setAutoStarted(true);
      }).catch(() => {});
    }
  };

  return (
    <motion.div
      className="fixed bottom-5 right-5 z-50"
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 1.5, duration: 0.5, ease: "easeOut" }}
    >
      <audio
        ref={audioRef}
        src="https://intense-coral-pn3mnmtzlu.edgeone.app/Bedrock%20Labyrinth.mp3"
        loop
        preload="metadata"
      />
      <motion.button
        ref={buttonRef}
        onClick={togglePlay}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="relative flex items-center gap-2.5 h-11 pl-3.5 pr-4 rounded-full border border-white/10 bg-black/80 backdrop-blur-xl text-white text-sm font-medium shadow-[0_0_20px_rgba(233,30,140,0.15)] transition-colors duration-200 hover:border-magenta/30"
        aria-label={isPlaying ? "Pause music" : "Play music"}
      >
        {/* Subtle glow ring when playing */}
        <AnimatePresence>
          {isPlaying && (
            <motion.div
              className="absolute inset-0 rounded-full border border-magenta/20"
              initial={{ opacity: 0, scale: 1 }}
              animate={{ opacity: [0, 0.5, 0], scale: [1, 1.15, 1.3] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
            />
          )}
        </AnimatePresence>

        {/* Equalizer / Play icon */}
        <AnimatePresence mode="wait">
          {isPlaying ? (
            <motion.span
              key="eq"
              className="flex items-end gap-[3px] h-4"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.2 }}
            >
              {[0, 0.15, 0.3, 0.1].map((delay, i) => (
                <motion.span
                  key={i}
                  className="w-[3px] rounded-full bg-magenta"
                  animate={{ height: ["4px", "14px", "6px", "10px", "4px"] }}
                  transition={{
                    duration: 0.8,
                    repeat: Infinity,
                    delay,
                    ease: "easeInOut",
                  }}
                />
              ))}
            </motion.span>
          ) : (
            <motion.span
              key="play"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.2 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-magenta">
                <polygon points="6,3 20,12 6,21" />
              </svg>
            </motion.span>
          )}
        </AnimatePresence>

        {/* Label */}
        <AnimatePresence mode="wait">
          <motion.span
            key={isPlaying ? "playing" : "paused"}
            className="text-white/60 text-xs font-medium hidden sm:inline"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            {isPlaying ? "Now Playing" : "Play Music"}
          </motion.span>
        </AnimatePresence>
      </motion.button>
    </motion.div>
  );
}
