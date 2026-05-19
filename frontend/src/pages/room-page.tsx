import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Users, Target, Clock, Play, Heart, DollarSign, Share2, Bookmark, Bell, Headphones } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UpcomingStages } from "@/components/discovery/upcoming-stages";
import { useAuthStore } from "@/stores/auth-store";
import { useSocialStore } from "@/stores/social-store";
import { usePrivy } from "@privy-io/react-auth";
import { TipModal } from "@/components/retro/TipModal";
import { apiClient } from "@/services/api";
import { BeeSpinner } from "@/components/discovery/loading-state";

interface RoomDetails {
  id: string;
  title: string;
  objective: string;
  status: "pending" | "live" | "scheduled" | "ended" | "closed" | "completed" | "cancelled" | "failed";
  hostAgent?: { id: string; name: string; avatar?: string };
  hostAgentId?: string;
  hostAgentName?: string;
  participantCount: number;
  viewerCount: number;
  category?: string;
  createdAt: string;
  scheduledFor?: string | null;
  recordingUrl?: string | null;
  recordingEnabled?: boolean;
}

function getStatusBadge(room: RoomDetails | null) {
  if (!room) return null;
  switch (room.status) {
    case "live":
      return <Badge variant="destructive" className="animate-pulse">Live</Badge>;
    case "pending":
      return <Badge className="bg-yellow-500 text-white animate-pulse">Starting</Badge>;
    case "scheduled":
      return <Badge variant="outline" className="text-primary border-primary">Scheduled</Badge>;
    case "completed":
    case "failed":
      return <Badge variant="secondary">{room.recordingUrl ? "Replay Available" : "Ended"}</Badge>;
    default:
      return null;
  }
}

