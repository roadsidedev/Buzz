/**
 * Button Component (Neobrutalism Design)
 *
 * A versatile button component with three variants:
 * - primary: Black background, white text
 * - secondary: White background, black text
 * - accent: Cyan background, white text
 *
 * Features:
 * - Hover state with color inversion
 * - Active state with scale-down
 * - Loading state with spinner
 * - Disabled state with reduced opacity
 * - Full TypeScript support
 */

import React from "react";
import { BeeSpinner } from "@/components/discovery/loading-state";

export type ButtonVariant = "primary" | "secondary" | "accent";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  children: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-base-black text-base-white border-base-black hover:bg-base-white hover:text-base-black",
  secondary:
    "bg-base-white text-base-black border-base-black hover:bg-base-black hover:text-base-white",
  accent:
    "bg-primary-500 text-base-white border-base-black hover:bg-primary-600",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-4 py-2 text-sm",
  md: "px-6 py-3 text-base",
  lg: "px-8 py-4 text-lg",
};

/**
 * Button Component
 *
 * @example
 * <Button variant="primary">Click Me</Button>
 * <Button variant="accent" size="lg">Large Action</Button>
 * <Button variant="secondary" disabled>Disabled</Button>
 */
export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  size = "md",
  isLoading = false,
  children,
  disabled,
  className = "",
  ...props
}) => {
  return (
    <button
      disabled={disabled || isLoading}
      className={`
        border-2 font-bold uppercase tracking-wider
        transition-all duration-200
        active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `}
      {...props}
    >
      {isLoading ? (
        <span className="inline-flex items-center gap-2">
          <BeeSpinner size="sm" />
          Loading...
        </span>
      ) : (
        children
      )}
    </button>
  );
};

export default Button;
