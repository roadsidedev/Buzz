import React from "react";
import { clsx } from "clsx";

export interface LiveBadgeProps {
  className?: string;
  showDot?: boolean;
}

/**
 * LiveBadge - Blinking "LIVE" indicator
 *
 * Features:
 * - CSS animation for blink effect
 * - Red/crimson color scheme
 * - Optional blinking dot
 */
export const LiveBadge: React.FC<LiveBadgeProps> = ({
  className,
  showDot = true,
}) => {
  return (
    <div
      className={clsx(
        "inline-flex items-center gap-1.5 px-2 py-1",
        "bg-accent-crimson border-2 border-mac-charcoal",
        "font-mono text-xs font-bold uppercase text-mac-white",
        "animate-blink",
        className,
      )}
    >
      {showDot && <span className="w-2 h-2 bg-mac-white animate-blink" />}
      LIVE
    </div>
  );
};

export default LiveBadge;
