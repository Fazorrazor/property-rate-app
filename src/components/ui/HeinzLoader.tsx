"use client";

import { motion } from "framer-motion";

interface HeinzLoaderProps {
  size?: "small" | "large";
}

export function HeinzLoader({ size = "large" }: HeinzLoaderProps) {
  const isSmall = size === "small";
  
  return (
    <motion.div
      className={`font-bold tracking-tight text-[#612D53] select-none flex items-center justify-center ${
        isSmall ? "text-base" : "text-3xl"
      }`}
      animate={{
        opacity: [0.4, 1, 0.4],
        scale: [0.98, 1, 0.98],
      }}
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    >
      Heinz
    </motion.div>
  );
}
