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
        "bg-mac-charcoal px-3 py-2 flex items-center justify-between",
        "border-b-4 border-mac-charcoal",
        draggable && "cursor-move",
      )}
    >
      {/* Window Controls */}
      {showControls && (
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="w-4 h-4 bg-accent-crimson border-2 border-mac-charcoal hover:bg-red-400 transition-colors"
            aria-label="Close"
          />
          <button
            onClick={onMinimize}
            className="w-4 h-4 bg-accent-yellow border-2 border-mac-charcoal hover:bg-yellow-300 transition-colors"
            aria-label="Minimize"
          />
          <button
            onClick={onMaximize}
            className="w-4 h-4 bg-accent-teal border-2 border-mac-charcoal hover:bg-teal-300 transition-colors"
            aria-label="Maximize"
          />
        </div>
      )}

      {/* Title */}
      <div className="flex-1 flex items-center justify-center gap-2">
        {/* Drag Lines Pattern */}
        <div className="flex gap-0.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="w-0.5 h-3 bg-mac-gray"
              style={{ opacity: 0.5 }}
            />
          ))}
        </div>

        <span className="font-sans text-sm font-bold uppercase tracking-wider text-mac-gray">
          {title}
        </span>

        {/* Drag Lines Pattern (mirrored) */}
        <div className="flex gap-0.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="w-0.5 h-3 bg-mac-gray"
              style={{ opacity: 0.5 }}
            />
          ))}
        </div>
      </div>

      {/* Placeholder for balance */}
      {showControls && <div className="w-12" />}
    </div>
  );
};

export default TitleBar;
