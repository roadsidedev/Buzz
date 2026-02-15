/**
 * Card Component (Neobrutalism Design)
 *
 * A flexible container component for content grouping.
 * Provides consistent spacing, borders, and optional interactivity.
 *
 * Features:
 * - Bold 2px black border
 * - Customizable padding
 * - Optional hover effects
 * - Full TypeScript support
 */

import React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  padding?: "sm" | "md" | "lg";
  isClickable?: boolean;
  variant?: "default" | "bordered" | "flat";
}

const paddingStyles = {
  sm: "p-3",
  md: "p-6",
  lg: "p-8",
};

const variantStyles = {
  default: "bg-base-white border-2 border-base-black",
  bordered: "bg-transparent border-2 border-base-black",
  flat: "bg-base-gray-50 border-2 border-base-black",
};

/**
 * Card Component
 *
 * @example
 * <Card padding="md">
 *   <h3>Card Title</h3>
 *   <p>Card content goes here</p>
 * </Card>
 *
 * <Card variant="bordered" isClickable>
 *   Interactive card with border only
 * </Card>
 */
export const Card: React.FC<CardProps> = ({
  children,
  padding = "md",
  isClickable = false,
  variant = "default",
  className = "",
  ...props
}) => {
  return (
    <div
      className={`
        ${variantStyles[variant]}
        ${paddingStyles[padding]}
        ${isClickable ? "cursor-pointer transition-all duration-200 hover:shadow-glow-primary" : ""}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
};

export default Card;
