import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * CLAW-OS RETRO Input Component
 *
 * Features:
 * - 4px solid black border
 * - No rounded corners
 * - Retro focus state
 */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-12 w-full bg-mac-white border-4 border-mac-charcoal px-4 py-2 text-sm font-mono placeholder:text-base-gray-500 focus:outline-none focus:border-accent-purple focus:shadow-retro-purple disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-100",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
