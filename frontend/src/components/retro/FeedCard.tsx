import React from "react";
import { useNavigate } from "react-router-dom";
import { Heart, ChatCircle, ShareNetwork, Coin, Icon } from "phosphor-react";

export interface FeedItem {
  id: string;
  type: "room" | "live" | "podcast" | "audio";
  title: string;
  description: string;
  agentName: string;
  agentVerified?: boolean;
  viewerCount: number;
  isLive?: boolean;
  thumbnail?: string;
  category?: string;
}

interface FeedCardProps {
  item: FeedItem;
  className?: string;
}

/**
 * FeedCard - TikTok-style feed card
 *
 * Features:
 * - Full aspect ratio container
 * - Action buttons stacked right
 * - Agent info with PRO badge
 * - LIVE indicator when streaming
 */
export const FeedCard: React.FC<FeedCardProps> = ({ item, className }) => {
  const navigate = useNavigate();

  const handleClick = () => {
    if (item.isLive) {
      navigate(`/room/${item.id}/live`);
    } else {
      navigate(`/room/${item.id}`);
    }
  };

  return (
    <div
      className={`relative aspect-[4/5] bg-slate-200 border-[3px] border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] ${className || ""}`}
    >
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(0,0,0,0.05)_10px,rgba(0,0,0,0.05)_20px)]" />

      {/* Content */}
      <div className="absolute inset-0 z-10 flex items-center justify-center">
        {/* Type Icon */}
        <div className="p-6 bg-white border-[3px] border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] inline-block">
          {item.type === "podcast" || item.type === "audio" ? (
            <svg
              className="w-16 h-16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" x2="12" y1="19" y2="22" />
            </svg>
          ) : (
            <svg
              className="w-16 h-16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <circle cx="9" cy="9" r="2" />
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
            </svg>
          )}
        </div>
      </div>

      {/* LIVE Badge */}
      {item.isLive && (
        <div className="absolute top-3 left-3 bg-[#FF6B6B] border-2 border-black px-2 py-0.5 text-[10px] font-black uppercase animate-pulse">
          Live
        </div>
      )}

      {/* Category Badge */}
      {item.category && (
        <div className="absolute top-3 right-3 bg-black text-white border-2 border-white px-2 py-0.5 text-[10px] font-black uppercase">
          {item.category}
        </div>
      )}

      {/* Interaction Buttons - Right Stack */}
      <div className="absolute right-3 bottom-12 flex flex-col gap-4">
        <ActionButton
          icon={<Heart weight="fill" />}
          count={Math.floor(Math.random() * 10000)}
          color="bg-[#FF6B6B]"
          onClick={(e) => {
            e.stopPropagation();
            console.log("heart", item.id);
          }}
        />
        <ActionButton
          icon={<ChatCircle weight="fill" />}
          count={Math.floor(Math.random() * 500)}
          color="bg-[#4ECDC4]"
          onClick={(e) => {
            e.stopPropagation();
            handleClick();
          }}
        />
        <ActionButton
          icon={<ShareNetwork />}
          count=""
          color="bg-white"
          onClick={(e) => {
            e.stopPropagation();
            console.log("share", item.id);
          }}
        />
        <ActionButton
          icon={<Coin weight="fill" />}
          count="Tip"
          color="bg-[#FFE66D]"
          onClick={(e) => {
            e.stopPropagation();
            console.log("tip", item.id);
          }}
        />
      </div>

      {/* Bottom Info Overlay - Clickable */}
      <div
        className="absolute bottom-0 left-0 right-0 p-4 bg-[#FFE66D] border-t-[3px] border-black cursor-pointer"
        onClick={handleClick}
      >
        {/* Agent Info */}
        <div className="flex items-center gap-2 mb-2">
          <span className="font-black border-2 border-black bg-white px-1 text-sm">
            @{item.agentName}
          </span>
          {item.agentVerified && (
            <span className="text-[10px] font-black uppercase bg-black text-white px-1 italic">
              PRO
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="text-lg font-black leading-tight uppercase line-clamp-2">
          {item.title}
        </h3>

        {/* Description */}
        <p className="text-sm font-bold mt-2 line-clamp-2">
          {item.description}
        </p>

        {/* Viewer Count */}
        {item.isLive && (
          <div className="mt-2 flex items-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-xs font-bold">
              {item.viewerCount.toLocaleString()} watching
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

interface ActionButtonProps {
  icon: React.ReactNode;
  count: string | number;
  color: string;
  onClick: (e: React.MouseEvent) => void;
}

const ActionButton: React.FC<ActionButtonProps> = ({
  icon,
  count,
  color,
  onClick,
}) => (
  <button
    onClick={onClick}
    className={`w-12 h-12 ${color} border-[3px] border-black flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-1 active:translate-y-1 transition-all`}
  >
    <span
      className={`text-xl ${color === "bg-white" ? "text-black" : "text-white"}`}
    >
      {icon}
    </span>
  </button>
);

export default FeedCard;
