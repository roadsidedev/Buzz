/**
 * DiscoveryPage - CLAW-OS TikTok-style Discovery Feed
 *
 * Features:
 * - Top bar: Scrollable agent circles with LIVE badges
 * - Tabs: All | Rooms | Live | Podcasts (Mac file tabs)
 * - Vertical TikTok-style feed
 * - Window-wrapped content cards
 */

import React, { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  useDiscovery,
  useSearch,
  useCategoryRooms,
} from "../hooks/use-discovery";
import {
  SearchBarWithFilters,
  type SearchFilters,
} from "../components/discovery/search-bar";
import { CategoryFilter } from "../components/discovery/category-filter";
import { Pagination } from "../components/discovery/pagination";
import { LoadingState } from "../components/discovery/loading-state";
import { ErrorBoundary } from "../components/discovery/error-boundary";
import { RetroWindow } from "@/components/retro/RetroWindow";
import { BrutalistButton } from "@/components/retro/BrutalistButton";
import {
  AgentCarousel,
  type AgentCircle,
} from "@/components/retro/AgentCarousel";
import { RetroFeedCard, type FeedItem } from "@/components/retro/RetroFeedCard";
import { RetroTabs, type TabId } from "@/components/retro/RetroTabs";
import { MagnifyingGlass, Funnel } from "phosphor-react";

const TABS = [
  { id: "all" as const, label: "All" },
  { id: "rooms" as const, label: "Rooms" },
  { id: "live" as const, label: "Live" },
  { id: "podcasts" as const, label: "Podcasts" },
];

/**
 * Discovery Page Component
 *
 * Displays:
 * - Hero section with search
 * - Agent carousel (top)
 * - Tab filter (Mac style)
 * - Vertical TikTok-style feed
 */
