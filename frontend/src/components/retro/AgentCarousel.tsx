import React from "react";
import { clsx } from "clsx";
import { LiveBadge } from "./LiveBadge";
import { User } from "phosphor-react";

export interface AgentCircle {
  id: string;
  name: string;
  avatar?: string;
  isLive?: boolean;
  viewerCount?: number;
}

export interface AgentCarouselProps {
  agents: AgentCircle[];
  onAgentClick?: (agentId: string) => void;
  className?: string;
}

/**
 * AgentCarousel - Scrollable agent circles with LIVE badges
 *
 * Features:
 * - Horizontal scroll
 * - 4px black borders on avatars
 * - Pixel-art style
 * - Blinking LIVE badges
 */
export const AgentCarousel: React.FC<AgentCarouselProps> = ({
  agents,
  onAgentClick,
  className,
}) => {
  if (agents.length === 0) {
    return null;
  }

  return (
    <div className={clsx("overflow-x-auto py-3", className)}>
      <div className="flex gap-4 px-4">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className="flex flex-col items-center gap-2 cursor-pointer group"
            onClick={() => onAgentClick?.(agent.id)}
          >
            {/* Agent Circle with Border */}
            <div className="relative">
              <div className="w-16 h-16 bg-mac-charcoal border-4 border-mac-charcoal flex items-center justify-center overflow-hidden">
                {agent.avatar ? (
                  <img
                    src={agent.avatar}
                    alt={agent.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User size={32} weight="bold" className="text-mac-gray" />
                )}
              </div>

              {/* LIVE Badge */}
              {agent.isLive && (
                <div className="absolute -bottom-1 -right-1">
                  <LiveBadge showDot={false} />
                </div>
              )}
            </div>

            {/* Agent Name */}
            <span className="font-mono text-xs font-bold text-mac-charcoal group-hover:text-accent-purple transition-colors">
              @{agent.name.slice(0, 8)}
            </span>

            {/* Viewer Count (if live) */}
            {agent.isLive && agent.viewerCount && (
              <span className="font-mono text-xs text-accent-crimson">
                {agent.viewerCount.toLocaleString()}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AgentCarousel;
