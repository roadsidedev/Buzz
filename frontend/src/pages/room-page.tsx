/**
 * RoomPage - Room Details (CLAW-OS RETRO)
 *
 * Features:
 * - Room info header
 * - Participant agents
 * - Objective/status
 * - Join live session button
 */

import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { RetroWindow } from "@/components/retro/RetroWindow";
import { BrutalistButton } from "@/components/retro/BrutalistButton";
import { LiveBadge } from "@/components/retro/LiveBadge";
import { StoriesRow, type StoryAgent } from "@/components/retro/StoriesRow";
import { ArrowLeft, Users, Target, Clock, Hash, Play } from "phosphor-react";

interface RoomDetails {
  id: string;
  title: string;
  objective: string;
  status: "pending" | "live" | "completed";
  hostAgent: {
    id: string;
    name: string;
    avatar?: string;
  };
  participantCount: number;
  viewerCount: number;
  category?: string;
  createdAt: string;
}

export const RoomPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [room, setRoom] = useState<RoomDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRoom = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/api/v1/rooms/${id}`,
        );
        if (response.ok) {
          const data = await response.json();
          setRoom(data);
        } else {
          // Demo data for when API is not available
          setRoom({
            id: id || "demo",
            title: "DeFi Alpha Session",
            objective: "Analyze Q1 agent trends and discuss DeFi protocols",
            status: "live",
            hostAgent: {
              id: "defi-alpha",
              name: "DEFI_ALPHA",
            },
            participantCount: 3,
            viewerCount: 1240,
            category: "CRYPTO",
            createdAt: new Date().toISOString(),
          });
        }
      } catch (err) {
        setRoom({
          id: id || "demo",
          title: "DeFi Alpha Session",
          objective: "Analyze Q1 agent trends and discuss DeFi protocols",
          status: "live",
          hostAgent: {
            id: "defi-alpha",
            name: "DEFI_ALPHA",
          },
          participantCount: 3,
          viewerCount: 1240,
          category: "CRYPTO",
          createdAt: new Date().toISOString(),
        });
      } finally {
        setLoading(false);
      }
    };

    fetchRoom();
  }, [id]);

  const demoAgents: StoryAgent[] = [
    { id: "1", name: "DEFI_ALPHA", isLive: true, viewerCount: 840 },
    { id: "2", name: "CRYPTOBOT", isLive: true, viewerCount: 320 },
    { id: "3", name: "TOKENLOGIC", isLive: false },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#A0A0A0] p-4 flex items-center justify-center">
        <RetroWindow title="LOADING..." shadowColor="purple">
          <div className="p-8 text-center">
            <div className="animate-pulse font-black text-lg">
              Fetching room data...
            </div>
          </div>
        </RetroWindow>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#A0A0A0] p-2 lg:p-4">
      {/* Header */}
      <header className="bg-white border-[3px] border-black px-4 py-1.5 flex items-center justify-between shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] sticky top-0 z-50 mb-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 font-black text-sm uppercase hover:text-[#6C5CE7]"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        </div>
        <div className="flex items-center gap-2">
          {room?.status === "live" && <LiveBadge />}
        </div>
      </header>

      <main className="max-w-4xl mx-auto space-y-4">
        {/* Room Info */}
        <RetroWindow
          title={`ROOM: ${room?.id?.slice(0, 8) || "UNKNOWN"}`}
          shadowColor={room?.status === "live" ? "crimson" : "purple"}
        >
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left: Room Details */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-12 h-12 bg-[#6C5CE7] border-[3px] border-black flex items-center justify-center">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-black uppercase italic">
                    {room?.title || "Untitled Room"}
                  </h1>
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                    <span>@{room?.hostAgent.name}</span>
                    {room?.category && (
                      <span className="bg-black text-white px-2 py-0.5">
                        {room.category}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Objective */}
              <div className="bg-black border-2 border-black p-3 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-4 h-4 text-[#FFE66D]" />
                  <span className="text-xs font-black uppercase text-[#FFE66D]">
                    Objective
                  </span>
                </div>
                <p className="font-mono text-sm text-white">
                  {room?.objective || "No objective set"}
                </p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white border-2 border-black p-3 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Users className="w-4 h-4 text-[#6C5CE7]" />
                  </div>
                  <span className="text-lg font-black">
                    {room?.participantCount || 0}
                  </span>
                  <span className="text-[10px] font-bold uppercase block text-gray-500">
                    Participants
                  </span>
                </div>
                <div className="bg-white border-2 border-black p-3 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Users className="w-4 h-4 text-[#FF6B6B]" />
                  </div>
                  <span className="text-lg font-black">
                    {room?.viewerCount?.toLocaleString() || 0}
                  </span>
                  <span className="text-[10px] font-bold uppercase block text-gray-500">
                    Viewers
                  </span>
                </div>
                <div className="bg-white border-2 border-black p-3 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Clock className="w-4 h-4 text-[#4ECDC4]" />
                  </div>
                  <span className="text-lg font-black">LIVE</span>
                  <span className="text-[10px] font-bold uppercase block text-gray-500">
                    Status
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="lg:w-48 space-y-3">
              <BrutalistButton
                variant="primary"
                className="w-full"
                onClick={() => navigate(`/room/${id}/live`)}
              >
                <Play className="w-5 h-5 mr-2" weight="fill" />
                Join Live
              </BrutalistButton>

              <BrutalistButton variant="secondary" className="w-full">
                <Hash className="w-4 h-4 mr-2" />
                Copy Link
              </BrutalistButton>
            </div>
          </div>
        </RetroWindow>

        {/* Participants */}
        <RetroWindow title="PARTICIPANTS" shadowColor="teal">
          <StoriesRow agents={demoAgents} />
        </RetroWindow>
      </main>
    </div>
  );
};

export default RoomPage;
