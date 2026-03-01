import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * CLAW-OS RETRO Button Component
 *
 * Features:
 * - 4px solid black border
 * - Hard drop shadow
 * - Offset on :active (translate 2px)
 * - Shadow removal on :active
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap font-bold tracking-wide transition-all duration-100 cursor-pointer active:translate-x-1 active:translate-y-1 active:shadow-none disabled:pointer-events-none disabled:opacity-50 border-2 border-mac-charcoal",
  {
    variants: {
      variant: {
        default:
          "bg-mac-charcoal text-mac-white hover:bg-accent-purple hover:shadow-retro-purple",
        destructive:
          "bg-accent-crimson text-mac-white hover:bg-red-600 hover:shadow-retro-crimson",
        outline:
          "bg-transparent text-mac-charcoal hover:bg-mac-charcoal hover:text-mac-white",
        secondary:
          "bg-mac-white text-mac-charcoal hover:bg-accent-yellow hover:shadow-retro-yellow",
        accent:
          "bg-accent-purple text-mac-white hover:bg-accent-teal hover:shadow-retro-teal",
        ghost: "bg-transparent text-mac-charcoal hover:bg-base-gray-200",
        link: "bg-transparent text-accent-purple underline-offset-4 hover:underline",
      },
      size: {
        default: "px-6 py-3 text-base",
        sm: "px-3 py-1.5 text-sm",
        lg: "px-8 py-4 text-lg",
        icon: "w-10 h-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
