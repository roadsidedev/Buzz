/**
 * RoomCard Component
 *
 * Displays a single live room (space) or livestream in discovery feed.
 * Features:
 * - Live badge with viewer count
 * - Host avatar + name (strict @username display)
 * - Room type indicator
 * - Dynamic CTA (Join for Audio, Watch for Livestream)
 */

import React, { useState } from "react";
import { formatDistanceToNow } from "../../utils/date-format";
import { Play, Users, Radio } from "lucide-react";
import type { DiscoveryRoom } from "common/types/discovery";

export interface RoomCardProps {
  room: DiscoveryRoom;
  onJoin: (roomId: string) => void;
  onWatch?: (roomId: string) => void;
  isLoading?: boolean;
  onClick?: () => void;
}

const typeColors: Record<string, string> = {
  debate: "bg-purple-100 text-purple-800",
  coding: "bg-blue-100 text-blue-800",
  research: "bg-green-100 text-green-800",
  trading: "bg-yellow-100 text-yellow-800",
  simulation: "bg-pink-100 text-pink-800",
  livestream: "bg-red-100 text-red-800",
};

const typeLabels: Record<string, string> = {
  debate: "Debate",
  coding: "Code",
  research: "Research",
  trading: "Trading",
  simulation: "Simulation",
  livestream: "Livestream",
};

export const RoomCard: React.FC<RoomCardProps> = ({
  room,
  onJoin,
  onWatch,
  isLoading = false,
  onClick,
}) => {
  const [isJoining, setIsJoining] = useState(false);
  const isLivestream = room.type === "livestream";
  
  // Handle string timestamps from API
  const createdAtDate = room.createdAt ? new Date(room.createdAt) : new Date();
  const createdTimeAgo = formatDistanceToNow(createdAtDate);
  
  const isLiveNow = room.status === "live";

  const handleJoinClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsJoining(true);
    try {
      if (isLivestream && onWatch) {
        onWatch(room.id);
      } else {
        onJoin(room.id);
      }
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div
      className="group relative flex h-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-white transition-all hover:border-gray-300 hover:shadow-lg cursor-pointer"
      onClick={onClick}
    >
      {/* Header with Live Badge */}
      <div className="relative h-40 bg-mac-gray border-b-2 border-gray-200 p-4">
        {isLiveNow && (
          <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-red-500 px-3 py-1.5 z-10">
            <div className="h-2 w-2 animate-pulse rounded-full bg-white" />
            <span className="text-xs font-semibold text-white">LIVE</span>
          </div>
        )}

        {/* Type Badge */}
        <div className={`absolute left-3 top-3 w-fit rounded px-2 py-1 text-xs font-semibold z-10 ${typeColors[room.type] || "bg-gray-100 text-gray-800"}`}>
          {typeLabels[room.type] || room.type}
        </div>

        {/* Placeholder for room image/gradient */}
        <div className="absolute inset-0 opacity-10 flex items-center justify-center">
          <Radio className="h-20 w-20" strokeWidth={1} />
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col justify-between p-4">
        {/* Title & Description */}
        <div>
          <h3 className="line-clamp-2 text-base font-semibold text-gray-900 group-hover:text-mac-charcoal transition-colors">
            {room.objective || "Untitled Session"}
          </h3>
          {room.description && (
            <p className="mt-1 line-clamp-2 text-sm text-gray-600">
              {room.description}
            </p>
          )}
        </div>

        {/* Host Info */}
        <div className="mt-4 flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-accent-purple overflow-hidden flex-shrink-0 border-2 border-mac-charcoal shadow-retro-sm">
            {room.hostAgent.avatar ? (
              <img src={room.hostAgent.avatar} alt={room.hostAgent.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white text-xs font-bold">
                {room.hostAgent.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-tighter text-gray-500 font-bold leading-none mb-0.5">Hosted by</p>
            <p className="text-sm font-bold text-mac-charcoal truncate">
              @{room.hostAgent.name.replace(/^@/, '')}
            </p>
          </div>
        </div>

        {/* Stats Footer */}
        <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
          <div className="flex items-center gap-1.5 text-sm text-gray-600">
            <Users className="h-4 w-4 text-accent-purple" />
            <span className="font-medium">
              {(room.viewerCount || 0).toLocaleString()} {isLivestream ? "viewing" : (room.viewerCount === 1 ? "listener" : "listeners")}
            </span>
          </div>

          <button
            onClick={handleJoinClick}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold text-white transition-all shadow-retro-sm active:translate-y-0.5 active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed ${
              isLivestream ? "bg-accent-crimson hover:bg-red-700" : "bg-mac-charcoal hover:bg-black"
            }`}
            disabled={isLoading || isJoining}
          >
            <Play className="h-3 w-3 fill-current" />
            {isJoining ? "..." : (isLivestream ? "Watch" : "Join")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RoomCard;
