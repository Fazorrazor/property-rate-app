"use client";

import { useState, useId, ReactNode } from "react";
import { ChevronDown } from "lucide-react";

interface DisclosureRowProps {
  title: string;
  subtitle?: string;
  defaultExpanded?: boolean;
  children: ReactNode;
  className?: string;
}

export function DisclosureRow({
  title,
  subtitle,
  defaultExpanded = false,
  children,
  className = "",
}: DisclosureRowProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const contentId = useId();

  return (
    <div
      className={`border-t border-border-light/60 transition-colors ${className}`}
    >
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        aria-controls={contentId}
        className="w-full min-h-[44px] py-3.5 flex items-center justify-between text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-lg group transition-colors"
      >
        <div className="space-y-0.5 pr-2">
          <span className="text-[15px] font-medium text-foreground group-hover:text-primary transition-colors block">
            {title}
          </span>
          {subtitle && (
            <span className="text-[13px] text-on-surface-muted block">
              {subtitle}
            </span>
          )}
        </div>
        <div className="shrink-0 text-on-surface-muted transition-transform duration-200 ease-out group-hover:text-foreground">
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${
              isExpanded ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      <div
        id={contentId}
        data-disclosure-content
        className={`grid transition-[grid-template-rows,opacity] duration-250 ease-out ${
          isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 pointer-events-none"
        }`}
      >
        <div className="overflow-hidden">
          <div
            className={`pt-1 pb-4 transition-opacity duration-200 ${
              isExpanded ? "opacity-100 delay-[60ms]" : "opacity-0"
            }`}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
