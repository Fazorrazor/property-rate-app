import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40 cursor-pointer active:scale-[0.98]",
  {
    variants: {
      variant: {
        primary:
          "bg-[#111827] text-white hover:bg-black shadow-[0_4px_14px_rgba(0,0,0,0.1)]",
        secondary:
          "bg-[#F1F3F6] text-[#111827] hover:bg-[#E5E7EB]",
        outline:
          "border border-slate-200 bg-white text-slate-800 hover:bg-slate-50",
        ghost:
          "text-slate-600 hover:text-slate-900 hover:bg-slate-100/60",
        aqua:
          "bg-[#E7F6F8] text-[#0E6873] hover:bg-[#D8F0F3]",
        coral:
          "bg-[#FFEBE4] text-[#B43818] hover:bg-[#FFDED4]",
      },
      size: {
        default: "h-12 px-6 text-sm",
        sm: "h-9 px-4 text-xs font-semibold",
        lg: "h-14 px-8 text-base font-semibold",
        icon: "h-10 w-10 p-0 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    return (
      <button
        className={buttonVariants({ variant, size, className })}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
