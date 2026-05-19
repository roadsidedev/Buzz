/**
 * PodcastCard Component
 *
 * Displays a single podcast series in discovery feed.
 * Features:
 * - Cover image
 * - Title and creator
 * - Episode count + latest episode date
 * - Subscribe button
 * - "Play Latest" CTA
 *
 * Part of Phase 1: Strategic Pivot UI
 */

import React from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "../../utils/date-format";
import { Play, Bell, Headphones } from "lucide-react";

export interface PodcastCardProps {
  id: string;
  title: string;
  creatorName: string;
  creatorAvatar?: string;
  creatorId?: string;
  coverImage?: string;
  category: string;
  episodeCount: number;
  totalListens: number;
  latestEpisodeDate?: Date;
  isSubscribed?: boolean;
  onPlay?: (podcastId: string) => void;
  onSubscribe?: (podcastId: string) => void;
}

const categoryColors: Record<string, string> = {
  tech: "bg-primary/10 text-primary",
  finance: "bg-green-100 text-green-800",
  creative: "bg-purple-100 text-purple-800",
  dev: "bg-muted text-muted-foreground",
  research: "bg-amber-100 text-amber-800",
  other: "bg-muted text-muted-foreground",
};

export const PodcastCard: React.FC<PodcastCardProps> = ({
  id,
  title,
  creatorName,
  creatorAvatar,
  creatorId,
  coverImage,
  category,
  episodeCount,
  totalListens,
  latestEpisodeDate,
  isSubscribed = false,
  onPlay,
  onSubscribe,
}) => {
  const navigate = useNavigate()
  const latestAgo = latestEpisodeDate
    ? formatDistanceToNow(latestEpisodeDate)
    : "No episodes";

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-white transition-all hover:border-gray-300 hover:shadow-lg">
      {/* Cover Image */}
      <div className="relative h-40 overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200">
        {coverImage ? (
          <img
            src={coverImage}
            alt={title}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/60 to-primary">
            <Headphones className="h-12 w-12 text-white opacity-50" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col justify-between p-4">
        {/* Category Badge */}
        <div className="mb-2">
          <span
            className={`inline-block rounded px-2 py-1 text-xs font-semibold ${categoryColors[category] || categoryColors.other}`}
          >
            {category.charAt(0).toUpperCase() + category.slice(1)}
          </span>
        </div>

        {/* Title */}
        <div>
          <h3 className="line-clamp-2 text-base font-semibold text-gray-900">
            {title}
          </h3>
        </div>

        {/* Creator Info */}
        <div className="mt-3 flex items-center gap-2">
          {creatorAvatar ? (
            <img
              src={creatorAvatar}
              alt={creatorName}
              className="h-8 w-8 rounded-full bg-gray-200 cursor-pointer"
              onClick={(e) => { e.stopPropagation(); creatorId && navigate(`/profile/${creatorId}`) }}
            />
          ) : (
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 cursor-pointer"
              onClick={(e) => { e.stopPropagation(); creatorId && navigate(`/profile/${creatorId}`) }}
            />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {creatorName}
            </p>
            <p className="text-xs text-gray-500">{latestAgo}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-3 flex items-center gap-3 border-t border-gray-100 pt-3 text-xs text-gray-600">
          <div className="flex items-center gap-1">
            <span className="font-medium">{episodeCount}</span>
            <span>episode{episodeCount !== 1 ? "s" : ""}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-medium">
              {(totalListens / 1000).toFixed(1)}K
            </span>
            <span>listens</span>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => onPlay?.(id)}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 active:bg-primary"
          >
            <Play className="h-3 w-3 fill-current" />
            Play
          </button>

          <button
            onClick={() => onSubscribe?.(id)}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
              isSubscribed
                ? "border border-gray-300 bg-white text-gray-900 hover:bg-gray-50"
                : "border border-gray-300 bg-white text-gray-900 hover:bg-gray-50"
            }`}
          >
            <Bell className="h-3 w-3" />
            {isSubscribed ? "Subscribed" : "Subscribe"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PodcastCard;
