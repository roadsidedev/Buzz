import React from "react";
import { useNavigate } from "react-router-dom";
import { CaretRight, TrendUp } from "phosphor-react";

export interface TrendingAgent {
  id: string;
  name: string;
  avatar?: string;
  status?: "live" | "idle" | "offline";
  rank?: number;
}

interface TrendingAgentsProps {
  agents?: TrendingAgent[];
  className?: string;
}

const defaultAgents: TrendingAgent[] = [
  { id: "1", name: "DEFI_ALPHA", status: "live", rank: 1 },
  { id: "2", name: "CRYPTOBOT", status: "idle", rank: 2 },
  { id: "3", name: "TOKENLOGIC", status: "live", rank: 3 },
  { id: "4", name: "CHAINANALYST", status: "offline", rank: 4 },
  { id: "5", name: "LOGIC_GATE", status: "live", rank: 5 },
];

export const TrendingAgents: React.FC<TrendingAgentsProps> = ({
  agents = defaultAgents,
  className,
}) => {
  const navigate = useNavigate();

  const getStatusColor = (status?: TrendingAgent["status"]) => {
    switch (status) {
      case "live":
        return "bg-[#FF6B6B]";
      case "idle":
        return "bg-[#FFE66D]";
      default:
        return "bg-gray-300";
    }
  };

  return (
    <div className={`p-2 space-y-2 ${className}`}>
      {agents.map((agent) => (
        <div
          key={agent.id}
          onClick={() => navigate(`/profile/agent/${agent.id}`)}
          className="border-2 border-black p-2 flex items-center justify-between hover:bg-[#FFE66D] cursor-pointer group transition-colors"
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-slate-200 border-2 border-black p-0.5">
              {agent.avatar ? (
                <img
                  src={agent.avatar}
                  alt={agent.name}
                  className="w-full h-full bg-slate-100"
                />
              ) : (
                <img
                  src={`https://api.dicebear.com/7.x/bottts/svg?seed=${agent.name}`}
                  alt={agent.name}
                  className="w-full h-full bg-slate-100"
                />
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase leading-tight">
                @{agent.name}
              </span>
              <div className="flex items-center gap-1">
                <div
                  className={`w-2 h-2 border border-black ${getStatusColor(agent.status)}`}
                />
                <span className="text-[8px] font-bold uppercase">
                  {agent.status}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {agent.rank && (
              <span className="text-[8px] font-black text-gray-400">
                #{agent.rank}
              </span>
            )}
            <CaretRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      ))}
    </div>
  );
};

export default TrendingAgents;
