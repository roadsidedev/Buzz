import React from "react";
import { clsx } from "clsx";

export interface RetroWindowV2Props {
  title?: string;
  children: React.ReactNode;
  color?:
    | "bg-white"
    | "bg-[#FFE66D]"
    | "bg-[#4ECDC4]"
    | "bg-[#6C5CE7]"
    | "bg-[#FF6B6B]";
  className?: string;
  showControls?: boolean;
}

/**
 * RetroWindowV2 - Exact match to prototype
 *
 * Features:
 * - 3px borders (not 4px)
 * - 6px shadow with exact values
 * - Title bar with window control dots
 * - Drag lines pattern
 */
export const RetroWindowV2: React.FC<RetroWindowV2Props> = ({
  title,
  children,
  color = "bg-white",
  className,
  showControls = true,
}) => {
  return (
    <div
      className={clsx(
        "border-[3px] border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]",
        color,
        className,
        "overflow-hidden",
      )}
    >
      {/* Title Bar */}
      {title && (
        <div className="border-b-[3px] border-black flex items-center justify-between px-3 py-1 bg-white">
          <div className="flex gap-1.5">
            {/* Close button */}
            <div className="w-3 h-3 border-2 border-black bg-white" />
            {/* Drag lines - hidden on mobile */}
            <div className="hidden sm:flex gap-1">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="w-8 h-[2px] bg-black/10 mt-[4px]" />
              ))}
            </div>
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest">
            {title}
          </span>
          <div className="flex gap-1.5">
            {/* Minimize */}
            <div className="w-3 h-3 border-2 border-black" />
            {/* Maximize */}
            <div className="w-3 h-3 border-2 border-black bg-black" />
          </div>
        </div>
      )}
      <div className="relative">{children}</div>
    </div>
  );
};

export default RetroWindowV2;
