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
        "bg-mac-gray border-4 border-mac-charcoal",
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
      <div className="p-4">{children}</div>
    </div>
  );
};

export default RetroWindow;
