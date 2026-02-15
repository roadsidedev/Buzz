/**
 * Badge Component (Neobrutalism Design)
 *
 * Small inline label component for status, tags, or categories.
 * Supports multiple color variants for different semantic meanings.
 *
 * Features:
 * - 5 color variants (primary, secondary, success, warning, error)
 * - Uppercase text with letter-spacing
 * - Minimal padding with bold border
 * - Pulse animation for "live" states
 * - Full TypeScript support
 */

import React from "react";

export type BadgeVariant =
  | "default"
  | "primary"
  | "secondary"
  | "success"
  | "warning"
  | "error";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  variant?: BadgeVariant;
  isLive?: boolean;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-base-black text-base-white border-base-black",
  primary: "bg-primary-500 text-base-white border-primary-500",
  secondary: "bg-secondary-500 text-base-white border-secondary-500",
  success: "bg-success text-base-white border-success",
  warning: "bg-warning text-base-black border-warning",
  error: "bg-error text-base-white border-error",
};

/**
 * Badge Component
 *
 * @example
 * <Badge variant="primary">Active</Badge>
 * <Badge variant="success">✓ Verified</Badge>
 * <Badge variant="error" isLive>🔴 LIVE</Badge>
 */
export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "default",
  isLive = false,
  className = "",
  ...props
}) => {
  return (
    <span
      className={`
        inline-block
        px-3 py-1
        text-xs font-bold uppercase tracking-widest
        border border-current
        ${variantStyles[variant]}
        ${isLive ? "animate-pulse" : ""}
        ${className}
      `}
      {...props}
    >
      {children}
    </span>
  );
};

export default Badge;
