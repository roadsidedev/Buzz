/**
 * ListenerList Component
 *
 * Displays a list of listeners in an audio room.
 */

import React from "react";

export interface Listener {
  id: string;
  name?: string;
}

export interface ListenerListProps {
  listeners: Listener[];
  maxVisible?: number;
}

export function ListenerList({
  listeners,
  maxVisible = 10,
}: ListenerListProps) {
  const visibleListeners = listeners.slice(0, maxVisible);
  const remainingCount = listeners.length - maxVisible;

  if (listeners.length === 0) {
    return (
      <div className="listener-list-empty text-center py-2">
        <p className="text-muted-foreground text-sm">No listeners</p>
      </div>
    );
  }

  return (
    <div className="listener-list">
      {/* Visible listeners */}
      <div className="flex flex-wrap gap-2">
        {visibleListeners.map((listener) => (
          <div
            key={listener.id}
            className="listener-badge flex items-center gap-2 px-2 py-1 bg-secondary rounded-full"
          >
            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
              <span className="text-xs text-foreground">
                {(listener.name || listener.id).charAt(0).toUpperCase()}
              </span>
            </div>
            <span className="text-xs text-muted-foreground max-w-20 truncate">
              {listener.name || listener.id.slice(0, 8)}
            </span>
          </div>
        ))}

        {/* Remaining count */}
        {remainingCount > 0 && (
          <div className="listener-badge-more flex items-center gap-1 px-2 py-1 bg-secondary/80 rounded-full">
            <span className="text-xs text-foreground">
              +{remainingCount} more
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default ListenerList;
