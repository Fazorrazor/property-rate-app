"use client";

interface HeinzLoaderProps {
  size?: "small" | "large";
}

export function HeinzLoader({ size = "large" }: HeinzLoaderProps) {
  const isSmall = size === "small";
  
  return (
    <div
      className={`border-t-transparent rounded-full animate-spin border-[#612D53] ${
        isSmall ? "w-5 h-5 border-2" : "w-8 h-8 border-[3px]"
      }`}
      role="status"
      aria-label="Loading"
    />
  );
}
