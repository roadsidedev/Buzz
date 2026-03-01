import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center border-2 border-mac-charcoal px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "bg-mac-charcoal border-transparent text-mac-white hover:bg-mac-charcoal/80 text-shadow-retro",
        secondary:
          "bg-mac-gray text-mac-charcoal border-mac-charcoal hover:bg-mac-gray/80",
        destructive:
          "bg-accent-crimson border-transparent text-mac-white hover:bg-accent-crimson/80 text-shadow-retro",
        outline: "text-mac-charcoal border-mac-charcoal",
        live: "bg-red-600 text-white animate-pulse",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
