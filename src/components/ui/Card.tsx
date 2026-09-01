import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

const cardVariants = cva(
  "rounded-[28px] transition-all duration-200 overflow-hidden",
  {
    variants: {
      variant: {
        white:
          "bg-white border border-slate-100 shadow-[0_4px_24px_-6px_rgba(0,0,0,0.04)]",
        subtle:
          "bg-[#F1F3F6] border-0",
        aqua:
          "bg-[#E7F6F8] text-[#0E6873] border-0",
        coral:
          "bg-[#FFEBE4] text-[#B43818] border-0",
        coralGradient:
          "bg-gradient-to-tr from-[#FF7A59] to-[#FFA07A] text-white border-0 shadow-[0_8px_20px_-6px_rgba(255,122,89,0.35)]",
        purple:
          "bg-[#F0EEFF] text-[#4F35C2] border-0",
        yellow:
          "bg-[#FFF8E6] text-[#8C6500] border-0",
        dark:
          "bg-[#111827] text-white border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)]",
      },
      interactive: {
        true: "cursor-pointer hover:shadow-[0_8px_30px_-6px_rgba(0,0,0,0.08)] active:scale-[0.99]",
        false: "",
      },
    },
    defaultVariants: {
      variant: "white",
      interactive: false,
    },
  }
);

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, interactive, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cardVariants({ variant, interactive, className })}
        {...props}
      />
    );
  }
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={`flex flex-col space-y-1.5 p-6 ${className || ""}`}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={`font-semibold tracking-tight text-[#111827] ${className || ""}`}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={`p-6 pt-0 ${className || ""}`} {...props} />
));
CardContent.displayName = "CardContent";

export { Card, CardHeader, CardTitle, CardContent, cardVariants };
