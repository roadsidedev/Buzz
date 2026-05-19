/**
 * RoomCard Component
 *
 * Displays a single live room (space) in discovery feed.
 * Features:
 * - Live badge with listener count
 * - Host avatar + name
 * - Room type indicator
 * - "Join Now" CTA
 * - Styled like Twitter Spaces discovery card
 *
 * Part of Phase 1: Strategic Pivot UI
 */

import React from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "../../utils/date-format";
import { Play, Users, Radio } from "lucide-react";

export interface RoomCardProps {
  id: string;
  title: string;
  type: string; // known types or custom slug
  hostName: string;
  hostAvatar?: string;
  hostId?: string;
  listenerCount: number;
  isLive: boolean;
  createdAt: Date;
  description?: string;
  onJoin?: (roomId: string) => void;
}

const typeColors: Record<string, string> = {
  debate: "bg-purple-100 text-purple-800",
  coding: "bg-blue-100 text-blue-800",
  research: "bg-green-100 text-green-800",
  trading: "bg-yellow-100 text-yellow-800",
  simulation: "bg-pink-100 text-pink-800",
};

const typeLabels: Record<string, string> = {
  debate: "Debate",
  coding: "Code",
  research: "Research",
  trading: "Trading",
  simulation: "Simulation",
};

export const RoomCard: React.FC<RoomCardProps> = ({
  id,
  title,
  type,
  hostName,
  hostAvatar,
  hostId,
  listenerCount,
  isLive,
  createdAt,
  description,
  onJoin,
}) => {
  const navigate = useNavigate()
  const createdTimeAgo = formatDistanceToNow(createdAt);

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-white transition-all hover:border-gray-300 hover:shadow-lg">
      {/* Header with Live Badge */}
      <div className="relative h-40 bg-mac-gray border-b-2 border-gray-200 p-4">
        {isLive && (
          <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-red-500 px-3 py-1.5">
            <div className="h-2 w-2 animate-pulse rounded-full bg-white" />
            <span className="text-xs font-semibold text-white">LIVE</span>
          </div>
        )}

        {/* Type Badge */}
        <div className={`absolute left-3 top-3 w-fit rounded px-2 py-1 text-xs font-semibold ${typeColors[type]}`}>
          {typeLabels[type]}
        </div>

        {/* Placeholder for room image/gradient */}
        <div className="absolute inset-0 opacity-10">
          <Radio className="h-full w-full" strokeWidth={1} />
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col justify-between p-4">
        {/* Title & Description */}
        <div>
          <h3 className="line-clamp-2 text-base font-semibold text-gray-900">
            {title}
          </h3>
          {description && (
            <p className="mt-1 line-clamp-2 text-sm text-gray-600">
              {description}
            </p>
          )}
        </div>

        {/* Host Info */}
        <div className="mt-3 flex items-center gap-2">
          {hostAvatar ? (
            <img
              src={hostAvatar}
              alt={hostName}
              className="h-8 w-8 rounded-full bg-gray-200 cursor-pointer"
              onClick={(e) => { e.stopPropagation(); hostId && navigate(`/profile/${hostId}`) }}
            />
          ) : (
            <div className="h-8 w-8 rounded-full border-2 border-black bg-accent-purple cursor-pointer"
              onClick={(e) => { e.stopPropagation(); hostId && navigate(`/profile/${hostId}`) }}
            />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {hostName}
            </p>
            <p className="text-xs text-gray-500">{createdTimeAgo}</p>
          </div>
        </div>

        {/* Stats Footer */}
        <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
          <div className="flex items-center gap-1.5 text-sm text-gray-600">
            <Users className="h-4 w-4" />
            <span>
              {listenerCount.toLocaleString()} listener{listenerCount !== 1 ? "s" : ""}
            </span>
          </div>

          <button
            onClick={() => onJoin?.(id)}
            className="inline-flex items-center gap-1.5 rounded-full bg-black px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-gray-800 active:bg-gray-900"
          >
            <Play className="h-3 w-3 fill-current" />
            Join
          </button>
        </div>
      </div>
    </div>
  );
};

export default RoomCard;
