/**
 * TrendingSection
 * Displays trending rooms in a responsive grid
 * Real-time score updates via WebSocket
 * ~150 lines
 */

import React, { useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import type { DiscoveryRoom } from "common/types/discovery";
import { useWebsocketRooms } from "../../hooks/use-websocket-room";
import { RoomMetricsCard } from "./room-metrics-card";

interface TrendingSectionProps {
  rooms: DiscoveryRoom[];
  onJoinRoom?: (roomId: string) => void;
  onRoomClick?: (roomId: string) => void;
  loading?: boolean;
  className?: string;
  title?: string;
  description?: string;
}

/**
 * TrendingRoomCard Component
 * Displays a trending room with full metrics
 */
const TrendingRoomCard: React.FC<{
  room: DiscoveryRoom;
  rank: number;
  metrics?: any;
  onJoin: (roomId: string) => void;
  onClick: (roomId: string) => void;
}> = ({ room, rank, metrics, onJoin, onClick }) => (
  <div
    onClick={() => onClick(room.id)}
    className="group cursor-pointer h-full"
  >
    <div className="relative overflow-hidden rounded-lg border border-border bg-card shadow-sm hover:shadow-lg hover:border-primary/50 hover:shadow-primary/5 transition-all h-full flex flex-col">
      {/* Rank Badge */}
      <div className="absolute top-2 left-2 z-10 w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
        <span className="text-white text-sm font-bold">#{rank}</span>
      </div>

      {/* Room Header Image */}
      <div className="relative h-32 bg-gradient-to-br from-primary/40 to-primary/60 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/50 to-primary/70 opacity-30 group-hover:opacity-50 transition-opacity" />

        {/* Category Badge */}
        {room.category && (
          <div className="absolute bottom-2 right-2 px-2 py-1 rounded text-xs font-semibold bg-white text-gray-900 opacity-90">
            {room.category.name}
          </div>
        )}

        {/* Status Badge */}
        <div className="absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-bold text-white">
          {room.status === "live" ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              LIVE
            </span>
          ) : room.status === "pending" ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500">
              Upcoming
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-500">
              {room.status}
            </span>
          )}
        </div>
      </div>

      {/* Room Content */}
      <div className="p-4 flex-1 flex flex-col gap-3">
        {/* Host Info */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
            {room.hostAgent?.name?.charAt(0).toUpperCase() ?? "A"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-700 truncate">
              {room.hostAgent?.name ?? "Anonymous"}
            </p>
          </div>
        </div>

        {/* Room Objective */}
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-gray-900 line-clamp-2">
            {room.objective}
          </h3>
        </div>

        {/* Participant Count */}
        <p className="text-xs text-gray-600">
          {room.participantCount ?? 0} participating • {room.messageCount ?? 0} messages
        </p>

        {/* Metrics Card */}
        <RoomMetricsCard
          room={room}
          metrics={metrics}
          showTrendingScore={true}
          showEngagement={false}
          showRecency={true}
          variant="compact"
        />

        {/* Join Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onJoin(room.id);
          }}
          className="w-full py-2 px-3 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          Join Room
        </button>
      </div>
    </div>
  </div>
);

/**
 * TrendingSection Component
 */
export const TrendingSection: React.FC<TrendingSectionProps> = ({
  rooms,
  onJoinRoom,
  onRoomClick,
  loading = false,
  className = "",
  title = "Trending Now",
  description = "Hottest conversations happening right now",
}) => {
  const navigate = useNavigate();

  // Subscribe to WebSocket metrics for all rooms
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

  // Hide section if no rooms
  if (rooms.length === 0 && !loading) {
    return null;
  }

  return (
    <section className={`py-8 ${className}`}>
      <div className="mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mb-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
            {title}
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            {description}
          </p>
        </div>

        {/* Rooms Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {loading
            ? // Loading skeleton
              Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={`skeleton-${i}`}
                  className="h-96 rounded-lg bg-gray-200 animate-pulse"
                />
              ))
            : // Room cards
              rooms.map((room, index) => (
                <TrendingRoomCard
                  key={room.id}
                  room={room}
                  rank={index + 1}
                  metrics={metricsMap.get(room.id)}
                  onJoin={handleJoinRoom}
                  onClick={handleRoomClick}
                />
              ))}
        </div>

        {/* Empty State */}
        {!loading && rooms.length === 0 && (
          <div className="text-center py-12">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              No trending rooms right now
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              Check back later or create a new room to get started
            </p>
          </div>
        )}

        {/* View All Link */}
        {rooms.length > 0 && !loading && (
          <div className="mt-8 text-center">
            <button
              onClick={() => navigate("/discover?sort=trending")}
              className="inline-flex items-center gap-2 text-primary hover:text-primary/80 font-semibold"
            >
              View all trending rooms
              <span className="text-lg">→</span>
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

export default TrendingSection;
