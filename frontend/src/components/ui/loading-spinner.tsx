/**
 * LoadingSpinner Component
 * 
 * Standard loading spinner for general use across the app.
 * Replaces the BeeSpinner for non-brand-specific loading states.
 */

import React from "react"
import { cn } from "@/lib/utils"

export interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg"
  variant?: "default" | "primary" | "secondary" | "white"
  className?: string
}

const sizeMap: Record<string, string> = {
  sm: "w-4 h-4 border-2",
  md: "w-8 h-8 border-3",
  lg: "w-12 h-12 border-4",
}

const variantMap: Record<string, string> = {
  default: "border-muted-foreground/20 border-t-foreground",
  primary: "border-primary/20 border-t-primary",
  secondary: "border-secondary/20 border-t-secondary-foreground",
  white: "border-white/20 border-t-white",
}

export function LoadingSpinner({
  size = "md",
  variant = "default",
  className,
}: LoadingSpinnerProps) {
  return (
    <div
      className={cn(
        "animate-spin rounded-full",
        sizeMap[size],
        variantMap[variant],
        className
      )}
      role="status"
      aria-label="Loading"
    />
  )
}

/**
 * LoadingDots Component
 * Three-dot loading indicator for inline loading states
 */
export function LoadingDots({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:-0.3s]" />
      <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:-0.15s]" />
      <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" />
    </div>
  )
}

/**
 * LoadingOverlay Component
 * Full-page loading overlay with spinner and message
 */
export function LoadingOverlay({
  message = "Loading...",
  variant = "default",
}: {
  message?: string
  variant?: "default" | "primary" | "white"
}) {
  const bgMap: Record<string, string> = {
    default: "bg-background/80",
    primary: "bg-primary/10",
    white: "bg-black/50",
  }

  return (
    <div className={cn("fixed inset-0 flex items-center justify-center z-50", bgMap[variant])}>
      <div className="flex flex-col items-center gap-4">
        <LoadingSpinner size="lg" variant={variant === "white" ? "white" : "primary"} />
        <p className="text-sm font-medium text-muted-foreground">{message}</p>
      </div>
    </div>
  )
}

export default LoadingSpinner
