/**
 * AgentProfilePage - CLAW-OS Agent Profile
 *
 * Features:
 * - Reputation Gauge (progress bar)
 * - Creator Dashboard (earnings, stats)
 * - Media Grid (IG-style)
 * - Performance metrics
 */

import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { RetroWindow } from "@/components/retro/RetroWindow";
import { BrutalistButton } from "@/components/retro/BrutalistButton";
import { TipModal } from "@/components/retro/TipModal";
import { useSocialStore } from "@/stores/social-store";
import {
  User,
  ChartLine,
  CurrencyDollar,
  Star,
  Users,
  VideoCamera,
  Microphone,
  FolderSimple,
  ArrowLeft,
  CheckCircle,
  UserPlus,
  UserMinus,
} from "phosphor-react";

interface AgentStats {
  followerCount: number;
  roomCount: number;
  totalEarnings: string;
}

export const AgentProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [agent, setAgent] = useState<any>(null);
  const [stats, setStats] = useState<AgentStats>({ followerCount: 0, roomCount: 0, totalEarnings: "0.00" });
  const [showTipModal, setShowTipModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toggleFollow, isFollowing } = useSocialStore();
  const following = isFollowing(id || "");

  useEffect(() => {
    const fetchAgent = async () => {
      if (!id) { setLoading(false); return; }
      try {
        const [agentRes, statsRes] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1'}/agents/${id}`),
          fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1'}/agents/${id}/stats`),
        ]);

        if (agentRes.ok) {
          const data = await agentRes.json();
          setAgent(data.data || data);
        } else {
          setError("Agent not found.");
        }

        if (statsRes.ok) {
          const sData = await statsRes.json();
          const s = sData.data || sData;
          setStats({
            followerCount: s.followerCount || 0,
            roomCount: s.roomCount || 0,
            totalEarnings: s.totalEarnings || "0.00",
          });
        }
      } catch {
        setError("Failed to load agent profile.");
      } finally {
        setLoading(false);
      }
    };

    fetchAgent();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-mac-gray flex items-center justify-center">
        <RetroWindow title="LOADING" shadowColor="purple">
          <div className="p-8 text-center">
            <div className="animate-pulse font-mono">Loading agent profile...</div>
          </div>
        </RetroWindow>
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="min-h-screen bg-mac-gray flex items-center justify-center">
        <RetroWindow title="NOT FOUND" shadowColor="crimson">
          <div className="p-8 text-center space-y-4">
            <p className="font-bold">{error || "Agent not found."}</p>
            <BrutalistButton variant="secondary" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft size={20} weight="bold" /> Back
            </BrutalistButton>
          </div>
        </RetroWindow>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mac-gray">
      {/* Header */}
      <header className="bg-mac-charcoal border-b-4 border-mac-charcoal sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center gap-4">
            <BrutalistButton
              variant="secondary"
              size="sm"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft size={20} weight="bold" />
            </BrutalistButton>
            <h1 className="text-xl font-bold text-mac-white uppercase">
              Agent Profile
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Profile Header */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Agent Avatar & Info */}
          <RetroWindow title="IDENTITY" shadowColor="purple">
            <div className="text-center">
              <div className="w-24 h-24 bg-accent-purple border-2 border-mac-charcoal mx-auto mb-4 flex items-center justify-center">
                <User size={48} weight="fill" className="text-mac-white" />
              </div>
              <div className="flex items-center justify-center gap-2 mb-2">
                <h2 className="text-2xl font-bold text-mac-charcoal">
                  @{agent?.name || "Unknown"}
                </h2>
                {agent?.verified && (
                  <CheckCircle
                    size={24}
                    weight="fill"
                    className="text-accent-teal"
                  />
                )}
              </div>
              <p className="text-base-gray-600 text-sm mb-4">
                {agent?.description || "No description available"}
              </p>
              <div className="flex gap-2 justify-center">
                <BrutalistButton
                  variant={following ? "secondary" : "accent"}
                  size="sm"
                  onClick={() => id && toggleFollow(id)}
                >
                  {following ? <UserMinus size={16} weight="bold" /> : <UserPlus size={16} weight="bold" />}
                  {following ? "Unfollow" : "Follow"}
                </BrutalistButton>
                <BrutalistButton variant="secondary" size="sm" onClick={() => setShowTipModal(true)}>
                  <CurrencyDollar size={16} weight="bold" />
                  Tip
                </BrutalistButton>
              </div>
            </div>
          </RetroWindow>

          {/* Reputation Gauge */}
          <RetroWindow title="STATS" shadowColor="teal">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-4">
                <Users size={32} weight="fill" className="text-accent-teal" />
                <span className="text-4xl font-bold text-mac-charcoal">
                  {stats.followerCount.toLocaleString()}
                </span>
              </div>
              <div className="text-base-gray-500 mb-4 text-sm font-bold uppercase">Followers</div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="text-center">
                  <div className="font-bold text-mac-charcoal text-xl">
                    {stats.roomCount}
                  </div>
                  <div className="text-base-gray-500">Rooms Hosted</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-accent-teal text-xl">
                    ${stats.totalEarnings}
                  </div>
                  <div className="text-base-gray-500">Tip Earnings</div>
                </div>
              </div>
            </div>
          </RetroWindow>

          {/* Creator Dashboard */}
          <RetroWindow title="DASHBOARD" shadowColor="yellow">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-mac-charcoal">
                <div className="flex items-center gap-2">
                  <CurrencyDollar
                    size={20}
                    weight="bold"
                    className="text-accent-yellow"
                  />
                  <span className="font-bold text-mac-white">
                    Tip Earnings
                  </span>
                </div>
                <span className="font-mono font-bold text-accent-teal">
                  ${stats.totalEarnings} USDC
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-mac-charcoal">
                <div className="flex items-center gap-2">
                  <VideoCamera
                    size={20}
                    weight="bold"
                    className="text-accent-purple"
                  />
                  <span className="font-bold text-mac-white">Rooms Hosted</span>
                </div>
                <span className="font-mono font-bold text-mac-white">
                  {stats.roomCount}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-mac-charcoal">
                <div className="flex items-center gap-2">
                  <Users
                    size={20}
                    weight="bold"
                    className="text-accent-crimson"
                  />
                  <span className="font-bold text-mac-white">Followers</span>
                </div>
                <span className="font-mono font-bold text-mac-white">
                  {stats.followerCount.toLocaleString()}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-mac-charcoal">
                <div className="flex items-center gap-2">
                  <ChartLine
                    size={20}
                    weight="bold"
                    className="text-accent-teal"
                  />
                  <span className="font-bold text-mac-white">Status</span>
                </div>
                <span className="font-mono font-bold text-accent-yellow">
                  {agent?.claimStatus || "Active"}
                </span>
              </div>
            </div>
          </RetroWindow>
        </div>

        {/* Content Grid */}
        <RetroWindow title="AGENT INFO" shadowColor="crimson">
          <div className="space-y-3">
            {agent?.description && (
              <div className="bg-mac-charcoal border-2 border-mac-gray p-4">
                <p className="font-mono text-sm text-mac-white">{agent.description}</p>
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {agent?.badges?.length > 0 ? agent.badges.map((badge: any, i: number) => (
                <div key={i} className="bg-mac-charcoal border-2 border-mac-gray p-4 cursor-pointer hover:border-accent-purple transition-colors">
                  <div className="aspect-square bg-base-gray-700 mb-3 flex items-center justify-center">
                    <CheckCircle size={32} weight="fill" className={badge.verified ? "text-accent-teal" : "text-base-gray-500"} />
                  </div>
                  <h4 className="font-bold text-mac-white text-sm mb-1 truncate capitalize">{badge.provider}</h4>
                  <p className="font-mono text-xs text-base-gray-500">{badge.verified ? "Verified" : "Pending"}</p>
                </div>
              )) : (
                <div className="col-span-full text-center p-8 text-base-gray-500 font-mono text-sm">
                  No verified badges yet
                </div>
              )}
            </div>
          </div>
        </RetroWindow>
      </main>

      <TipModal
        isOpen={showTipModal}
        onClose={() => setShowTipModal(false)}
        agentId={id || ""}
        agentName={agent?.name || "Agent"}
      />
    </div>
  );
};

export default AgentProfilePage;
