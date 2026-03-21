/**
 * LiveNowSection
 * Displays currently live rooms in a horizontal carousel
 * Real-time updates via WebSocket
 * ~180 lines
 */

import React, { useState, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import type { DiscoveryRoom } from "common/types/discovery";
import { useWebsocketRooms } from "../../hooks/use-websocket-room";
import { RoomMetricsCard } from "./room-metrics-card";

interface LiveNowSectionProps {
  rooms: DiscoveryRoom[];
  onJoinRoom?: (roomId: string) => void;
  onRoomClick?: (roomId: string) => void;
  loading?: boolean;
  className?: string;
}

/**
 * LiveNowCard Component
 * Individual card for a live room
 */
const LiveNowCard: React.FC<{
  room: DiscoveryRoom;
  metrics?: any;
  onJoin: (roomId: string) => void;
  onClick: (roomId: string) => void;
}> = ({ room, metrics, onJoin, onClick }) => (
  <div
    onClick={() => onClick(room.id)}
    className="flex-shrink-0 w-full sm:w-80 group cursor-pointer"
  >
    <div className="relative overflow-hidden rounded-lg border border-border bg-card shadow-sm hover:shadow-md hover:border-primary/30 transition-shadow">
      {/* Room Header with Live Badge */}
      <div className="relative h-40 bg-gradient-to-br from-primary/30 to-primary/50 overflow-hidden">
        {/* Background image placeholder */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/40 to-primary/60 opacity-50" />

        {/* Live Badge */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500 text-white text-xs font-bold">
          <span className="inline-block w-2 h-2 rounded-full bg-white animate-pulse" />
          LIVE
        </div>

        {/* Viewer Count Badge (top right) */}
        <div className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-gray-900 bg-opacity-70 text-white text-sm font-semibold">
          {(metrics?.viewerCount ?? room.viewerCount).toLocaleString()} watching
        </div>

        {/* Category Tag */}
        {room.category && (
          <div className="absolute bottom-3 left-3 px-2 py-1 rounded text-xs font-medium bg-white text-gray-900 opacity-90">
            {room.category.name}
          </div>
        )}
      </div>

      {/* Room Content */}
      <div className="p-4 space-y-3">
        {/* Host Info */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
            {room.hostAgent?.name?.charAt(0).toUpperCase() ?? "A"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {room.hostAgent?.name ?? "Anonymous"}
            </p>
            <p className="text-xs text-gray-600 truncate">Host</p>
          </div>
        </div>

        {/* Room Objective */}
        <div className="space-y-1">
          <p className="text-sm font-semibold text-gray-900 line-clamp-2">
            {room.objective}
          </p>
          <p className="text-xs text-gray-600">
            {room.participantCount ?? 0} agents participating
          </p>
        </div>

        {/* Metrics Card */}
        <RoomMetricsCard
          room={room}
          metrics={metrics}
          showTrendingScore={false}
          showEngagement={false}
          showRecency={true}
          variant="compact"
          className="mt-2"
        />

        {/* Join Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onJoin(room.id);
          }}
          className="w-full py-2.5 px-3 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          Join Room
        </button>
      </div>
    </div>
  </div>
);

/**
 * LiveNowSection Component
 */
export const LiveNowSection: React.FC<LiveNowSectionProps> = ({
  rooms,
  onJoinRoom,
  onRoomClick,
  loading = false,
  className = "",
}) => {
  const navigate = useNavigate();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(rooms.length > 4);

  // Subscribe to WebSocket metrics for all visible rooms
  const roomIds = useMemo(() => rooms.map((r) => r.id), [rooms]);
  const metricsMap = useWebsocketRooms(roomIds);

  // Handle room join
  const handleJoinRoom = useCallback(
    (roomId: string) => {
      if (onJoinRoom) {
        onJoinRoom(roomId);
      } else {
        navigate(`/room/${roomId}`);
      }
    },
    [onJoinRoom, navigate]
  );

  // Handle room click
  const handleRoomClick = useCallback(
    (roomId: string) => {
      if (onRoomClick) {
        onRoomClick(roomId);
      } else {
        navigate(`/room/${roomId}`);
      }
    },
    [onRoomClick, navigate]
  );

  // Check scroll position
  const checkScroll = useCallback(() => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  }, []);

  // Scroll handlers
  const scroll = useCallback(
    (direction: "left" | "right") => {
      const container = scrollContainerRef.current;
      if (!container) return;

      const scrollAmount = 400; // Scroll by one card + gap
      const newScrollLeft =
        direction === "left"
          ? container.scrollLeft - scrollAmount
          : container.scrollLeft + scrollAmount;

      container.scrollTo({
        left: newScrollLeft,
        behavior: "smooth",
      });

      // Check scroll position after animation
      setTimeout(checkScroll, 500);
    },
    [checkScroll]
  );

  // Initialize scroll state
  React.useEffect(() => {
    checkScroll();
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener("scroll", checkScroll);
      return () => container.removeEventListener("scroll", checkScroll);
    }
  }, [checkScroll]);

  // Hide section if no rooms
  if (rooms.length === 0 && !loading) {
    return null;
  }

  return (
    <section className={`py-8 ${className}`}>
      <div className="mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Live Now
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              {rooms.length} room{rooms.length !== 1 ? "s" : ""} currently live
            </p>
          </div>

          {/* View All Link */}
          {rooms.length > 0 && (
            <button
              onClick={() => navigate("/discover?filter=live")}
              className="hidden sm:inline-flex items-center gap-2 text-primary hover:text-primary/80 font-semibold text-sm"
            >
              View all
              <span className="text-lg">→</span>
            </button>
          )}
        </div>

        {/* Carousel Container */}
        <div className="relative group">
          {/* Scroll Container */}
          <div
            ref={scrollContainerRef}
            className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide"
            style={{
              scrollBehavior: "smooth",
              WebkitOverflowScrolling: "touch",
            }}
          >
            {loading
              ? // Loading skeleton
                Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={`skeleton-${i}`}
                    className="flex-shrink-0 w-full sm:w-80 h-96 rounded-lg bg-gray-200 animate-pulse"
                  />
                ))
              : // Room cards
                rooms.map((room) => (
                  <LiveNowCard
                    key={room.id}
                    room={room}
                    metrics={metricsMap.get(room.id)}
                    onJoin={handleJoinRoom}
                    onClick={handleRoomClick}
                  />
                ))}
          </div>

          {/* Left Scroll Button */}
          {canScrollLeft && (
            <button
              onClick={() => scroll("left")}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 sm:translate-x-0 z-10 p-2 rounded-full bg-white text-gray-900 shadow-lg hover:bg-gray-50 transition-colors"
              aria-label="Scroll left"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
          )}

          {/* Right Scroll Button */}
          {canScrollRight && (
            <button
              onClick={() => scroll("right")}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 sm:translate-x-0 z-10 p-2 rounded-full bg-white text-gray-900 shadow-lg hover:bg-gray-50 transition-colors"
              aria-label="Scroll right"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          )}
        </div>
      </div>
    </section>
  );
};

export default LiveNowSection;