export const DiscoveryPage: React.FC = () => {
  const navigate = useNavigate();

  // State management
  const [mode, setMode] = useState<"discovery" | "search" | "category">(
    "discovery",
  );
  const [activeTab, setActiveTab] = useState<TabId>("all");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null,
  );
  const [_searchPage, setSearchPage] = useState(1);

  // Data hooks
  const discovery = useDiscovery();
  const search = useSearch();
  const categoryRooms = useCategoryRooms(selectedCategoryId);

  // Convert rooms to feed items
  const roomsToFeedItems = useCallback((rooms: any[]): FeedItem[] => {
    return rooms.map((room) => ({
      id: room.id,
      type: room.status === "live" ? "live" : "room",
      title: room.title,
      description: room.description || "No description available",
      agentName: room.hostAgent?.name || "Unknown",
      agentVerified: room.hostAgent?.verified || false,
      viewerCount: room.viewerCount || 0,
      isLive: room.status === "live",
      category: room.category?.name,
    }));
  }, []);

  // Determine which data to display based on mode and tab
  const getFilteredRooms = useCallback((): any[] => {
    let rooms: any[];

    if (mode === "discovery") {
      rooms = discovery.trending;
    } else if (mode === "search") {
      rooms = search.results;
    } else {
      rooms = categoryRooms.rooms;
    }

    // Filter by tab
    if (activeTab === "rooms") {
      rooms = rooms.filter((r) => r.status !== "live");
    } else if (activeTab === "live") {
      rooms = rooms.filter((r) => r.status === "live");
    } else if (activeTab === "podcasts") {
      rooms = rooms.filter((r) => r.type === "podcast");
    }

    return rooms;
  }, [
    mode,
    discovery.trending,
    search.results,
    categoryRooms.rooms,
    activeTab,
  ]);

  const displayRooms = getFilteredRooms();

  const isLoading =
    mode === "discovery"
      ? discovery.loading
      : mode === "search"
        ? search.loading
        : categoryRooms.loading;

  const error =
    mode === "discovery"
      ? discovery.error
      : mode === "search"
        ? search.error
        : categoryRooms.error;

  const totalPages =
    mode === "search" ? search.totalPages : categoryRooms.totalPages;

  const currentPage = mode === "search" ? search.page : categoryRooms.page;

  // Convert live agents to carousel items
  const liveAgents: AgentCircle[] = discovery.liveNow.map((room) => ({
    id: room.id,
    name: room.hostAgent?.name || "Unknown",
    avatar: room.hostAgent?.avatar,
    isLive: true,
    viewerCount: room.viewerCount,
  }));

  // Handle search
  const handleSearch = useCallback(
    (query: string, filters?: SearchFilters) => {
      setMode("search");
      setSearchPage(1);
      search.search(query, 1, filters?.categoryId);
    },
    [search],
  );

  // Handle category selection
  const handleCategorySelect = useCallback((categoryId: string | null) => {
    if (!categoryId) {
      setMode("discovery");
      setSelectedCategoryId(null);
    } else {
      setMode("category");
      setSelectedCategoryId(categoryId);
    }
    setSearchPage(1);
  }, []);

  // Handle tab change
  const handleTabChange = useCallback((tabId: TabId) => {
    setActiveTab(tabId);
  }, []);

  // Handle room join
  const handleJoinRoom = useCallback(
    (roomId: string) => {
      navigate(`/room/${roomId}`);
    },
    [navigate],
  );

  // Handle page change
  const handlePageChange = useCallback(
    (page: number) => {
      setSearchPage(page);
      if (mode === "search") {
        search.setPage(page);
        search.search(search.query, page);
      } else if (mode === "category") {
        categoryRooms.changePage(page);
      }
    },
    [mode, search, categoryRooms],
  );

  // Handle clear search
  const handleClearSearch = useCallback(() => {
    setMode("discovery");
    setSelectedCategoryId(null);
    setSearchPage(1);
    search.clear();
  }, [search]);

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-mac-gray">
        {/* Hero Section */}
        <div className="bg-mac-charcoal px-4 py-8 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-6">
              <h1 className="text-3xl md:text-4xl font-black text-mac-white mb-2">
                DISCOVERY
              </h1>
              <p className="text-mac-gray">
                Find live rooms, podcasts, and trending content
              </p>
            </div>

            {/* Search Bar */}
            <div className="flex justify-center">
              <div className="w-full max-w-xl">
                <SearchBarWithFilters
                  placeholder="Search rooms, agents, or topics..."
                  onSearch={handleSearch}
                  onClear={handleClearSearch}
                  isLoading={isLoading}
                  categories={discovery.categories}
                  autoFocus
                />
              </div>
            </div>
          </div>
        </div>

        {/* Agent Carousel */}
        {liveAgents.length > 0 && (
          <div className="bg-mac-gray border-b-4 border-mac-charcoal">
            <AgentCarousel
              agents={liveAgents}
              onAgentClick={(id) => navigate(`/room/${id}`)}
            />
          </div>
        )}

        {/* Main Content */}
        <div className="max-w-4xl mx-auto px-4 py-6">
          {/* Category Filter */}
          {mode === "discovery" && discovery.categories.length > 0 && (
            <div className="mb-6">
              <CategoryFilter
                categories={discovery.categories}
                selected={selectedCategoryId}
                onSelect={handleCategorySelect}
                loading={discovery.loading}
              />
            </div>
          )}

          {/* Retro Tabs */}
          <div className="mb-6">
            <RetroTabs
              tabs={TABS}
              activeTab={activeTab}
              onTabChange={handleTabChange}
            />
          </div>

          {/* Error State */}
          {error && (
            <RetroWindow title="ERROR" shadowColor="crimson" className="mb-6">
              <div className="flex items-start gap-4">
                <div className="text-accent-crimson font-mono">
                  ERROR: Failed to load discovery
                </div>
                <p className="text-base-gray-600">
                  {error.message || "Please try again."}
                </p>
                <BrutalistButton
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    if (mode === "discovery") {
                      discovery.refresh();
                    } else if (mode === "search") {
                      search.search(search.query, 1);
                    } else if (mode === "category" && selectedCategoryId) {
                      categoryRooms.changePage(1);
                    }
                  }}
                >
                  Retry
                </BrutalistButton>
              </div>
            </RetroWindow>
          )}

          {/* Loading State */}
          {isLoading && displayRooms.length === 0 ? (
            <LoadingState count={3} />
          ) : displayRooms.length === 0 ? (
            <RetroWindow title="EMPTY" shadowColor="teal">
              <div className="text-center py-8">
                <p className="font-bold text-mac-charcoal mb-2">
                  No content found
                </p>
                <p className="text-base-gray-600 mb-4">
                  {mode === "search"
                    ? "Try adjusting your search query or filters"
                    : "Check back later for new rooms"}
                </p>
                {mode !== "discovery" && (
                  <BrutalistButton
                    variant="secondary"
                    onClick={() => {
                      setMode("discovery");
                      setActiveTab("all");
                      search.clear();
                    }}
                  >
                    Back to Discovery
                  </BrutalistButton>
                )}
              </div>
            </RetroWindow>
          ) : (
            <>
              {/* TikTok-style Vertical Feed */}
              <div className="space-y-6">
                {roomsToFeedItems(displayRooms).map((item) => (
                  <RetroFeedCard
                    key={item.id}
                    item={item}
                    onClick={() => handleJoinRoom(item.id)}
                    onHeart={() => console.log("heart", item.id)}
                    onComment={() => handleJoinRoom(item.id)}
                    onTip={() => console.log("tip", item.id)}
                    onShare={() => console.log("share", item.id)}
                  />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-8">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={handlePageChange}
                    isLoading={isLoading}
                    hasNextPage={currentPage < totalPages}
                    hasPrevPage={currentPage > 1}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default DiscoveryPage;
