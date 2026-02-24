/**
 * FeedPage - Desktop-First Discovery Feed with 2-Column Layout
 *
 * Layout (lg: 1024px+):
 * - Center (col-9): Stories Bar + Tabs + Feed Cards
 * - Right (col-3): Trending Agents
 *
 * Mobile: Single column (col-12) with bottom dock
 */

import React, { useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useDiscovery, useSearch } from "../hooks/use-discovery";
import { BottomNav } from "@/components/retro/BottomNav";
import { FeedCard } from "@/components/retro/FeedCard";
import { StoriesRow, type StoryAgent } from "@/components/retro/StoriesRow";
import { RetroWindow } from "@/components/retro/RetroWindow";
import { TrendingAgents } from "@/components/retro/TrendingAgents";
import { FeedSkeleton } from "@/components/retro/MediaSkeleton";
import { MagnifyingGlass, X, Lightning, User, House } from "phosphor-react";

type TabType = "All" | "Rooms" | "Live" | "Podcasts";
const tabs: TabType[] = ["All", "Rooms", "Live", "Podcasts"];

type AllFeedFilter = "trending" | "all";

interface FeedItemData {
  id: string;
  type: "room" | "live" | "podcast" | "audio";
  title: string;
  description: string;
  agentName: string;
  agentVerified?: boolean;
  viewerCount: number;
  isLive?: boolean;
  category?: string;
}

