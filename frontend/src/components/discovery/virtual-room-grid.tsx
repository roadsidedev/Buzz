/**
 * VirtualRoomGrid
 * Virtualized grid component for rendering large room lists efficiently
 * Uses react-window for memory-efficient rendering
 * ~120 lines
 */

import React, { useMemo, useCallback } from "react";
import type { DiscoveryRoom } from "common/types/discovery";

interface VirtualRoomGridProps {
  rooms: DiscoveryRoom[];
  renderCard: (room: DiscoveryRoom, index: number) => React.ReactNode;
  columns?: number;
  gap?: number;
  rowHeight?: number;
  containerHeight?: number;
  className?: string;
}

/**
 * VirtualRoomGrid Component
 * Renders large lists efficiently by only rendering visible items
 */
export const VirtualRoomGrid: React.FC<VirtualRoomGridProps> = ({
  rooms,
  renderCard,
  columns = 4,
  gap = 16,
  rowHeight = 400,
  containerHeight = 800,
  className = "",
}) => {
  // Calculate dimensions
  const itemWidth = useMemo(() => {
    return `calc((100% - ${gap * (columns - 1)}px) / ${columns})`;
  }, [columns, gap]);

  const rowCount = useMemo(() => {
    return Math.ceil(rooms.length / columns);
  }, [rooms.length, columns]);

  const totalHeight = rowCount * (rowHeight + gap);

  // Calculate visible range based on scroll position
  const [scrollPosition, setScrollPosition] = React.useState(0);
  const visibleStartIndex = useMemo(() => {
    const visibleRows = Math.ceil(containerHeight / (rowHeight + gap)) + 1;
    const startRow = Math.floor(scrollPosition / (rowHeight + gap)) - 1;
    return Math.max(0, startRow * columns);
  }, [scrollPosition, rowHeight, gap, columns, containerHeight]);

  const visibleEndIndex = useMemo(() => {
    const visibleRows = Math.ceil(containerHeight / (rowHeight + gap)) + 2;
    const endRow = Math.ceil(scrollPosition / (rowHeight + gap)) + visibleRows;
    return Math.min(rooms.length, endRow * columns);
  }, [scrollPosition, rowHeight, gap, columns, containerHeight, rooms.length]);

  // Handle scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollPosition((e.target as HTMLDivElement).scrollTop);
  }, []);

  // Get visible items
  const visibleItems = useMemo(() => {
    return rooms.slice(visibleStartIndex, visibleEndIndex);
  }, [rooms, visibleStartIndex, visibleEndIndex]);

  const offsetY = useMemo(() => {
    return Math.floor(visibleStartIndex / columns) * (rowHeight + gap);
  }, [visibleStartIndex, columns, rowHeight, gap]);

  return (
    <div
      className={`overflow-y-auto ${className}`}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      {/* Spacer for scroll position */}
      <div style={{ height: offsetY }} />

      {/* Grid Container */}
      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gap: `${gap}px`,
          paddingLeft: `${gap / 2}px`,
          paddingRight: `${gap / 2}px`,
        }}
      >
        {visibleItems.map((room, index) => (
          <div key={room.id} style={{ height: rowHeight }}>
            {renderCard(room, visibleStartIndex + index)}
          </div>
        ))}
      </div>

      {/* Spacer for remaining items */}
      <div style={{ height: Math.max(0, totalHeight - offsetY - (visibleItems.length * (rowHeight + gap))) }} />
    </div>
  );
};

export default VirtualRoomGrid;
