"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

interface CitizenHeaderProps {
  title?: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  onBack?: () => void;
  rightElement?: ReactNode;
  className?: string;
}

export function CitizenHeader({
  title = "KKMA Revenue",
  subtitle,
  backHref,
  backLabel = "Back",
  onBack,
  rightElement,
  className = "",
}: CitizenHeaderProps) {
  const hasBack = Boolean(backHref || onBack);

  return (
    <header
      className={`sticky top-0 z-30 w-full h-12 bg-background/85 backdrop-blur-md border-b border-border-light/60 flex items-center justify-between px-4 text-foreground transition-colors ${className}`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {hasBack && (
          <>
            {backHref ? (
              <Link
                href={backHref}
                className="inline-flex items-center gap-0.5 -ml-2 px-2 py-1.5 rounded-lg text-primary hover:text-primary-hover hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer text-[15px] font-medium"
                aria-label={`Go back to ${backLabel}`}
              >
                <ChevronLeft className="w-5 h-5 stroke-[2.2]" />
                <span className="hidden sm:inline">{backLabel}</span>
              </Link>
            ) : (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-0.5 -ml-2 px-2 py-1.5 rounded-lg text-primary hover:text-primary-hover hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer text-[15px] font-medium"
                aria-label={`Go back to ${backLabel}`}
              >
                <ChevronLeft className="w-5 h-5 stroke-[2.2]" />
                <span className="hidden sm:inline">{backLabel}</span>
              </button>
            )}
          </>
        )}

        <div className="truncate">
          <div className="flex items-center gap-1.5">
            <h1 className="text-[15px] font-semibold tracking-tight text-foreground truncate">
              {title}
            </h1>
            {subtitle && (
              <span className="text-[12px] text-on-surface-muted truncate">
                &bull; {subtitle}
              </span>
            )}
          </div>
        </div>
      </div>

      {rightElement && (
        <div className="shrink-0 flex items-center gap-2 pl-2">
          {rightElement}
        </div>
      )}
    </header>
  );
}
