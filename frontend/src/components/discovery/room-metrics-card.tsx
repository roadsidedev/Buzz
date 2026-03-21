/**
 * RoomMetricsCard
 * Displays room metrics: trending score, viewer count, engagement
 * Used by both LiveNowSection and TrendingSection
 */

import React, { useMemo } from "react";
import type { DiscoveryRoom } from "common/types/discovery";
import type { WebsocketRoomState } from "../../hooks/use-websocket-room";

interface RoomMetricsCardProps {
  room: DiscoveryRoom;
  metrics?: WebsocketRoomState;
  showTrendingScore?: boolean;
  showEngagement?: boolean;
  showRecency?: boolean;
  variant?: "compact" | "detailed";
  className?: string;
}

/**
 * Calculate time-relative text (e.g., "5 min ago")
 */
function getTimeRelative(startedAt: string): string {
  const now = new Date();
  const started = new Date(startedAt);
  const diffMs = now.getTime() - started.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

/**
 * Get recency boost (0-1) based on room start time
 * Used for visual emphasis on recent rooms
 */
function getRecencyBoost(startedAt: string): number {
  const now = new Date();
  const started = new Date(startedAt);
  const diffMins = (now.getTime() - started.getTime()) / 60000;

  if (diffMins <= 30) return 1.0; // <30m: full boost
  if (diffMins <= 60) return 0.9; // <60m
  if (diffMins <= 180) return 0.7; // <3h
  if (diffMins <= 480) return 0.5; // <8h
  return 0.3; // older
}

/**
 * Calculate growth indicator based on viewer count trend
 * (In real app, this would come from backend with historical data)
 */
function getGrowthTrend(
  viewerCount: number,
  trendingScore: number
): { direction: "up" | "down" | "stable"; percentage: number } {
  // Approximate growth from trending score and viewer count
  // In real implementation, this would come from backend metrics
  const estimatedGrowth = (trendingScore / 100) * 20; // 0-20% growth range

  return {
    direction: estimatedGrowth > 2 ? "up" : estimatedGrowth < -2 ? "down" : "stable",
    percentage: Math.abs(Math.round(estimatedGrowth)),
  };
}

/**
 * RoomMetricsCard Component
 */
export const RoomMetricsCard: React.FC<RoomMetricsCardProps> = ({
  room,
  metrics,
  showTrendingScore = true,
  showEngagement = true,
  showRecency = true,
  variant = "compact",
  className = "",
}) => {
  // Use real-time metrics if available, fall back to room data
  const viewerCount = metrics?.viewerCount ?? room.viewerCount;
  const trendingScore = metrics?.trendingScore ?? room.trendingScore;

  // Calculate derived metrics
  const recencyBoost = useMemo(() => getRecencyBoost(room.startedAt), [room.startedAt]);
  const timeRelative = useMemo(() => getTimeRelative(room.startedAt), [room.startedAt]);
  const growth = useMemo(
    () => getGrowthTrend(viewerCount, trendingScore),
    [viewerCount, trendingScore]
  );

  // Engagement metric: approximate messages per viewer
  const engagementRatio = useMemo(() => {
    if (viewerCount === 0) return 0;
    return Math.round(((room.messageCount ?? 0) / Math.max(viewerCount, 1)) * 10) / 10;
  }, [viewerCount, room.messageCount]);

  // Determine visual styling based on trending score
  const scoreColor = useMemo(() => {
    if (trendingScore >= 75) return "text-green-600";
    if (trendingScore >= 50) return "text-primary";
    if (trendingScore >= 25) return "text-amber-600";
    return "text-muted-foreground";
  }, [trendingScore]);

  const scoreBgColor = useMemo(() => {
    if (trendingScore >= 75) return "bg-green-500/10";
    if (trendingScore >= 50) return "bg-primary/10";
    if (trendingScore >= 25) return "bg-amber-500/10";
    return "bg-muted";
  }, [trendingScore]);

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {/* Trending Score Bar */}
      {showTrendingScore && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
              Trending
            </label>
            <span className={`text-sm font-bold ${scoreColor}`}>
              {Math.round(trendingScore)}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                trendingScore >= 75
                  ? "bg-green-500"
                  : trendingScore >= 50
                    ? "bg-primary"
                    : trendingScore >= 25
                      ? "bg-amber-500"
                      : "bg-muted-foreground"
              }`}
              style={{ width: `${Math.min(trendingScore, 100)}%` }}
              role="progressbar"
              aria-label="Trending score"
              aria-valuenow={Math.round(trendingScore)}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>
      )}

      {/* Viewer Count & Growth */}
      <div className={`rounded-lg p-3 ${scoreBgColor}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold text-gray-900">
                {viewerCount.toLocaleString()}
              </span>
              <span className="text-xs text-gray-600">viewers</span>
            </div>
          </div>

          {/* Growth Indicator */}
          {growth.percentage > 0 && (
            <div
              className={`flex items-center gap-1 text-xs font-semibold ${
                growth.direction === "up"
                  ? "text-green-700"
                  : growth.direction === "down"
                    ? "text-red-700"
                    : "text-gray-700"
              }`}
            >
              <span>
                {growth.direction === "up"
                  ? "↑"
                  : growth.direction === "down"
                    ? "↓"
                    : "→"}
              </span>
              <span>{growth.percentage}%</span>
            </div>
          )}
        </div>
      </div>

      {/* Engagement Metric */}
      {showEngagement && variant === "detailed" && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-600">Engagement:</span>
          <div className="flex items-baseline gap-1">
            <span className="font-semibold text-gray-900">
              {room.messageCount?.toLocaleString() ?? 0}
            </span>
            <span className="text-xs text-gray-600">messages</span>
          </div>
          {viewerCount > 0 && (
            <div className="flex items-baseline gap-1 ml-auto">
              <span className="text-xs text-gray-600">
                ({engagementRatio} msg/viewer)
              </span>
            </div>
          )}
        </div>
      )}

      {/* Recency Badge */}
      {showRecency && (
        <div className="flex items-center gap-2">
          <span className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
            {timeRelative}
          </span>

          {/* Recency Pulse Indicator */}
          {recencyBoost >= 0.9 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700">
              <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              New
            </span>
          )}
        </div>
      )}

      {/* Connection Status Indicator */}
      {metrics && !metrics.isConnected && (
        <div className="flex items-center gap-1 text-xs text-yellow-700 bg-yellow-50 px-2 py-1 rounded">
          <span className="inline-block w-2 h-2 rounded-full bg-yellow-500" />
          <span>Updating...</span>
        </div>
      )}
    </div>
  );
};

export default RoomMetricsCard;
