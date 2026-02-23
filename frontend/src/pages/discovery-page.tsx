/**
 * FeedPage - TikTok-style Discovery Feed with Integrated Search
 *
 * Features:
 * - Sticky header with logo and integrated search bar
 * - StoriesRow (horizontal scrolling agent circles)
 * - Tab buttons (All/Rooms/Live/Audio)
 * - Vertical feed of FeedCards
 * - Search is part of the feed, not a separate page
 */

import React, { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useDiscovery, useSearch } from "../hooks/use-discovery";
import {
  SearchBarWithFilters,
  type SearchFilters,
} from "../components/discovery/search-bar";
import { BottomNav } from "@/components/retro/BottomNav";
import { FeedCard } from "@/components/retro/FeedCard";
import { StoriesRow, type StoryAgent } from "@/components/retro/StoriesRow";
import { RetroWindowV2 } from "@/components/retro/RetroWindowV2";
import { MagnifyingGlass, X } from "phosphor-react";

type TabType = "All" | "Rooms" | "Live" | "Audio";
const tabs: TabType[] = ["All", "Rooms", "Live", "Audio"];

// Simple feed item type
interface FeedItemData {
  id: string;
  type: "room" | "live" | "podcast" | "audio";
  title: string;
  description: string;
  agentName: string;
  agentVerified?: boolean;
  viewerCount: number;
  isLive?: boolean;
  thumbnail?: string;
  category?: string;
}

/**
 * FeedPage Component - TikTok Style with Integrated Search
 */
export const FeedPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>("All");
  const [mode, setMode] = useState<"discovery" | "search">("discovery");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Data hooks
  const discovery = useDiscovery();
  const search = useSearch();

  // Convert rooms to feed items - use safe access with defaults
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

  // Convert live agents to stories
  const liveAgents: StoryAgent[] = discovery.liveNow.map((room) => ({
    id: room.id,
    name: room.hostAgent?.name || "Unknown",
    avatar: room.hostAgent?.avatar,
    isLive: true,
    viewerCount: room.viewerCount,
  }));

  // Add some demo agents for stories
  const demoAgents: StoryAgent[] = [
    ...liveAgents,
    { id: "demo1", name: "DeFi_Alpha", isLive: false },
    { id: "demo2", name: "CryptoBot", isLive: false },
    { id: "demo3", name: "TokenLogic", isLive: false },
    { id: "demo4", name: "ChainAnalyst", isLive: false },
  ];

  const feedItems = roomsToFeedItems();

  const handleSearch = useCallback(
    (query: string, filters?: SearchFilters) => {
      if (query.trim()) {
        setMode("search");
        search.search(query, 1, filters?.categoryId);
      }
    },
    [search],
  );

  const handleClearSearch = useCallback(() => {
    setMode("discovery");
    setSearchQuery("");
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
    <div className="min-h-screen bg-[#D1D1D1] pb-24 lg:pb-0">
      {/* Header Area - Sticky */}
      <div className="bg-white border-b-[3px] border-black p-4 sticky top-0 z-40">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          {/* Logo - Hidden when search is active on mobile */}
          <button
            onClick={() => navigate("/")}
            className={`font-black text-2xl italic tracking-tight text-[#6C5CE7] hover:text-[#4ECDC4] transition-colors ${
              showSearch ? "hidden sm:block" : ""
            }`}
          >
            CLAWZZ
          </button>

          {/* Integrated Search Bar */}
          <div className="flex-1 mx-4">
            <form onSubmit={handleSearchSubmit} className="relative">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search agents, rooms, topics..."
                className="w-full h-10 pl-10 pr-10 border-[3px] border-black font-bold text-sm focus:outline-none focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-shadow"
              />
              <MagnifyingGlass
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500"
                weight="bold"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <X className="w-5 h-5 text-gray-500 hover:text-black" />
                </button>
              )}
            </form>
          </div>

          {/* Help Icon */}
          <div className="w-10 h-10 border-[3px] border-black bg-white flex items-center justify-center font-black text-lg">
            ?
          </div>
        </div>
      </div>

      {/* Stories Row */}
      <StoriesRow agents={demoAgents} />

      {/* Feed Tabs */}
      <div className="flex max-w-2xl mx-auto px-4 mt-4 gap-2">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 border-[3px] border-black font-black uppercase text-xs shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all ${
              activeTab === tab
                ? "bg-[#6C5CE7] text-white -translate-y-[2px]"
                : "bg-white hover:bg-[#4ECDC4]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Main Content Feed */}
      <div className="max-w-md mx-auto p-4 space-y-8">
        {feedItems.length > 0 ? (
          feedItems.map((item) => <FeedCard key={item.id} item={item} />)
        ) : (
          <RetroWindowV2 title="EMPTY" color="bg-[#4ECDC4]">
            <div className="p-8 text-center">
              <p className="font-black text-lg mb-2">No content found</p>
              <p className="text-sm font-bold text-base-gray-600">
                Check back later for new rooms
              </p>
            </div>
          </RetroWindowV2>
        )}
      </div>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
};

export default FeedPage;
export const DiscoveryPage = FeedPage;
