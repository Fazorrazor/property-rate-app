'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { AppleSpinner } from './ui/AppleSpinner';

interface SigningOutScreenProps {
  userName?: string;
}

export function SigningOutScreen({}: SigningOutScreenProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="fixed inset-0 z-[9999] bg-[#F5F5F7]/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 select-none overflow-hidden"
      role="status"
      aria-live="polite"
      aria-label="Signing out"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center gap-3.5"
      >
        <AppleSpinner size="md" className="text-[#1D1D1F]" />
        <span className="text-[15px] font-medium text-[#1D1D1F] tracking-tight">
          Signing Out...
        </span>
      </motion.div>
    </motion.div>
  );
}
