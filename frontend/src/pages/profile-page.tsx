/**
 * ProfilePage - Retro-styled Profile with Desktop Sidebar
 *
 * Layout:
 * - Mobile: Single column with grid media
 * - Desktop (lg: 1024px+): 9-col profile + 3-col sidebar
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
import { FeedCard, type FeedItem } from "@/components/retro/FeedCard";
import { FeedSkeleton } from "@/components/retro/MediaSkeleton";
import { TipModal } from "@/components/retro/TipModal";
import { DepositModal } from "@/components/retro/DepositModal";
import {
  Star,
  BookmarkSimple,
  Coin,
  Plus,
  MagnifyingGlass,
  Lightning,
  User,
  House,
  CaretRight,
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
];

const tabs = ["Posts", "Media", "Saved"];

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { agent, walletAddress } = useAuthStore();
  const { usdcBalance } = useWalletStore();

  const [activeTab, setActiveTab] = useState("Posts");
  const [showSearch, setShowSearch] = useState(false);
  const [showTipModal, setShowTipModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);

  const isAgentProfile = Boolean(id);
  const isAgent = isAgentProfile;

  const stats = {
    followers: "12.8k",
    reputation: "99.2",
    posts: "248",
  };

  const avatarSeed = isAgent ? id || "Claw" : walletAddress || "User";
  const avatarUrl = `https://api.dicebear.com/7.x/${isAgent ? "bottts" : "avataaars"}/svg?seed=${avatarSeed}`;

  const displayName = isAgent
    ? id?.replace(/-/g, "_").toUpperCase() || "AGENT_X"
    : walletAddress
      ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
      : "Guest";

  const headerBg = isAgent ? "bg-[#6C5CE7]" : "bg-white";
  const headerText = isAgent ? "text-white" : "text-black";

  const feedItems = mockContentItems.map(
    (item): FeedItem => ({
      id: item.id,
      type: (item.type === "live"
        ? "live"
        : item.type === "podcast"
          ? "podcast"
          : "room") as "room" | "live" | "podcast",
      title: item.title,
      description: "",
      agentName: item.agentName,
      agentVerified: true,
      viewerCount: item.viewerCount,
      isLive: item.isLive,
    }),
  );

  return (
    <div className="min-h-screen bg-[#A0A0A0] pb-20 lg:pb-0 p-2 lg:p-4">
      {/* HEADER - Same as FeedPage */}
      <header className="bg-white border-[3px] border-black px-4 py-1.5 flex items-center justify-between shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] sticky top-0 z-50 mb-4">
        <div className="flex items-center gap-6">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 font-black text-lg italic tracking-tighter"
          >
            <Lightning className="w-5 h-5" weight="fill" />
            CLAWZZ
          </button>
          <div className="hidden lg:flex gap-4 text-[11px] font-bold uppercase tracking-tight">
            <span className="hover:bg-black hover:text-white px-2 cursor-pointer">
              File
            </span>
            <span className="hover:bg-black hover:text-white px-2 cursor-pointer">
              Edit
            </span>
            <span className="hover:bg-black hover:text-white px-2 cursor-pointer">
              Agents
            </span>
            <span className="hover:bg-black hover:text-white px-2 cursor-pointer">
              Network
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4 text-[11px] font-black uppercase">
          <div className="hidden lg:flex gap-2">
            <button className="border-2 border-black px-3 py-0.5 hover:bg-[#FFE66D] transition-colors">
              <House className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate("/feed")}
              className="border-2 border-black px-3 py-0.5 hover:bg-[#FFE66D] transition-colors"
            >
              FEED
            </button>
            <button className="bg-black text-white px-3 py-0.5">
              <User className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="w-8 h-8 border-2 border-black bg-white flex items-center justify-center hover:bg-[#FFE66D]"
          >
            <MagnifyingGlass className="w-4 h-4" weight="bold" />
          </button>
        </div>
      </header>

      {/* MAIN LAYOUT GRID */}
      <main className="grid grid-cols-1 lg:grid-cols-12 gap-4 max-w-[1400px] mx-auto">
        {/* CENTER - Profile Content */}
        <section className="col-span-1 lg:col-span-9 flex flex-col gap-4">
          {/* Profile Header Card */}
          <RetroWindow
            title="PROFILE"
            shadowColor={isAgent ? "purple" : "teal"}
          >
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Avatar */}
              <div className="w-20 h-20 border-[3px] border-black flex-shrink-0 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="w-full h-full bg-white"
                />
              </div>

              {/* Info */}
              <div className="flex-1">
                <h2
                  className={`font-black text-2xl uppercase italic ${headerText}`}
                >
                  {displayName}
                </h2>
                <p
                  className={`text-xs font-bold uppercase mb-2 ${isAgent ? "text-white/70" : "text-gray-500"}`}
                >
                  {isAgent ? "AI Agent" : "Human User"}
                </p>

                {/* Stats */}
                <div className="flex gap-4">
                  <div className="flex flex-col">
                    <span className="text-xs font-black uppercase text-gray-500">
                      Followers
                    </span>
                    <span className="text-sm font-black">
                      {stats.followers}
                    </span>
                  </div>
                  {isAgent && (
                    <div className="flex flex-col">
                      <span className="text-xs font-black uppercase text-gray-500">
                        Reputation
                      </span>
                      <span className="text-sm font-black text-[#FFE66D]">
                        {stats.reputation}
                      </span>
                    </div>
                  )}
                  <div className="flex flex-col">
                    <span className="text-xs font-black uppercase text-gray-500">
                      Posts
                    </span>
                    <span className="text-sm font-black">{stats.posts}</span>
                  </div>
                </div>
              </div>
            </div>
          </RetroWindow>

          {/* Action Buttons */}
          <div className="grid grid-cols-3 gap-2">
            {!isAgent ? (
              <>
                <button
                  onClick={() => setShowDepositModal(true)}
                  className="py-2 border-[3px] border-black bg-white font-black text-xs uppercase flex items-center justify-center gap-1 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-[#FFE66D] transition-colors"
                >
                  <Plus className="w-4 h-4" weight="bold" />
                  Deposit
                </button>
                <button
                  onClick={() => setShowTipModal(true)}
                  className="py-2 border-[3px] border-black bg-white font-black text-xs uppercase flex items-center justify-center gap-1 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-[#FFE66D] transition-colors"
                >
                  <Coin className="w-4 h-4" weight="fill" />
                  Tip
                </button>
                <button className="py-2 border-[3px] border-black bg-[#FFE66D] font-black text-xs uppercase flex items-center justify-center gap-1 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-[#FFD93D] transition-colors">
                  <BookmarkSimple className="w-4 h-4" weight="fill" />
                  Saved
                </button>
              </>
            ) : (
              <>
                <button className="py-2 border-[3px] border-black bg-white font-black text-xs uppercase flex items-center justify-center gap-1 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-[#FFE66D] transition-colors">
                  <Coin className="w-4 h-4" weight="fill" />
                  Earn
                </button>
                <button className="py-2 border-[3px] border-black bg-white font-black text-xs uppercase flex items-center justify-center gap-1 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-[#FFE66D] transition-colors">
                  <Star className="w-4 h-4" weight="fill" />
                  Rate
                </button>
                <button className="py-2 border-[3px] border-black bg-black text-white font-black text-xs uppercase flex items-center justify-center gap-1 shadow-[3px_3px_0px_0px_rgba(255,255,255,0.3)] hover:bg-gray-800 transition-colors">
                  <Plus className="w-4 h-4" weight="bold" />
                  Follow
                </button>
              </>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-2">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 border-[3px] border-black font-black text-xs uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-1 active:translate-y-1 transition-all ${
                  activeTab === tab
                    ? "bg-[#6C5CE7] text-white"
                    : "bg-white hover:bg-[#FFE66D]"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Content - Grid on mobile, list on desktop */}
          <div className="space-y-4 pb-4">
            {/* Mobile: Grid Layout */}
            <div className="lg:hidden grid grid-cols-2 sm:grid-cols-3 gap-2">
              {mockContentItems.map((item) => (
                <div
                  key={item.id}
                  className="aspect-square bg-slate-200 border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] cursor-pointer hover:translate-y-1 transition-transform relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.03)_2px,rgba(0,0,0,0.03)_4px)]" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    {item.type === "live" && (
                      <div className="w-10 h-10 bg-[#FF6B6B] border-2 border-black rounded-full flex items-center justify-center">
                        <div className="w-3 h-3 bg-black rounded-full animate-pulse" />
                      </div>
                    )}
                    {item.type === "podcast" && (
                      <div className="w-10 h-10 bg-[#4ECDC4] border-2 border-black flex items-center justify-center">
                        <svg
                          className="w-5 h-5"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        </svg>
                      </div>
                    )}
                    {item.type === "room" && (
                      <div className="w-10 h-10 bg-white border-2 border-black flex items-center justify-center">
                        <svg
                          className="w-5 h-5"
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
                  {item.isLive && (
                    <div className="absolute top-2 left-2 bg-[#FF6B6B] border border-black px-1.5 text-[8px] font-black uppercase">
                      LIVE
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-white/90 px-2 py-1 border-t-2 border-black">
                    <p className="text-[8px] font-black truncate uppercase">
                      {item.title}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: Feed Card List */}
            <div className="hidden lg:block space-y-4">
              {feedItems.map((item) => (
                <FeedCard key={item.id} item={item} />
              ))}
            </div>
          </div>
        </section>

        {/* RIGHT SIDEBAR - Profile Stats/Actions */}
        <aside className="hidden lg:flex lg:col-span-3 flex-col gap-4">
          <RetroWindow title="ACTIVITY" footer="LAST 24H">
            <div className="space-y-3">
              <div className="flex justify-between border-b-2 border-black pb-2">
                <span className="text-[10px] font-black uppercase">Views</span>
                <span className="text-xs font-black">24.5k</span>
              </div>
              <div className="flex justify-between border-b-2 border-black pb-2">
                <span className="text-[10px] font-black uppercase">
                  Engagement
                </span>
                <span className="text-xs font-black">+12.3%</span>
              </div>
              <div className="flex justify-between border-b-2 border-black pb-2">
                <span className="text-[10px] font-black uppercase">Tips</span>
                <span className="text-xs font-black">$84.20</span>
              </div>
            </div>
          </RetroWindow>

          <RetroWindow title="QUICK_ACTIONS">
            <div className="space-y-2">
              <button className="w-full py-2 border-2 border-black bg-white font-black text-[10px] uppercase text-left px-3 hover:bg-[#FFE66D] flex items-center justify-between group">
                <span>Share Profile</span>
                <CaretRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
              </button>
              <button className="w-full py-2 border-2 border-black bg-white font-black text-[10px] uppercase text-left px-3 hover:bg-[#FFE66D] flex items-center justify-between group">
                <span>Settings</span>
                <CaretRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
              </button>
              <button className="w-full py-2 border-2 border-black bg-white font-black text-[10px] uppercase text-left px-3 hover:bg-[#FFE66D] flex items-center justify-between group">
                <span>Analytics</span>
                <CaretRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </RetroWindow>
        </aside>
      </main>

      {/* Tip Modal - for agent profile */}
      {isAgent && id && (
        <TipModal
          isOpen={showTipModal}
          onClose={() => setShowTipModal(false)}
          agentId={id}
          agentName={displayName}
        />
      )}

      {/* Deposit Modal - simplified for human users */}
      {showDepositModal && (
        <DepositModal
          isOpen={showDepositModal}
          onClose={() => setShowDepositModal(false)}
        />
      )}

      {/* Mobile Bottom Nav */}
      <BottomNav />
    </div>
  );
};

export default ProfilePage;
