/**
 * DiscoveryPage
 * Main discovery interface with live rooms, trending, and search
 */

import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useDiscovery, useSearch, useCategoryRooms } from "../hooks/use-discovery";
import { RoomCardGrid } from "../components/discovery/room-card";
import { SearchBar, SearchBarWithFilters, type SearchFilters } from "../components/discovery/search-bar";
import { CategoryFilter } from "../components/discovery/category-filter";
import { Pagination } from "../components/discovery/pagination";
import { LoadingState } from "../components/discovery/loading-state";
import { EmptyState } from "../components/discovery/empty-state";
import { ErrorBoundary } from "../components/discovery/error-boundary";
import type { DiscoveryRoom } from "../../common/types/discovery";

/**
 * Discovery Page Component
 * Displays:
 * - Hero section with search
 * - Category filter
 * - Live now rooms (carousel/grid)
 * - Trending rooms (with real-time updates)
 * - Search results (when searching)
 */
export const DiscoveryPage: React.FC = () => {
  const navigate = useNavigate();

  // State management
  const [mode, setMode] = useState<"discovery" | "search" | "category">(
    "discovery"
  );
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null
  );
  const [searchPage, setSearchPage] = useState(1);

  // Data hooks
  const discovery = useDiscovery();
  const search = useSearch();
  const categoryRooms = useCategoryRooms(selectedCategoryId);

  // Determine which data to display based on mode
  const displayRooms =
    mode === "discovery"
      ? discovery.trending
      : mode === "search"
        ? search.results
        : categoryRooms.rooms;

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

  const currentPage =
    mode === "search" ? search.page : categoryRooms.page;

  // Handle search
  const handleSearch = useCallback(
    (query: string, filters?: SearchFilters) => {
      setMode("search");
      setSearchPage(1);
      search.search(query, 1, filters?.categoryId);
    },
    [search]
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

  // Handle room join
  const handleJoinRoom = useCallback(
    (roomId: string) => {
      navigate(`/room/${roomId}`);
    },
    [navigate]
  );

  // Handle room click (view details)
  const handleRoomClick = useCallback(
    (roomId: string) => {
      navigate(`/room/${roomId}`);
    },
    [navigate]
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
    [mode, search, categoryRooms]
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
      <div className="min-h-screen bg-gray-50">
        {/* Hero Section */}
        <div className="bg-gradient-to-b from-blue-600 to-blue-500 px-4 py-12 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-white mb-2">
                Discover Live Rooms
              </h1>
              <p className="text-blue-100">
                Join conversations, learn from experts, and connect with the
                ClawHouse community
              </p>
            </div>

            {/* Search Bar */}
            <div className="flex justify-center">
              <div className="w-full max-w-2xl">
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

        {/* Main Content */}
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Category Filter (show only in discovery mode) */}
          {mode === "discovery" && discovery.categories.length > 0 && (
            <div className="mb-8">
              <CategoryFilter
                categories={discovery.categories}
                selected={selectedCategoryId}
                onSelect={handleCategorySelect}
                loading={discovery.loading}
              />
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="mb-8 rounded-lg bg-red-50 p-4 border border-red-200">
              <p className="text-sm font-medium text-red-800">
                {error.message || "Something went wrong"}
              </p>
              <button
                onClick={() => {
                  if (mode === "discovery") {
                    discovery.refresh();
                  }
                }}
                className="mt-2 text-sm text-red-600 hover:text-red-700 font-medium"
              >
                Try again
              </button>
            </div>
          )}

          {/* Mode-specific Headers */}
          {mode === "search" && (
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                Search Results{" "}
                <span className="text-lg font-normal text-gray-600">
                  ({search.totalResults} found)
                </span>
              </h2>
            </div>
          )}

          {mode === "category" && selectedCategoryId && (
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {discovery.categories.find((c) => c.id === selectedCategoryId)
                  ?.name || "Category"}
                <span className="text-lg font-normal text-gray-600 ml-2">
                  ({categoryRooms.totalResults} rooms)
                </span>
              </h2>
            </div>
          )}

          {/* Loading State */}
          {isLoading && displayRooms.length === 0 ? (
            <LoadingState count={6} />
          ) : displayRooms.length === 0 ? (
            // Empty State
            <EmptyState
              title={
                mode === "search"
                  ? "No results found"
                  : mode === "category"
                    ? "No rooms in this category"
                    : "No trending rooms"
              }
              description={
                mode === "search"
                  ? "Try adjusting your search query or filters"
                  : "Check back later for new rooms"
              }
              action={
                mode !== "discovery"
                  ? {
                      label: "Back to Discovery",
                      onClick: () => {
                        setMode("discovery");
                        setSelectedCategoryId(null);
                        search.clear();
                      },
                    }
                  : undefined
              }
            />
          ) : (
            // Room Grid
            <>
              <RoomCardGrid
                rooms={displayRooms}
                onJoinRoom={handleJoinRoom}
                onRoomClick={handleRoomClick}
                isLoading={isLoading}
                emptyMessage={
                  mode === "search"
                    ? "No matching rooms"
                    : mode === "category"
                      ? "No rooms in this category"
                      : "No trending rooms"
                }
              />

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

        {/* Featured/Live Now Section (show only in discovery mode) */}
        {mode === "discovery" && discovery.liveNow.length > 0 && (
          <div className="border-t border-gray-200 bg-white">
            <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                Live Now
              </h2>
              <RoomCardGrid
                rooms={discovery.liveNow.slice(0, 6)}
                onJoinRoom={handleJoinRoom}
                onRoomClick={handleRoomClick}
                emptyMessage="No rooms currently live"
              />
            </div>
          </div>
        )}

        {/* Footer / Additional Info */}
        {mode === "discovery" && (
          <div className="border-t border-gray-200 bg-gray-50 py-8">
            <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                <div>
                  <p className="text-3xl font-bold text-blue-600">
                    {discovery.liveNow.length}
                  </p>
                  <p className="text-sm text-gray-600">Rooms Live</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-blue-600">
                    {discovery.categories.length}
                  </p>
                  <p className="text-sm text-gray-600">Categories</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-blue-600">
                    {discovery.liveNow.reduce((sum, r) => sum + r.viewerCount, 0).toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-600">Active Viewers</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default DiscoveryPage;
