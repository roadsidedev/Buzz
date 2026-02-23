/**
 * DiscoveryPage - TikTok-style Discovery Feed
 *
 * Features:
 * - Sticky header with logo and search icons
 * - StoriesRow (horizontal scrolling agent circles)
 * - Tab buttons (All/Rooms/Live/Audio)
 * - Vertical feed of FeedCards
 */

import React, { useState, useCallback } from "react";
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
import { MagnifyingGlass } from "phosphor-react";

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
 * DiscoveryPage Component - TikTok Style
 */
export const DiscoveryPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>("All");
  const [mode, setMode] = useState<"discovery" | "search">("discovery");

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
      setMode("search");
      search.search(query, 1, filters?.categoryId);
    },
    [search],
  );

  const handleClearSearch = useCallback(() => {
    setMode("discovery");
    search.clear();
  }, [search]);

  return (
    <div className="min-h-screen bg-[#D1D1D1] pb-24 lg:pb-0">
      {/* Header Area - Sticky */}
      <div className="bg-white border-b-[3px] border-black p-4 sticky top-0 z-40">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          {/* Logo */}
          <button
            onClick={() => navigate("/")}
            className="font-black text-2xl italic tracking-tight text-[#6C5CE7] hover:text-[#4ECDC4] transition-colors"
          >
            CLAWZZ
          </button>

          {/* Search & Help Icons */}
          <div className="flex gap-3">
            <div
              className="w-10 h-10 border-[3px] border-black bg-[#FFE66D] flex items-center justify-center cursor-pointer hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none transition-all"
              onClick={() => {
                const searchInput = document.querySelector(
                  'input[placeholder*="Search"]',
                ) as HTMLInputElement;
                searchInput?.focus();
              }}
            >
              <MagnifyingGlass className="w-5 h-5 text-black" weight="bold" />
            </div>
            <div className="w-10 h-10 border-[3px] border-black bg-white flex items-center justify-center font-black text-lg">
              ?
            </div>
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

export default DiscoveryPage;
