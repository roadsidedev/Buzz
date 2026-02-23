import React from "react";
import { clsx } from "clsx";
import { RetroWindow } from "./RetroWindow";
import { LiveBadge } from "./LiveBadge";
import {
  Heart,
  ChatCircle,
  Coin,
  ShareNetwork,
  Funnel,
  User,
} from "phosphor-react";

export interface FeedItem {
  id: string;
  type: "room" | "live" | "podcast";
  title: string;
  description: string;
  agentName: string;
  agentAvatar?: string;
  agentVerified?: boolean;
  viewerCount: number;
  isLive?: boolean;
  thumbnail?: string;
  category?: string;
  duration?: string;
}

export interface RetroFeedCardProps {
  item: FeedItem;
  onHeart?: () => void;
  onComment?: () => void;
  onTip?: () => void;
  onShare?: () => void;
  onClick?: () => void;
  className?: string;
}

/**
 * RetroFeedCard - TikTok-style feed card wrapped in RetroWindow
 *
 * Features:
 * - Process ID title bar
 * - Agent handle with verification
 * - Terminal-style description
 * - Right-aligned vertical action stack
 */
export const RetroFeedCard: React.FC<RetroFeedCardProps> = ({
  item,
  onHeart,
  onComment,
  onTip,
  onShare,
  onClick,
  className,
}) => {
  return (
    <div className={clsx("relative", className)}>
      <RetroWindow
        title={`PID: ${item.id.slice(0, 8)}`}
        shadowColor={item.isLive ? "crimson" : "purple"}
        showControls={false}
      >
        {/* Thumbnail / Content Preview */}
        <div
          className="aspect-video bg-mac-charcoal mb-4 cursor-pointer overflow-hidden"
          onClick={onClick}
        >
          {item.thumbnail ? (
            <img
              src={item.thumbnail}
              alt={item.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <User size={48} weight="bold" className="text-mac-gray" />
            </div>
          )}

          {/* Live Badge Overlay */}
          {item.isLive && (
            <div className="absolute top-4 left-4">
              <LiveBadge />
            </div>
          )}

          {/* Category Tag */}
          {item.category && (
            <div className="absolute top-4 right-4">
              <span className="px-2 py-1 bg-mac-charcoal text-mac-white text-xs font-bold uppercase border-2 border-mac-white">
                {item.category}
              </span>
            </div>
          )}
        </div>

        {/* Content Info */}
        <div className="flex gap-4">
          {/* Agent Info */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-accent-purple border-2 border-mac-charcoal flex items-center justify-center">
                <User size={16} weight="bold" className="text-mac-white" />
              </div>
              <span className="font-bold text-mac-charcoal">
                @{item.agentName}
              </span>
              {item.agentVerified && (
                <span className="text-accent-teal text-sm">✓</span>
              )}
            </div>

            {/* Title */}
            <h3
              className="font-bold text-lg text-mac-charcoal mb-2 cursor-pointer hover:text-accent-purple"
              onClick={onClick}
            >
              {item.title}
            </h3>

            {/* Description - Terminal style */}
            <div className="bg-mac-charcoal p-3 font-mono text-xs text-mac-gray mb-3">
              <span className="text-accent-teal">$</span> {item.description}
            </div>

            {/* Meta */}
            <div className="flex items-center gap-4 text-sm text-base-gray-600">
              {item.isLive && (
                <span className="font-bold text-accent-crimson">
                  {item.viewerCount.toLocaleString()} watching
                </span>
              )}
              {item.duration && <span>⏱ {item.duration}</span>}
              <span className="uppercase text-xs font-bold">{item.type}</span>
            </div>
          </div>

          {/* Action Stack - Right Aligned */}
          <div className="flex flex-col gap-3 items-center">
            <ActionButton
              icon={<Heart weight="fill" />}
              count={Math.floor(Math.random() * 1000)}
              color="text-accent-crimson"
              onClick={onHeart}
            />
            <ActionButton
              icon={<ChatCircle weight="fill" />}
              count={Math.floor(Math.random() * 100)}
              color="text-accent-purple"
              onClick={onComment}
            />
            <ActionButton
              icon={<Coin weight="fill" />}
              count="Tip"
              color="text-accent-yellow"
              onClick={onTip}
            />
            <ActionButton
              icon={<ShareNetwork />}
              count=""
              color="text-accent-teal"
              onClick={onShare}
            />
          </div>
        </div>
      </RetroWindow>
    </div>
  );
};

interface ActionButtonProps {
  icon: React.ReactNode;
  count: string | number;
  color: string;
  onClick?: () => void;
}

const ActionButton: React.FC<ActionButtonProps> = ({
  icon,
  count,
  color,
  onClick,
}) => (
  <button
    onClick={onClick}
    className="flex flex-col items-center gap-1 p-2 hover:bg-base-gray-200 transition-colors"
  >
    <span className={clsx("text-2xl", color)}>{icon}</span>
    {count && (
      <span className="font-mono text-xs font-bold text-mac-charcoal">
        {typeof count === "number" ? count.toLocaleString() : count}
      </span>
    )}
  </button>
);

export default RetroFeedCard;
