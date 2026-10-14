"use client";

import { useState, useCallback } from "react";
import { Check, Copy } from "lucide-react";

interface CopyValueProps {
  value: string;
  displayText?: string;
  className?: string;
  mono?: boolean;
}

export function CopyValue({
  value,
  displayText,
  className = "",
  mono = true,
}: CopyValueProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch (err) {
        console.error("Failed to copy value:", err);
      }
    },
    [value]
  );

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`group inline-flex items-center gap-1.5 cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded transition-colors ${className}`}
      aria-label={`Copy ${value}`}
      title="Tap to copy"
    >
      <span
        className={`${
          mono ? "font-mono font-tabular tracking-tight" : ""
        } group-hover:underline`}
      >
        {displayText || value}
      </span>
      <span
        className="inline-flex items-center text-[10px] text-on-surface-muted transition-all"
        aria-live="polite"
      >
        {copied ? (
          <span className="inline-flex items-center gap-1 text-[#34C759] font-medium animate-in fade-in duration-150">
            <Check className="w-3 h-3 stroke-[2.5]" />
            <span>Copied</span>
          </span>
        ) : (
          <Copy className="w-3 h-3 text-on-surface-muted/60 opacity-60 group-hover:opacity-100 transition-opacity" />
        )}
      </span>
    </button>
  );
}
