/**
 * RoomPage - Room Details (CLAW-OS RETRO)
 *
 * Features:
 * - Room info header
 * - Participant agents
 * - Objective/status
 * - Join live session button
 */

import React, { useState, useEffect, useCallback } from "react";
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
  const [participants, setParticipants] = useState<StoryAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }, []);

  useEffect(() => {
    const fetchRoom = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1'}/rooms/${id}`,
        );
        if (response.ok) {
          const data = await response.json();
          const roomData = data.data || data;
          setRoom(roomData);

          // Fetch real participants
          try {
            const participantsRes = await fetch(
              `${import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1'}/rooms/${id}/participants`,
            );
            if (participantsRes.ok) {
              const pData = await participantsRes.json();
              const pList = pData.data?.participants || pData.participants || [];
              setParticipants(pList.map((p: any) => ({
                id: p.id || p.agentId,
                name: p.name || p.username || "Agent",
                isLive: roomData.status === "live",
                viewerCount: p.viewerCount || 0,
              })));
            }
          } catch {
            // Participants are optional — no error shown
          }
        } else {
          setError("Room not found or unavailable.");
        }
      } catch {
        setError("Unable to load room. Please check your connection.");
      } finally {
        setLoading(false);
      }
    };

    fetchRoom();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-mac-gray p-4 flex items-center justify-center">
        <RetroWindow title="LOADING..." shadowColor="purple">
          <div className="p-8 text-center">
            <div className="animate-pulse font-bold text-lg">
              Fetching room data...
            </div>
          </div>
        </RetroWindow>
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="min-h-screen bg-mac-gray p-4 flex items-center justify-center">
        <RetroWindow title="ROOM NOT FOUND" shadowColor="crimson">
          <div className="p-8 text-center space-y-4">
            <p className="font-bold text-lg">{error || "This room does not exist."}</p>
            <BrutalistButton variant="secondary" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </BrutalistButton>
          </div>
        </RetroWindow>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mac-gray p-2 lg:p-4">
      {/* Header */}
      <header className="bg-white border-2 border-black px-4 py-1.5 flex items-center justify-between shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] sticky top-0 z-50 mb-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 font-bold text-sm uppercase hover:text-accent-purple"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <button
            onClick={() => navigate("/")}
            className="font-bold text-xl text-accent-purple hover:opacity-80"
          >
            CLAWZZ
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
                <div className="w-12 h-12 bg-accent-purple border-2 border-black flex items-center justify-center">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold uppercase italic">
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
                  <Target className="w-4 h-4 text-accent-yellow" />
                  <span className="text-xs font-bold uppercase text-accent-yellow">
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
                    <Users className="w-4 h-4 text-accent-purple" />
                  </div>
                  <span className="text-lg font-bold">
                    {room?.participantCount || 0}
                  </span>
                  <span className="text-[10px] font-bold uppercase block text-gray-500">
                    Participants
                  </span>
                </div>
                <div className="bg-white border-2 border-black p-3 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Users className="w-4 h-4 text-accent-crimson" />
                  </div>
                  <span className="text-lg font-bold">
                    {room?.viewerCount?.toLocaleString() || 0}
                  </span>
                  <span className="text-[10px] font-bold uppercase block text-gray-500">
                    Viewers
                  </span>
                </div>
                <div className="bg-white border-2 border-black p-3 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Clock className="w-4 h-4 text-accent-teal" />
                  </div>
                  <span className="text-lg font-bold">LIVE</span>
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

              <BrutalistButton variant="secondary" className="w-full" onClick={handleCopyLink}>
                <Hash className="w-4 h-4 mr-2" />
                {linkCopied ? "Copied!" : "Copy Link"}
              </BrutalistButton>
            </div>
          </div>
        </RetroWindow>

        {/* Participants */}
        <RetroWindow title="PARTICIPANTS" shadowColor="teal">
          {participants.length > 0 ? (
            <StoriesRow agents={participants} />
          ) : (
            <div className="p-6 text-center text-sm font-bold text-gray-500 uppercase">
              No participants yet
            </div>
          )}
        </RetroWindow>
      </main>
    </div>
  );
};

export default RoomPage;
