"use client";

import { motion } from "framer-motion";

export default function MainTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15, ease: "easeInOut" }}
      className="flex-1 w-full h-full"
    >
      {children}
    </motion.div>
  );
}
