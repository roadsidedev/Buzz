import React from "react";
import { clsx } from "clsx";
import { X, Minus, Square } from "phosphor-react";

export interface TitleBarProps {
  title: string;
  showControls?: boolean;
  draggable?: boolean;
  onClose?: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
}

/**
 * TitleBar - Mac System 7 style window title bar
 *
 * Features:
 * - Horizontal "drag" lines pattern
 * - Square minimize/close boxes
 * - Pixel-perfect styling
 */
export const TitleBar: React.FC<TitleBarProps> = ({
  title,
  showControls = true,
  draggable = false,
  onClose,
  onMinimize,
  onMaximize,
}) => {
  return (
    <div
      className={clsx(
        "bg-white px-3 py-1.5 flex items-center justify-between",
        "border-b-4 border-black",
        draggable && "cursor-move",
      )}
    >
      {/* Window Controls - Square boxes */}
      {showControls && (
        <div className="flex items-center gap-1">
          <button
            onClick={onClose}
            className="w-3.5 h-3.5 bg-white border-2 border-black hover:bg-gray-300 transition-colors flex items-center justify-center"
            aria-label="Close"
          >
            <div className="w-1 h-1 bg-black" />
          </button>
          <button
            onClick={onMinimize}
            className="w-3.5 h-3.5 bg-white border-2 border-black hover:bg-gray-300 transition-colors"
            aria-label="Minimize"
          />
          <button
            onClick={onMaximize}
            className="w-3.5 h-3.5 bg-black border-2 border-black hover:bg-gray-700 transition-colors"
            aria-label="Maximize"
          />
        </div>
      )}

      {/* Title */}
      <div className="flex-1 flex items-center justify-center gap-2 px-4">
        {/* Drag Lines Pattern */}
        <div className="flex flex-col justify-between h-3 opacity-20">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="w-full h-px bg-black" />
          ))}
        </div>

        <span className="text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">
          {title}
        </span>

        {/* Drag Lines Pattern (mirrored) */}
        <div className="flex flex-col justify-between h-3 opacity-20">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="w-full h-px bg-black" />
          ))}
        </div>
      </div>

      {/* Placeholder for balance */}
      {showControls && <div className="w-10" />}
    </div>
  );
};

export default TitleBar;
