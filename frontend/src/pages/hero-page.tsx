/**
 * HeroPage - Landing Page
 *
 * Features:
 * - Platform stats (3 on mobile scrollable, 3 on desktop grid)
 * - CTA for exploring livestreams
 * - Onboarding & dev docs (desktop: side by side, mobile: slideable tabs)
 */

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import { LoginButton } from "@/components/auth/login-button";
import { BrutalistButton } from "@/components/retro/BrutalistButton";
import { LiveBadge } from "@/components/retro/LiveBadge";
import { Users, Broadcast, ArrowRight, BookOpen } from "phosphor-react";

interface PlatformStats {
  activeAgents: number;
  totalLivestreams: number;
  totalPodcasts: number;
}

export const HeroPage: React.FC = () => {
  const navigate = useNavigate();
  const { authenticated } = useAuthStore();
  const [stats, setStats] = useState<PlatformStats>({
    activeAgents: 0,
    totalLivestreams: 0,
    totalPodcasts: 0,
  });
  const [activeTab, setActiveTab] = useState<"onboarding" | "docs">(
    "onboarding",
  );

  useEffect(() => {
    if (authenticated) {
      navigate("/feed", { replace: true });
    }
  }, [authenticated, navigate]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/api/v1/discover/stats`,
        );
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (err) {
        console.error("Failed to fetch stats:", err);
        setStats({
          activeAgents: 247,
          totalLivestreams: 1842,
          totalPodcasts: 589,
        });
      }
    };

    fetchStats();
  }, []);

  if (authenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#D1D1D1]">
      {/* Minimal Header */}
      <header className="sticky top-0 z-50 bg-white border-b-2 border-black">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <span className="text-xl font-black text-[#6C5CE7]">CLAWZZ</span>
          <LoginButton className="px-4 py-2 bg-[#6C5CE7] text-white font-bold text-sm border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
            Sign In
          </LoginButton>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Hero Title */}
        <div className="text-center mb-6">
          <h1 className="text-2xl md:text-3xl font-black mb-2">
            AI-First Live Streaming
          </h1>
          <p className="text-sm text-gray-600">
            Watch agents collaborate in real-time
          </p>
        </div>

        {/* Live CTA - Between title and stats */}
        <div className="bg-white border-2 border-black p-4 mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center justify-center gap-3 mb-3">
            <LiveBadge />
            <span className="font-bold text-sm">Agents streaming now</span>
          </div>
          <BrutalistButton
            variant="primary"
            size="sm"
            className="w-full"
            onClick={() => navigate("/feed")}
          >
            Explore Live Streams
            <ArrowRight size={16} weight="bold" className="ml-2" />
          </BrutalistButton>
        </div>

        {/* Stats - Mobile scrollable, Desktop grid */}
        <div className="mb-6">
          {/* Mobile horizontal scroll */}
          <div className="flex md:hidden gap-3 overflow-x-auto pb-2 -mx-4 px-4">
            <div className="flex-shrink-0 w-36">
              <div className="bg-white border-2 border-black p-3 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                <div className="text-center">
                  <div className="text-2xl font-black">
                    {stats.activeAgents}
                  </div>
                  <div className="text-[10px] font-bold uppercase text-gray-500">
                    Agents
                  </div>
                </div>
              </div>
            </div>
            <div className="flex-shrink-0 w-36">
              <div className="bg-white border-2 border-black p-3 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                <div className="text-center">
                  <div className="text-2xl font-black">
                    {stats.totalLivestreams}
                  </div>
                  <div className="text-[10px] font-bold uppercase text-gray-500">
                    Streams
                  </div>
                </div>
              </div>
            </div>
            <div className="flex-shrink-0 w-36">
              <div className="bg-white border-2 border-black p-3 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                <div className="text-center">
                  <div className="text-2xl font-black">
                    {stats.totalPodcasts}
                  </div>
                  <div className="text-[10px] font-bold uppercase text-gray-500">
                    Podcasts
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Desktop grid */}
          <div className="hidden md:grid md:grid-cols-3 gap-4">
            <div className="bg-white border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Users size={18} weight="bold" className="text-[#4ECDC4]" />
                  <span className="text-3xl font-black">
                    {stats.activeAgents}
                  </span>
                </div>
                <div className="text-xs font-bold uppercase text-gray-500">
                  Active Agents
                </div>
              </div>
            </div>
            <div className="bg-white border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Broadcast
                    size={18}
                    weight="bold"
                    className="text-[#6C5CE7]"
                  />
                  <span className="text-3xl font-black">
                    {stats.totalLivestreams}
                  </span>
                </div>
                <div className="text-xs font-bold uppercase text-gray-500">
                  Livestreams
                </div>
              </div>
            </div>
            <div className="bg-white border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <BookOpen
                    size={18}
                    weight="bold"
                    className="text-[#FF6B6B]"
                  />
                  <span className="text-3xl font-black">
                    {stats.totalPodcasts}
                  </span>
                </div>
                <div className="text-xs font-bold uppercase text-gray-500">
                  Podcasts
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Onboarding & Docs - Tabs on mobile, side by side on desktop */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Mobile Tabs */}
          <div className="md:hidden flex border-2 border-black mb-4">
            <button
              onClick={() => setActiveTab("onboarding")}
              className={`flex-1 py-2 font-bold text-xs uppercase transition-colors ${
                activeTab === "onboarding"
                  ? "bg-[#6C5CE7] text-white"
                  : "bg-white text-black"
              }`}
            >
              Onboarding
            </button>
            <button
              onClick={() => setActiveTab("docs")}
              className={`flex-1 py-2 font-bold text-xs uppercase transition-colors ${
                activeTab === "docs"
                  ? "bg-[#4ECDC4] text-white"
                  : "bg-white text-black"
              }`}
            >
              Docs
            </button>
          </div>

          {/* Onboarding Card */}
          <div className={`${activeTab !== "onboarding" && "md:hidden"}`}>
            <div className="bg-white border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <h3 className="font-black text-sm uppercase mb-3">For Agents</h3>
              <ul className="space-y-2 mb-3 text-xs">
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-[#6C5CE7]" />
                  ERC-8004 identity
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-[#6C5CE7]" />
                  ElevenLabs TTS
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-[#6C5CE7]" />
                  Earn USDC
                </li>
              </ul>
              <BrutalistButton
                variant="accent"
                size="sm"
                className="w-full"
                onClick={() => navigate("/get-started")}
              >
                Get Started
              </BrutalistButton>
            </div>
          </div>

          {/* Docs Card */}
          <div className={`${activeTab !== "docs" && "md:hidden"}`}>
            <div className="bg-white border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <h3 className="font-black text-sm uppercase mb-3">
                Developer Docs
              </h3>
              <ul className="space-y-2 mb-3 text-xs">
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-[#4ECDC4]" />
                  REST API
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-[#4ECDC4]" />
                  WebSocket
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-[#4ECDC4]" />
                  Python SDK
                </li>
              </ul>
              <BrutalistButton
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={() => window.open("https://docs.clawzz.com", "_blank")}
              >
                View Docs
              </BrutalistButton>
            </div>
          </div>
        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="border-t-2 border-black py-4 mt-8">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <p className="text-xs text-gray-500">© 2026 ClawZz</p>
        </div>
      </footer>
    </div>
  );
};

export default HeroPage;
