/**
 * RoomCard Component
 * Displays a single room preview with metrics and join button
 */

import React, { useState } from "react";
import { Users, TrendUp, Clock } from "phosphor-react";
import type { DiscoveryRoom } from "common/types/discovery";

interface RoomCardProps {
  room: DiscoveryRoom;
  onJoin: (roomId: string) => void;
  isLoading?: boolean;
  onClick?: () => void;
}

/**
 * RoomCard Component
 * Shows room preview with:
 * - Thumbnail image
 * - Title and objective
 * - Host agent name
 * - Viewer count, trending score, duration
 * - Category tag
 * - Join button
 */
export const RoomCard: React.FC<RoomCardProps> = ({
  room,
  onJoin,
  isLoading = false,
  onClick,
}) => {
  const [isJoining, setIsJoining] = useState(false);

  const handleJoinClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsJoining(true);
    try {
      onJoin(room.id);
    } finally {
      setIsJoining(false);
    }
  };

  const getDurationText = (startedAt: string): string => {
    const start = new Date(startedAt);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just started";
    if (diffMins < 60) return `${diffMins}m`;
    const hours = Math.floor(diffMins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  const getTrendingColor = (score: number): string => {
    if (score >= 80) return "bg-red-100 text-red-700";
    if (score >= 60) return "bg-orange-100 text-orange-700";
    if (score >= 40) return "bg-yellow-100 text-yellow-700";
    return "bg-gray-100 text-gray-700";
  };

  const getStatusBadgeText = (status: string): string => {
    switch (status) {
      case "live":
        return "LIVE";
      case "pending":
        return "STARTING";
      case "completed":
        return "ENDED";
      case "archived":
        return "ARCHIVED";
      default:
        return status.toUpperCase();
    }
  };

  const getStatusBadgeColor = (status: string): string => {
    switch (status) {
      case "live":
        return "bg-red-500 text-white";
      case "pending":
        return "bg-yellow-500 text-white";
      case "completed":
        return "bg-gray-500 text-white";
      case "archived":
        return "bg-gray-400 text-white";
      default:
        return "bg-gray-500 text-white";
    }
  };

  return (
    <div
      className="group relative flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-all hover:shadow-lg hover:border-gray-300 cursor-pointer"
      onClick={onClick}
    >
      {/* Thumbnail / Header Image */}
      <div className="relative h-40 overflow-hidden bg-mac-gray border-b-4 border-gray-200">
        {room.thumbnailUrl ? (
          <img
            src={room.thumbnailUrl}
            alt={room.objective}
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="h-full w-full bg-accent-purple flex items-center justify-center">
            <div className="text-white text-opacity-50 text-sm text-center px-4">
              {room.category?.name || "Room"}
            </div>
          </div>
        )}

        {/* Status Badge */}
        <div
          className={`absolute top-3 right-3 px-2 py-1 rounded-full text-xs font-bold ${getStatusBadgeColor(room.status)}`}
        >
          {getStatusBadgeText(room.status)}
        </div>

        {/* Category Badge */}
        {room.category && (
          <div
            className="absolute bottom-3 left-3 px-3 py-1 rounded-full text-xs font-semibold text-white bg-black bg-opacity-50"
            style={{
              backgroundColor: room.category.color
                ? `${room.category.color}dd`
                : "rgba(0, 0, 0, 0.5)",
            }}
          >
            {room.category.name}
          </div>
        )}
      </div>

      {/* Card Content */}
      <div className="flex flex-1 flex-col p-4">
        {/* Host Info */}
        <div className="mb-2 flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gray-300 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-gray-500">Hosted by</p>
            <p className="text-sm font-medium text-gray-900 truncate">
              {room.hostAgent.name}
            </p>
          </div>
        </div>

        {/* Title / Objective */}
        <h3 className="mb-3 line-clamp-2 text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
          {room.objective}
        </h3>

        {/* Metrics */}
        <div className="grid grid-cols-3 gap-2 mb-3 text-xs">
          {/* Viewers */}
          <div className="flex items-center gap-1 text-gray-600">
            <Users className="w-3.5 h-3.5" />
            <span className="font-medium">
              {room.viewerCount.toLocaleString()}
            </span>
          </div>

          {/* Trending Score */}
          <div
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${getTrendingColor(room.trendingScore)}`}
          >
            <TrendUp className="w-3.5 h-3.5" />
            <span>{Math.round(room.trendingScore)}</span>
          </div>

          {/* Duration */}
          <div className="flex items-center gap-1 text-gray-600">
            <Clock className="w-3.5 h-3.5" />
            <span className="font-medium">
              {getDurationText(room.startedAt)}
            </span>
          </div>
        </div>

        {/* Engagement Rate */}
        <div className="mb-3 flex items-center justify-between text-xs">
          <span className="text-gray-600">Engagement</span>
          <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all"
              style={{ width: `${Math.min(room.engagementRate * 20, 100)}%` }}
            />
          </div>
        </div>

        {/* Participants */}
        {room.participantCount > 0 && (
          <div className="mb-3 text-xs text-gray-600">
            {room.participantCount} participant
            {room.participantCount !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Join Button */}
      <div className="border-t border-gray-100 p-3">
        <button
          onClick={handleJoinClick}
          disabled={isLoading || isJoining || room.status === "completed"}
          className="w-full rounded-lg bg-blue-600 px-4 py-2 text-center text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isJoining
            ? "Joining..."
            : room.status === "completed"
              ? "Room Ended"
              : "Join Now"}
        </button>
      </div>
    </div>
  );
};

/**
 * RoomCardGrid Component
 * Displays multiple room cards in a responsive grid
 */
interface RoomCardGridProps {
  rooms: DiscoveryRoom[];
  onJoinRoom: (roomId: string) => void;
  isLoading?: boolean;
  onRoomClick?: (roomId: string) => void;
  emptyMessage?: string;
}

export const RoomCardGrid: React.FC<RoomCardGridProps> = ({
  rooms,
  onJoinRoom,
  isLoading = false,
  onRoomClick,
  emptyMessage = "No rooms found",
}) => {
  if (rooms.length === 0 && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="text-gray-500 text-center">
          <p className="text-lg font-medium mb-2">{emptyMessage}</p>
          <p className="text-sm">
            Try adjusting your filters or check back later
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {rooms.map((room) => (
        <RoomCard
          key={room.id}
          room={room}
          onJoin={onJoinRoom}
          isLoading={isLoading}
          onClick={() => onRoomClick?.(room.id)}
        />
      ))}
    </div>
  );
};

export default RoomCard;
