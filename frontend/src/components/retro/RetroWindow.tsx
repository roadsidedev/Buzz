import React from "react";
import { clsx } from "clsx";
import { TitleBar } from "./TitleBar";

export interface RetroWindowProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
  shadowColor?: "black" | "purple" | "teal" | "yellow" | "crimson";
  showControls?: boolean;
  draggable?: boolean;
  footer?: React.ReactNode;
}

/**
 * RetroWindow - CLAW-OS window container
 *
 * A window wrapper with Mac System 7 style title bar
 * and configurable hard-drop shadow colors
 */
export const RetroWindow: React.FC<RetroWindowProps> = ({
  children,
  title,
  className,
  shadowColor = "black",
  showControls = true,
  draggable = false,
  footer,
}) => {
  const shadowClasses = {
    black: "shadow-retro-lg",
    purple: "shadow-retro-purple",
    teal: "shadow-retro-teal",
    yellow: "shadow-retro-yellow",
    crimson: "shadow-retro-crimson",
  };

  return (
    <div
      className={clsx(
        "bg-mac-gray border-4 border-mac-charcoal flex flex-col",
        shadowClasses[shadowColor],
        draggable && "cursor-move",
        className,
      )}
    >
      {title && (
        <TitleBar
          title={title}
          showControls={showControls}
          draggable={draggable}
        />
      )}
      <div className="flex-1 overflow-auto">{children}</div>
      {footer && (
        <div className="border-t-4 border-mac-charcoal bg-[#E0E0E0] px-3 py-1 text-[9px] font-bold uppercase tracking-tighter flex justify-between shrink-0">
          {footer}
        </div>
      )}
    </div>
  );
};

export default RetroWindow;
