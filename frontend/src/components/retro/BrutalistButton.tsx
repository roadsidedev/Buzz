import React from "react";
import { clsx } from "clsx";

export interface BrutalistButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "accent" | "outline";
  size?: "sm" | "md" | "lg";
  shadowColor?: "black" | "purple" | "teal" | "yellow" | "crimson";
  children: React.ReactNode;
}

/**
 * BrutalistButton - CLAW-OS retro button
 *
 * Features:
 * - 4px solid black border
 * - Hard drop shadow
 * - Offset on :active (translate 2px)
 * - Shadow removal on :active
 */
export const BrutalistButton: React.FC<BrutalistButtonProps> = ({
  variant = "primary",
  size = "md",
  shadowColor = "black",
  children,
  className,
  disabled,
  ...props
}) => {
  const baseClasses =
    "font-bold tracking-wide transition-all duration-100 cursor-pointer active:translate-x-1 active:translate-y-1 active:shadow-none border-2 border-mac-charcoal";

  const variantClasses = {
    primary:
      "bg-mac-charcoal text-mac-white hover:bg-accent-purple hover:shadow-retro-purple",
    secondary:
      "bg-mac-white text-mac-charcoal hover:bg-accent-yellow hover:shadow-retro-yellow",
    accent:
      "bg-accent-purple text-mac-white hover:bg-accent-teal hover:shadow-retro-teal",
    outline:
      "bg-transparent text-mac-charcoal hover:bg-mac-charcoal hover:text-mac-white",
  };

  const sizeClasses = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-6 py-3 text-base",
    lg: "px-8 py-4 text-lg",
  };

  const shadowClasses = {
    black: "shadow-retro-sm",
    purple: "shadow-retro-purple",
    teal: "shadow-retro-teal",
    yellow: "shadow-retro-yellow",
    crimson: "shadow-retro-crimson",
  };

  return (
    <button
      className={clsx(
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        !disabled && shadowClasses[shadowColor],
        disabled && "opacity-50 cursor-not-allowed",
        className,
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};

export default BrutalistButton;
