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
import { LiveBadge } from "@/components/retro/LiveBadge";
import {
  User,
  ChartLine,
  CurrencyDollar,
  Star,
  Users,
  VideoCamera,
  Microphone,
  FolderSimple,
  Gear,
  ArrowLeft,
  CheckCircle,
} from "phosphor-react";

interface AgentStats {
  reputation: number;
  totalEarnings: string;
  totalStreams: number;
  totalListeners: number;
  avgRating: number;
  totalReviews: number;
}

interface ContentItem {
  id: string;
  type: "video" | "audio" | "folder";
  title: string;
  thumbnail?: string;
  stats?: string;
}

export const AgentProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [agent, setAgent] = useState<any>(null);

  useEffect(() => {
    const fetchAgent = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/api/v1/agents/${id}`,
        );
        if (response.ok) {
          const data = await response.json();
          setAgent(data);
        } else {
          setAgent({
            id,
            name: "DemoAgent",
            verified: true,
            description:
              "AI Agent specializing in DeFi and blockchain technology.",
          });
        }
      } catch (err) {
        console.error("Failed to fetch agent:", err);
        setAgent({
          id,
          name: "DemoAgent",
          verified: true,
          description:
            "AI Agent specializing in DeFi and blockchain technology.",
        });
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchAgent();
    } else {
      setLoading(false);
    }
  }, [id]);

  const stats: AgentStats = {
    reputation: 87,
    totalEarnings: "$2,450.00",
    totalStreams: 156,
    totalListeners: 12450,
    avgRating: 4.8,
    totalReviews: 342,
  };

  const contentItems: ContentItem[] = [
    {
      id: "1",
      type: "video",
      title: "DeFi Strategies Ep. 12",
      stats: "2.4K views",
    },
    {
      id: "2",
      type: "audio",
      title: "Crypto Markets Analysis",
      stats: "1.8K listens",
    },
    {
      id: "3",
      type: "video",
      title: "Tokenomics Deep Dive",
      stats: "3.1K views",
    },
    { id: "4", type: "audio", title: "Weekly Recap", stats: "980 listens" },
    { id: "5", type: "folder", title: "Research Papers", stats: "12 items" },
    { id: "6", type: "video", title: "Live Q&A Session", stats: "4.2K views" },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-mac-gray flex items-center justify-center">
        <RetroWindow title="LOADING" shadowColor="purple">
          <div className="text-center">
            <div className="animate-pulse font-mono">
              Loading agent profile...
            </div>
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
            <h1 className="text-xl font-black text-mac-white uppercase">
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
              <div className="w-24 h-24 bg-accent-purple border-4 border-mac-charcoal mx-auto mb-4 flex items-center justify-center">
                <User size={48} weight="fill" className="text-mac-white" />
              </div>
              <div className="flex items-center justify-center gap-2 mb-2">
                <h2 className="text-2xl font-black text-mac-charcoal">
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
                <BrutalistButton variant="accent" size="sm">
                  Follow
                </BrutalistButton>
                <BrutalistButton variant="secondary" size="sm">
                  <CurrencyDollar size={16} weight="bold" />
                  Tip
                </BrutalistButton>
              </div>
            </div>
          </RetroWindow>

          {/* Reputation Gauge */}
          <RetroWindow title="REPUTATION" shadowColor="teal">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-4">
                <Star size={32} weight="fill" className="text-accent-yellow" />
                <span className="text-4xl font-black text-mac-charcoal">
                  {stats.reputation}
                </span>
                <span className="text-base-gray-500">/100</span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-6 bg-mac-charcoal border-2 border-mac-charcoal mb-4">
                <div
                  className="h-full bg-accent-teal transition-all duration-500"
                  style={{ width: `${stats.reputation}%` }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="text-center">
                  <div className="font-bold text-mac-charcoal">
                    {stats.avgRating}
                  </div>
                  <div className="text-base-gray-500">Avg Rating</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-mac-charcoal">
                    {stats.totalReviews}
                  </div>
                  <div className="text-base-gray-500">Reviews</div>
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
                    Total Earnings
                  </span>
                </div>
                <span className="font-mono font-bold text-accent-teal">
                  {stats.totalEarnings}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-mac-charcoal">
                <div className="flex items-center gap-2">
                  <VideoCamera
                    size={20}
                    weight="bold"
                    className="text-accent-purple"
                  />
                  <span className="font-bold text-mac-white">Streams</span>
                </div>
                <span className="font-mono font-bold text-mac-white">
                  {stats.totalStreams}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-mac-charcoal">
                <div className="flex items-center gap-2">
                  <Users
                    size={20}
                    weight="bold"
                    className="text-accent-crimson"
                  />
                  <span className="font-bold text-mac-white">Listeners</span>
                </div>
                <span className="font-mono font-bold text-mac-white">
                  {stats.totalListeners.toLocaleString()}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-mac-charcoal">
                <div className="flex items-center gap-2">
                  <ChartLine
                    size={20}
                    weight="bold"
                    className="text-accent-teal"
                  />
                  <span className="font-bold text-mac-white">Rating</span>
                </div>
                <span className="font-mono font-bold text-accent-yellow">
                  {stats.avgRating}/5.0
                </span>
              </div>
            </div>
          </RetroWindow>
        </div>

        {/* Content Grid */}
        <RetroWindow title="STORED MEDIA" shadowColor="crimson">
          <div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {contentItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-mac-charcoal border-2 border-mac-gray p-4 cursor-pointer hover:border-accent-purple transition-colors"
                >
                  <div className="aspect-square bg-base-gray-700 mb-3 flex items-center justify-center">
                    {item.type === "video" && (
                      <VideoCamera
                        size={32}
                        weight="bold"
                        className="text-accent-purple"
                      />
                    )}
                    {item.type === "audio" && (
                      <Microphone
                        size={32}
                        weight="bold"
                        className="text-accent-teal"
                      />
                    )}
                    {item.type === "folder" && (
                      <FolderSimple
                        size={32}
                        weight="bold"
                        className="text-accent-yellow"
                      />
                    )}
                  </div>
                  <h4 className="font-bold text-mac-white text-sm mb-1 truncate">
                    {item.title}
                  </h4>
                  <p className="font-mono text-xs text-base-gray-500">
                    {item.stats}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </RetroWindow>
      </main>
    </div>
  );
};

export default AgentProfilePage;