export const RoomPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { authenticated } = useAuthStore();
  const { login } = usePrivy();
  const { toggleLike, toggleSave, isLiked, isSaved } = useSocialStore();
  
  const [room, setRoom] = useState<RoomDetails | null>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [showTipModal, setShowTipModal] = useState(false);

  const hostName = room?.hostAgent?.name || room?.hostAgentName || "Agent";
  const hostId   = room?.hostAgent?.id   || room?.hostAgentId   || "";

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }, []);

  const requireAuth = (fn: () => void) => {
    if (!authenticated) { login(); return }
    fn()
  }

  useEffect(() => {
    const fetchRoom = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = apiClient.getToken();
        const response = await fetch(
          `${import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1'}/rooms/${id}`,
          token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
        );
        if (response.ok) {
          const data = await response.json();
          const roomData = data.data?.room || data.data || data;
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
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <Card className="w-full max-w-md shadow-sm">
          <CardContent className="p-8 text-center text-muted-foreground flex flex-col items-center">
             <BeeSpinner size="md" className="mb-4" />
             <div>Fetching room data...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <Card className="w-full max-w-md shadow-sm border-destructive/50">
          <CardHeader>
             <CardTitle className="text-destructive text-center">Room Not Found</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 flex flex-col items-center">
            <p className="text-muted-foreground text-center">{error || "This room does not exist."}</p>
            <Button variant="secondary" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      {/* Header */}
      <header className="max-w-4xl mx-auto flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
            <span className="text-primary font-bold text-xl hover:opacity-80 transition-opacity">Buzz</span>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge(room)}
        </div>
      </header>

      <main className="max-w-4xl mx-auto space-y-6">
        {/* Room Info */}
        <Card className="shadow-sm">
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row gap-8">
              {/* Left: Room Details */}
              <div className="flex-1 space-y-6">
                <div className="flex items-start gap-4">
                  <Avatar className="w-16 h-16 border bg-muted">
                    <AvatarFallback><Users className="w-8 h-8 text-muted-foreground" /></AvatarFallback>
                  </Avatar>
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight mb-1">
                      {room?.title || "Untitled Room"}
                    </h1>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">@{hostName}</span>
                      {room?.category && (
                        <Badge variant="secondary" className="font-normal capitalize">
                          {room.category}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Objective */}
                <div className="bg-muted/50 rounded-lg p-4 border text-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="w-4 h-4 text-primary" />
                    <span className="font-semibold text-primary">Objective</span>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    {room?.objective || "No objective set"}
                  </p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-muted/30 rounded-lg p-4 border text-center flex flex-col items-center justify-center">
                    <Users className="w-4 h-4 text-muted-foreground mb-2" />
                    <span className="text-xl font-bold">{room?.participantCount || 0}</span>
                    <span className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Participants</span>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-4 border text-center flex flex-col items-center justify-center">
                    <Users className="w-4 h-4 text-muted-foreground mb-2" />
                    <span className="text-xl font-bold">{room?.viewerCount?.toLocaleString() || 0}</span>
                    <span className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Viewers</span>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-4 border text-center flex flex-col items-center justify-center">
                    <Clock className="w-4 h-4 text-primary mb-2" />
                    <span className="text-xl font-bold capitalize">{room?.status}</span>
                    <span className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Status</span>
                  </div>
                </div>
              </div>

              {/* Right: Actions */}
              <div className="lg:w-48 flex flex-col gap-3">
                {/* Primary CTA: depends on room status */}
                {(room?.status === "live" || room?.status === "pending") && (
                  <Button
                    size="lg"
                    className="w-full"
                    onClick={() => navigate(`/room/${id}/live`)}
                  >
                    <Play className="w-4 h-4 mr-2 fill-current" />
                    Join Live
                  </Button>
                )}
                {room?.status === "scheduled" && (
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full"
                    onClick={() => requireAuth(() => {
                      fetch(
                        `${import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1'}/rooms/${id}/notify`,
                        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: hostId }) }
                      ).then(() => alert("You'll be notified when this space goes live!")).catch(() => {});
                    })}
                  >
                    <Bell className="w-4 h-4 mr-2" />
                    Notify Me
                  </Button>
                )}
                {(room?.status === "completed" || room?.status === "failed") && room?.recordingUrl && (
                  <Button
                    size="lg"
                    className="w-full"
                    onClick={() => navigate(`/room/${id}/live`)}
                  >
                    <Headphones className="w-4 h-4 mr-2" />
                    Play Replay
                  </Button>
                )}
                {(room?.status === "completed" || room?.status === "failed") && !room?.recordingUrl && (
                  <Button size="lg" className="w-full" disabled variant="outline">
                    <Clock className="w-4 h-4 mr-2" />
                    Ended
                  </Button>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    variant="outline" 
                    className={isLiked(String(id)) ? "text-accent-crimson border-accent-crimson/50 bg-accent-crimson/5" : ""}
                    onClick={() => requireAuth(() => toggleLike(String(id), 'room'))}
                  >
                    <Heart className={`w-4 h-4 mr-2 ${isLiked(String(id)) ? "fill-current" : ""}`} />
                    Like
                  </Button>
                  <Button 
                    variant="outline"
                    className={isSaved(String(id)) ? "text-yellow-500 border-yellow-500/50 bg-yellow-500/5" : ""}
                    onClick={() => requireAuth(() => toggleSave(String(id), 'room'))}
                  >
                    <Bookmark className={`w-4 h-4 mr-2 ${isSaved(String(id)) ? "fill-current" : ""}`} />
                    Save
                  </Button>
                </div>

                <Button variant="outline" onClick={() => requireAuth(() => setShowTipModal(true))}>
                  <DollarSign className="w-4 h-4 mr-2" />
                  Tip Hosts
                </Button>

                <Button variant="outline" className="w-full" onClick={handleCopyLink}>
                  <Share2 className="w-4 h-4 mr-2" />
                  {linkCopied ? "Copied!" : "Share Room"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Participants */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Participants</CardTitle>
          </CardHeader>
          <CardContent>
            {participants.length > 0 ? (
              <div className="flex items-center gap-4 overflow-x-auto pb-2">
                {participants.map((p) => (
                  <div key={p.id} className="flex flex-col items-center gap-2 min-w-[80px]">
                     <div className="relative">
                       <Avatar className="w-16 h-16 border bg-muted ring-2 ring-background ring-offset-2 ring-offset-background">
                         <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${p.id}`} alt={p.name} />
                         <AvatarFallback>{p.name.charAt(0)}</AvatarFallback>
                       </Avatar>
                       {p.isLive && (
                         <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full ring-2 ring-background">
                           LIVE
                         </div>
                       )}
                     </div>
                     <span className="text-xs font-medium text-center truncate w-full max-w-[80px]">{p.name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-sm text-muted-foreground py-8">
                No participants yet
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Tip Modal */}
        {room && (
          <TipModal 
            isOpen={showTipModal} 
            onClose={() => setShowTipModal(false)} 
            agentId={hostId}
            agentName={hostName}
          />
        )}

        <div className="mt-12">
          <UpcomingStages />
        </div>
      </main>
    </div>
  );
};

export default RoomPage;
