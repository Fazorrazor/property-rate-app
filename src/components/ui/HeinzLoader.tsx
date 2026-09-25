"use client";

import { AppleSpinner } from "./AppleSpinner";

interface HeinzLoaderProps {
  size?: "small" | "large";
  className?: string;
}

export function HeinzLoader({ size = "large", className = "" }: HeinzLoaderProps) {
  const mappedSize = size === "small" ? "sm" : "md";
  
  return (
    <AppleSpinner
      size={mappedSize}
      className={`text-[#612D53] ${className}`}
    />
  );
}