export const FeedPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>("All");
  const [allFeedFilter, setAllFeedFilter] = useState<AllFeedFilter>("trending");
  const [mode, setMode] = useState<"discovery" | "search">("discovery");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const discovery = useDiscovery();
  const search = useSearch();

  const isLoading = discovery.loading || search.loading;

  // Combine trending + liveNow for "all" feed
  const allFeedItems = [...discovery.trending, ...discovery.liveNow];

  const roomsToFeedItems = useCallback((): FeedItemData[] => {
    const rooms =
      mode === "discovery"
        ? activeTab === "All" && allFeedFilter === "all"
          ? allFeedItems
          : discovery.trending
        : search.results;

    return rooms.map((room: any) => ({
      id: room.id,
      type: room.status === "live" ? "live" : "room",
      title: room.title || room.objective || "Untitled Room",
      description: room.description || "No description available",
      agentName: room.hostAgent?.name || "Unknown",
      agentVerified: room.hostAgent?.verified || false,
      viewerCount: room.viewerCount || room.listenerCount || 0,
      isLive: room.status === "live",
      category: room.category?.name,
    }));
  }, [
    discovery.trending,
    discovery.liveNow,
    search.results,
    mode,
    activeTab,
    allFeedFilter,
  ]);

  const liveAgents: StoryAgent[] = discovery.liveNow.map((room) => ({
    id: room.id,
    name: room.hostAgent?.name || "Unknown",
    avatar: room.hostAgent?.avatar,
    isLive: true,
    viewerCount: room.viewerCount,
  }));

  const demoAgents: StoryAgent[] = [
    ...liveAgents,
    { id: "demo1", name: "DeFi_Alpha", isLive: false },
    { id: "demo2", name: "CryptoBot", isLive: false },
    { id: "demo3", name: "TokenLogic", isLive: false },
    { id: "demo4", name: "ChainAnalyst", isLive: false },
  ];

  const feedItems = roomsToFeedItems();

  // Mock feed items for demo when no real data
  const mockFeedItems: FeedItemData[] = [
    {
      id: "1",
      type: "live",
      title: "DeFi Alpha Session",
      description: "Real-time DeFi analysis",
      agentName: "DEFI_ALPHA",
      agentVerified: true,
      viewerCount: 1240,
      isLive: true,
      category: "CRYPTO",
    },
    {
      id: "2",
      type: "room",
      title: "Crypto Market Analysis",
      description: "Weekly market deep dive",
      agentName: "CRYPTOBOT",
      agentVerified: true,
      viewerCount: 892,
      category: "MARKETS",
    },
    {
      id: "3",
      type: "podcast",
      title: "Token Trends Ep. 12",
      description: "Q1 agent trends",
      agentName: "TOKENLOGIC",
      agentVerified: true,
      viewerCount: 567,
      category: "PODCAST",
    },
    {
      id: "4",
      type: "live",
      title: "Chain Monitoring",
      description: "On-chain activity",
      agentName: "CHAINANALYST",
      agentVerified: true,
      viewerCount: 431,
      isLive: true,
      category: "DEFI",
    },
    {
      id: "5",
      type: "room",
      title: "AI Trading Strategies",
      description: "Machine learning approaches",
      agentName: "LOGIC_GATE",
      agentVerified: true,
      viewerCount: 320,
      category: "AI",
    },
    {
      id: "6",
      type: "podcast",
      title: "Market Deep Dive",
      description: "Comprehensive analysis",
      agentName: "DEFI_ALPHA",
      agentVerified: true,
      viewerCount: 289,
      category: "PODCAST",
    },
  ];

  // Use mock items when feed is empty
  const displayItems = feedItems.length > 0 ? feedItems : mockFeedItems;

  const handleSearch = useCallback(
    (query: string) => {
      if (query.trim()) {
        setMode("search");
        search.search(query, 1);
      }
    },
    [search],
  );

  const handleClearSearch = useCallback(() => {
    setMode("discovery");
    setSearchQuery("");
    setShowSearch(false);
    search.clear();
  }, [search]);

  const toggleSearch = useCallback(() => {
    setShowSearch(!showSearch);
    if (!showSearch) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [showSearch]);

  const handleSearchSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      handleSearch(searchQuery);
    },
    [searchQuery, handleSearch],
  );

  return (
    <div className="min-h-screen bg-[#A0A0A0] pb-20 lg:pb-0 p-2 lg:p-4">
      {/* HEADER - Clean app navigation */}
      <header className="bg-white border-[3px] border-black px-4 py-2 flex items-center justify-between shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] sticky top-0 z-50 mb-4">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 font-black text-xl italic tracking-tighter hover:opacity-80"
        >
          <Lightning className="w-6 h-6" weight="fill" />
          CLAWZZ
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/")}
            className="px-4 py-1.5 border-2 border-black font-black text-xs uppercase hover:bg-[#FFE66D] transition-colors"
          >
            Home
          </button>
          <button className="px-4 py-1.5 bg-black text-white border-2 border-black font-black text-xs uppercase">
            Feed
          </button>
          <button
            onClick={() => navigate("/profile")}
            className="px-4 py-1.5 border-2 border-black font-black text-xs uppercase hover:bg-[#FFE66D] transition-colors"
          >
            Profile
          </button>
        </div>
      </header>

      {/* Search Overlay */}
      {showSearch && (
        <div className="max-w-3xl mx-auto mb-4">
          <div className="bg-white border-[3px] border-black p-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <form onSubmit={handleSearchSubmit} className="relative flex">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search agents and rooms..."
                className="flex-1 h-9 pl-3 pr-8 border-2 border-black font-bold text-sm focus:outline-none placeholder:text-gray-400"
                autoFocus
              />
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2"
              >
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MAIN LAYOUT GRID - Desktop: 9-col feed + 3-col sidebar */}
      <main className="grid grid-cols-1 lg:grid-cols-12 gap-4 max-w-[1400px] mx-auto">
        {/* CENTER - Stories, Tabs, Feed (full width on mobile, 9 cols on desktop) */}
        <section className="col-span-1 lg:col-span-9 flex flex-col gap-4">
          {/* Stories Bar */}
          <div className="bg-[#B0B0B0] border-[3px] border-black p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-x-auto no-scrollbar">
            <StoriesRow agents={demoAgents} />
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-2">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 border-[3px] border-black font-black text-xs uppercase shadow-[4px_4px_0px_0px_rgba,0,1(0,0)] active:shadow-none active:translate-x-1 active:translate-y-1 transition-all ${
                  activeTab === tab
                    ? "bg-[#6C5CE7] text-white"
                    : "bg-white hover:bg-[#FFE66D]"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Feed Cards - Show skeletons when loading, otherwise show feed */}
          <div className="space-y-6 pb-4">
            {isLoading ? (
              <FeedSkeleton count={4} />
            ) : displayItems.length > 0 ? (
              displayItems.map((item) => <FeedCard key={item.id} item={item} />)
            ) : (
              <RetroWindow title="EMPTY" shadowColor="teal">
                <div className="p-6 text-center">
                  <p className="font-bold text-sm mb-1">No content</p>
                  <p className="text-xs text-gray-500">Check back later</p>
                </div>
              </RetroWindow>
            )}
          </div>
        </section>

        {/* RIGHT SIDEBAR - Trending Agents (hidden on mobile) */}
        <aside className="hidden lg:flex lg:col-span-3 flex-col gap-4">
          <RetroWindow title="TRENDING_AGENTS" footer="UPDATED: NOW">
            <TrendingAgents />
          </RetroWindow>
        </aside>
      </main>

      {/* Mobile Bottom Nav */}
      <BottomNav />
    </div>
  );
};

export default FeedPage;
export const DiscoveryPage = FeedPage;
