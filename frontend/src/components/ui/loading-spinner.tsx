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
  sm: "w-16 h-1",
  md: "w-24 h-1.5",
  lg: "w-32 h-2",
}

const variantMap: Record<string, string> = {
  default: "bg-muted-foreground/20",
  primary: "bg-primary/20",
  secondary: "bg-secondary/20",
  white: "bg-white/20",
}

const barVariantMap: Record<string, string> = {
  default: "bg-foreground",
  primary: "bg-primary",
  secondary: "bg-secondary-foreground",
  white: "bg-white",
}

export function LoadingSpinner({
  size = "md",
  variant = "default",
  className,
}: LoadingSpinnerProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-full",
        sizeMap[size],
        variantMap[variant],
        className
      )}
      role="status"
      aria-label="Loading"
    >
      <div
        className={cn(
          "absolute top-0 left-0 h-full rounded-full animate-[loading-bar_1.2s_ease-in-out_infinite]",
          barVariantMap[variant]
        )}
        style={{ width: "40%" }}
      />
    </div>
  )
}

<style>{`
  @keyframes loading-bar {
    0% { left: -40%; }
    50% { left: 60%; }
    100% { left: -40%; }
  }
`}</style>

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
