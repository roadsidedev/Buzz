import React from "react";
import { useNavigate } from "react-router-dom";
import { User } from "phosphor-react";

export interface StoryAgent {
  id: string;
  name: string;
  avatar?: string;
  isLive?: boolean;
  viewerCount?: number;
}

interface StoriesRowProps {
  agents: StoryAgent[];
  onAgentClick?: (agentId: string) => void;
  className?: string;
}

/**
 * StoriesRow - Horizontal scrolling agent circles
 *
 * Matches prototype:
 * - Horizontal scroll with hidden scrollbar
 * - Agent circles with border
 * - LIVE badge positioned top-right
 * - Agent name truncated
 */
export const StoriesRow: React.FC<StoriesRowProps> = ({
  agents,
  onAgentClick,
  className,
}) => {
  const navigate = useNavigate();

  if (agents.length === 0) {
    return null;
  }

  return (
    <div
      className={`p-4 overflow-x-auto no-scrollbar flex gap-4 bg-[#BDBDBD] border-b-[3px] border-black ${className || ""}`}
      style={{
        scrollbarWidth: "none",
        msOverflowStyle: "none",
      }}
    >
      {agents.map((agent) => (
        <div
          key={agent.id}
          className="flex flex-col items-center gap-2 min-w-[70px] cursor-pointer group"
          onClick={() => {
            if (onAgentClick) {
              onAgentClick(agent.id);
            } else {
              navigate(`/profile/agent/${agent.id}`);
            }
          }}
        >
          {/* Agent Circle */}
          <div className="w-16 h-16 border-[3px] border-black bg-white p-1 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] relative group-hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-shadow">
            {agent.avatar ? (
              <img
                src={agent.avatar}
                alt={agent.name}
                className="w-full h-full bg-slate-100 rounded-sm"
              />
            ) : (
              <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                <User className="w-8 h-8 text-slate-400" />
              </div>
            )}

            {/* LIVE Badge */}
            {agent.isLive && (
              <div className="absolute -top-2 -right-2 bg-[#FF6B6B] border-2 border-black px-1 text-[8px] font-black uppercase animate-pulse">
                Live
              </div>
            )}
          </div>

          {/* Agent Name */}
          <span className="text-[9px] font-black uppercase truncate w-full text-center text-black">
            {agent.name}
          </span>

          {/* Viewer Count (if live) */}
          {agent.isLive && agent.viewerCount && (
            <span className="text-[8px] font-bold text-[#FF6B6B]">
              {agent.viewerCount.toLocaleString()}
            </span>
          )}
        </div>
      ))}
    </div>
  );
};

export default StoriesRow;
