import React from "react";

interface AppleSpinnerProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function AppleSpinner({ className = "", size = "md" }: AppleSpinnerProps) {
  const sizeClasses = {
    sm: "w-5 h-5",
    md: "w-8 h-8",
    lg: "w-10 h-10",
  }[size];

  // Authentic iOS 8-spoke activity indicator
  const spokes = [
    { angle: 0, opacity: 1.0 },
    { angle: 45, opacity: 0.87 },
    { angle: 90, opacity: 0.74 },
    { angle: 135, opacity: 0.61 },
    { angle: 180, opacity: 0.48 },
    { angle: 225, opacity: 0.35 },
    { angle: 270, opacity: 0.22 },
    { angle: 315, opacity: 0.12 },
  ];

  return (
    <div
      className={`relative inline-flex items-center justify-center animate-spin ${sizeClasses} ${className}`}
      style={{ animationDuration: "0.85s", animationTimingFunction: "steps(8, end)" }}
      role="status"
      aria-label="Loading"
    >
      <svg
        viewBox="0 0 100 100"
        fill="currentColor"
        className="w-full h-full text-foreground/80"
        xmlns="http://www.w3.org/2000/svg"
      >
        {spokes.map(({ angle, opacity }, index) => (
          <rect
            key={index}
            x="46"
            y="10"
            width="8"
            height="22"
            rx="4"
            transform={`rotate(${angle} 50 50)`}
            style={{ opacity }}
          />
        ))}
      </svg>
    </div>
  );
}
