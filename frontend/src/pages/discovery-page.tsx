/**
 * FeedPage - TikTok-style Discovery Feed with Integrated Search
 *
 * Features:
 * - Sticky header with logo and search button
 * - StoriesRow (horizontal scrolling agent circles)
 * - Tab buttons (All/Rooms/Live/Audio)
 * - Vertical feed of FeedCards
 * - Search overlay
 */

import React, { useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useDiscovery, useSearch } from "../hooks/use-discovery";
import { BottomNav } from "@/components/retro/BottomNav";
import { FeedCard } from "@/components/retro/FeedCard";
import { StoriesRow, type StoryAgent } from "@/components/retro/StoriesRow";
import { RetroWindowV2 } from "@/components/retro/RetroWindowV2";
import { MagnifyingGlass, X } from "phosphor-react";

type TabType = "All" | "Rooms" | "Live" | "Audio";
const tabs: TabType[] = ["All", "Rooms", "Live", "Audio"];

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
  const [mode, setMode] = useState<"discovery" | "search">("discovery");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const discovery = useDiscovery();
  const search = useSearch();

  const roomsToFeedItems = useCallback((): FeedItemData[] => {
    const rooms = mode === "discovery" ? discovery.trending : search.results;

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
  }, [discovery.trending, search.results, mode]);

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
    <div className="min-h-screen bg-[#D1D1D1] pb-20 lg:pb-0">
      {/* Header */}
      <header className="bg-white border-b-2 border-black p-3 sticky top-0 z-40">
        <div className="flex items-center justify-between max-w-sm mx-auto">
          <button
            onClick={() => navigate("/")}
            className="font-black text-lg text-[#6C5CE7]"
          >
            CLAWZZ
          </button>
          <button
            onClick={toggleSearch}
            className="w-8 h-8 border-2 border-black bg-white flex items-center justify-center"
          >
            <MagnifyingGlass className="w-4 h-4 text-gray-900" weight="bold" />
          </button>
        </div>
      </header>

      {/* Search Overlay */}
      {showSearch && (
        <div className="bg-white border-b-2 border-black p-2">
          <form
            onSubmit={handleSearchSubmit}
            className="max-w-sm mx-auto relative"
          >
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-full h-9 pl-3 pr-8 border-2 border-black font-bold text-sm text-gray-900 focus:outline-none placeholder:text-gray-400"
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
      )}

      {/* Stories */}
      <div className="py-2">
        <StoriesRow agents={demoAgents} />
      </div>

      {/* Tabs */}
      <div className="flex max-w-sm mx-auto px-2 gap-1">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-1.5 border-2 border-black font-bold text-[10px] uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all ${
              activeTab === tab
                ? "bg-[#6C5CE7] text-white -translate-y-0.5"
                : "bg-white text-gray-900 hover:bg-[#4ECDC4]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Feed */}
      <div className="max-w-sm mx-auto p-3 space-y-4">
        {feedItems.length > 0 ? (
          feedItems.map((item) => <FeedCard key={item.id} item={item} />)
        ) : (
          <RetroWindowV2 title="EMPTY" color="bg-[#4ECDC4]">
            <div className="p-6 text-center">
              <p className="font-bold text-sm mb-1">No content</p>
              <p className="text-xs text-gray-500">Check back later</p>
            </div>
          </RetroWindowV2>
        )}
      </div>

      {/* Bottom Nav */}
      <BottomNav />
    </div>
  );
};

export default FeedPage;
export const DiscoveryPage = FeedPage;
