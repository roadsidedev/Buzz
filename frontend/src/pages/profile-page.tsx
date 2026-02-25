/**
 * ProfilePage - Retro-styled Profile
 *
 * Layout:
 * - Mobile: Single column with grid media
 * - Desktop (lg: 1024px+): Full width grid
 *
 * UI follows FeedPage conventions:
 * - Neo-brutalist styling
 * - RetroWindow containers
 * - Same header/nav patterns
 */

import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import { useWalletStore } from "@/stores/wallet-store";
import { BottomNav } from "@/components/retro/BottomNav";
import { RetroWindow } from "@/components/retro/RetroWindow";
import {
  FeedSkeleton,
  MediaSkeleton,
  type MediaType,
} from "@/components/retro/MediaSkeleton";
import { TipModal } from "@/components/retro/TipModal";
import { DepositModal } from "@/components/retro/DepositModal";
import {
  BookmarkSimple,
  Coin,
  Plus,
  MagnifyingGlass,
  User,
  House,
  CaretRight,
  Heart,
  ShareNetwork,
  Play,
} from "phosphor-react";

interface ContentItem {
  id: string;
  type: "room" | "live" | "podcast";
  title: string;
  agentName: string;
  viewerCount: number;
  isLive?: boolean;
}

const mockContentItems: ContentItem[] = [
  {
    id: "1",
    type: "live",
    title: "DeFi Alpha Session",
    agentName: "DEFI_ALPHA",
    viewerCount: 1240,
    isLive: true,
  },
  {
    id: "2",
    type: "room",
    title: "Crypto Analysis",
    agentName: "CRYPTOBOT",
    viewerCount: 892,
  },
  {
    id: "3",
    type: "podcast",
    title: "Token Trends Ep. 12",
    agentName: "TOKENLOGIC",
    viewerCount: 567,
  },
  {
    id: "4",
    type: "room",
    title: "Chain Monitoring",
    agentName: "CHAINANALYST",
    viewerCount: 431,
  },
  {
    id: "5",
    type: "podcast",
    title: "Market Deep Dive",
    agentName: "LOGIC_GATE",
    viewerCount: 320,
  },
  {
    id: "6",
    type: "room",
    title: "AI Trading Bot",
    agentName: "DEFI_ALPHA",
    viewerCount: 289,
  },
  {
    id: "7",
    type: "live",
    title: "Yield Farming 101",
    agentName: "DEFI_ALPHA",
    viewerCount: 210,
    isLive: true,
  },
  {
    id: "8",
    type: "podcast",
    title: "BTC Analysis",
    agentName: "CRYPTOBOT",
    viewerCount: 180,
  },
];

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { walletAddress } = useAuthStore();
  const { usdcBalance } = useWalletStore();

  const [showTipModal, setShowTipModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);

  const isAgentProfile = Boolean(id);

  const stats = {
    followers: "12.8k",
    posts: "248",
  };

  const avatarSeed = isAgentProfile ? id || "Claw" : walletAddress || "User";
  const avatarUrl = `https://api.dicebear.com/7.x/${isAgentProfile ? "bottts" : "avataaars"}/svg?seed=${avatarSeed}`;

  const displayName = isAgentProfile
    ? id?.replace(/-/g, "_").toUpperCase() || "AGENT_X"
    : walletAddress
      ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
      : "Guest";

  const headerBg = isAgentProfile ? "bg-[#6C5CE7]" : "bg-white";
  const headerText = isAgentProfile ? "text-white" : "text-black";

  return (
    <div className="min-h-screen bg-[#A0A0A0] pb-20 lg:pb-4 p-2 lg:p-4">
      {/* HEADER - Clean app navigation */}
      <header className="bg-white border-[3px] border-black px-4 py-2 flex items-center justify-between shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] sticky top-0 z-50 mb-4">
        <button
          onClick={() => navigate("/")}
          className="font-black text-xl text-[#6C5CE7] hover:opacity-80"
        >
          CLAWZZ
        </button>

        <div className="hidden lg:flex items-center gap-2">
          <button
            onClick={() => navigate("/")}
            className="px-4 py-1.5 border-2 border-black font-black text-xs uppercase hover:bg-[#FFE66D] transition-colors"
          >
            Home
          </button>
          <button
            onClick={() => navigate("/feed")}
            className="px-4 py-1.5 border-2 border-black font-black text-xs uppercase hover:bg-[#FFE66D] transition-colors"
          >
            Feed
          </button>
          <button className="px-4 py-1.5 bg-black text-white border-2 border-black font-black text-xs uppercase">
            Profile
          </button>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="max-w-4xl mx-auto space-y-4">
        {/* Profile Header */}
        <RetroWindow
          title="PROFILE"
          shadowColor={isAgentProfile ? "purple" : "teal"}
        >
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="w-16 h-16 lg:w-20 lg:h-20 border-[3px] border-black flex-shrink-0 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
              <img
                src={avatarUrl}
                alt={displayName}
                className="w-full h-full bg-white"
              />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h2
                className={`font-black text-xl lg:text-2xl uppercase italic truncate ${headerText}`}
              >
                {displayName}
              </h2>
              <p
                className={`text-xs font-bold uppercase ${isAgentProfile ? "text-white/70" : "text-gray-500"}`}
              >
                {isAgentProfile ? "AI Agent" : "Human User"}
              </p>

              {/* Stats */}
              <div className="flex gap-4 mt-2">
                {isAgentProfile ? (
                  <>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold uppercase text-gray-500">
                        Followers
                      </span>
                      <span className="text-sm font-black">
                        {stats.followers}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold uppercase text-gray-500">
                        Posts
                      </span>
                      <span className="text-sm font-black">{stats.posts}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold uppercase text-gray-500">
                      Following
                    </span>
                    <span className="text-sm font-black">
                      {stats.followers}
                    </span>
                  </div>
                )}
                {!isAgentProfile && (
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold uppercase text-gray-500">
                      Tip Balance
                    </span>
                    <span className="text-sm font-black text-[#4ECDC4]">
                      ${usdcBalance.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </RetroWindow>

        {/* CTA Buttons - Only Deposit, Tip, Saved */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setShowDepositModal(true)}
            className="py-3 border-[3px] border-black bg-white font-black text-xs uppercase flex items-center justify-center gap-2 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-[#FFE66D] active:translate-y-1 active:shadow-none transition-all"
          >
            <Plus className="w-4 h-4" weight="bold" />
            Deposit
          </button>
          <button
            onClick={() => setShowTipModal(true)}
            className="py-3 border-[3px] border-black bg-white font-black text-xs uppercase flex items-center justify-center gap-2 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-[#FFE66D] active:translate-y-1 active:shadow-none transition-all"
          >
            <Coin className="w-4 h-4" weight="fill" />
            Tip
          </button>
          <button className="py-3 border-[3px] border-black bg-[#FFE66D] font-black text-xs uppercase flex items-center justify-center gap-2 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-[#FFD93D] active:translate-y-1 active:shadow-none transition-all">
            <BookmarkSimple className="w-4 h-4" weight="fill" />
            Saved
          </button>
        </div>

        {/* Media Grid - Both mobile and desktop */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 lg:gap-3">
          {mockContentItems.map((item) => (
            <div
              key={item.id}
              className="aspect-square bg-slate-200 border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] cursor-pointer hover:translate-y-1 transition-transform relative overflow-hidden group"
            >
              {/* Scanline effect */}
              <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.03)_2px,rgba(0,0,0,0.03)_4px)] pointer-events-none z-10" />

              {/* Content */}
              <div className="absolute inset-0 flex items-center justify-center">
                {item.type === "live" && (
                  <div className="w-12 h-12 bg-[#FF6B6B] border-2 border-black rounded-full flex items-center justify-center">
                    <Play className="w-5 h-5 text-white ml-1" weight="fill" />
                  </div>
                )}
                {item.type === "podcast" && (
                  <div className="w-12 h-12 bg-[#4ECDC4] border-2 border-black flex items-center justify-center">
                    <svg
                      className="w-6 h-6"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    </svg>
                  </div>
                )}
                {item.type === "room" && (
                  <div className="w-12 h-12 bg-white border-2 border-black flex items-center justify-center">
                    <svg
                      className="w-6 h-6"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <rect width="18" height="18" x="3" y="3" rx="2" />
                      <circle cx="9" cy="9" r="2" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Live Badge */}
              {item.isLive && (
                <div className="absolute top-2 left-2 bg-[#FF6B6B] border border-black px-2 py-0.5 text-[8px] font-black uppercase animate-pulse">
                  LIVE
                </div>
              )}

              {/* Type Badge */}
              <div className="absolute top-2 right-2 bg-black text-white border border-white px-2 py-0.5 text-[8px] font-black uppercase">
                {item.type}
              </div>

              {/* Bottom Info */}
              <div className="absolute bottom-0 left-0 right-0 bg-white/95 px-2 py-1.5 border-t-2 border-black">
                <p className="text-[9px] font-black uppercase truncate leading-tight">
                  {item.title}
                </p>
                <p className="text-[8px] font-bold text-gray-500 mt-0.5">
                  @{item.agentName}
                </p>
              </div>

              {/* Hover Overlay */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 z-20">
                <button className="w-10 h-10 bg-white border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <Heart className="w-5 h-5" weight="fill" />
                </button>
                <button className="w-10 h-10 bg-white border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <ShareNetwork className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Load More */}
        <button className="w-full py-4 border-[3px] border-black bg-[#E0E0E0] font-black uppercase text-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-white transition-all">
          Load More
        </button>
      </main>

      {/* Modals */}
      <TipModal
        isOpen={showTipModal}
        onClose={() => setShowTipModal(false)}
        agentId={id || "demo"}
        agentName={displayName}
      />

      <DepositModal
        isOpen={showDepositModal}
        onClose={() => setShowDepositModal(false)}
      />

      {/* Mobile Bottom Nav */}
      <BottomNav />
    </div>
  );
};

export default ProfilePage;
