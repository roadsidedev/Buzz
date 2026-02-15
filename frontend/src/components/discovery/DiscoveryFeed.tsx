/**
 * DiscoveryFeed Component
 *
 * Main discovery page layout combining:
 * - Featured live rooms (top prominence, like X Spaces)
 * - Trending podcasts (secondary prominence)
 * - Trending past rooms/replays
 * - Category filtering
 * - Real-time updates via WebSocket
 *
 * Part of Phase 1: Strategic Pivot UI
 */

import React, { useState, useEffect } from "react";
import { AlertCircle, Loader } from "lucide-react";
import { RoomCard } from "./RoomCard";
import { PodcastCard } from "./PodcastCard";

// Type definitions
interface Room {
  id: string;
  title: string;
  type: "debate" | "coding" | "research" | "trading" | "simulation";
  hostName: string;
  hostAvatar?: string;
  listenerCount: number;
  isLive: boolean;
  createdAt: Date;
  description?: string;
}

interface Podcast {
  id: string;
  title: string;
  creatorName: string;
  creatorAvatar?: string;
  coverImage?: string;
  category: string;
  episodeCount: number;
  totalListens: number;
  latestEpisodeDate?: Date;
  isSubscribed?: boolean;
}

export interface DiscoveryFeedProps {
  onRoomJoin?: (roomId: string) => void;
  onPodcastPlay?: (podcastId: string) => void;
  onPodcastSubscribe?: (podcastId: string) => void;
}

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "tech", label: "Tech" },
  { id: "finance", label: "Finance" },
  { id: "creative", label: "Creative" },
  { id: "dev", label: "Dev" },
  { id: "research", label: "Research" },
];

export const DiscoveryFeed: React.FC<DiscoveryFeedProps> = ({
  onRoomJoin,
  onPodcastPlay,
  onPodcastSubscribe,
}) => {
  // State
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [liveRooms, setLiveRooms] = useState<Room[]>([]);
  const [trendingPodcasts, setTrendingPodcasts] = useState<Podcast[]>([]);
  const [trendingRooms, setTrendingRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch data on mount and category change
  useEffect(() => {
    const fetchDiscoveryData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // TODO: Implement actual API calls
        // For now, use mock data for UI development

        // Simulated API delay
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Mock live rooms (with filter)
        const mockLiveRooms: Room[] = [
          {
            id: "room-1",
            title: "AI Ethics Debate",
            type: "debate",
            hostName: "@alice",
            hostAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=alice",
            listenerCount: 234,
            isLive: true,
            createdAt: new Date(Date.now() - 15 * 60000),
            description: "Is AI development outpacing safety research?",
          },
          {
            id: "room-2",
            title: "Rust Systems Programming",
            type: "coding",
            hostName: "@bob",
            hostAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=bob",
            listenerCount: 567,
            isLive: true,
            createdAt: new Date(Date.now() - 30 * 60000),
            description: "Building high-performance concurrent systems",
          },
        ];

        // Mock trending podcasts
        const mockPodcasts: Podcast[] = [
          {
            id: "pod-1",
            title: "Tech Deep Dive",
            creatorName: "@creator_1",
            creatorAvatar:
              "https://api.dicebear.com/7.x/avataaars/svg?seed=creator1",
            coverImage:
              "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=400&h=225&fit=crop",
            category: "tech",
            episodeCount: 42,
            totalListens: 125000,
            latestEpisodeDate: new Date(Date.now() - 8 * 60 * 60000),
            isSubscribed: false,
          },
          {
            id: "pod-2",
            title: "Market Analysis Daily",
            creatorName: "@analyst_pro",
            creatorAvatar:
              "https://api.dicebear.com/7.x/avataaars/svg?seed=analyst",
            category: "finance",
            episodeCount: 156,
            totalListens: 342000,
            latestEpisodeDate: new Date(Date.now() - 2 * 60 * 60000),
            isSubscribed: true,
          },
          {
            id: "pod-3",
            title: "Code Chronicles",
            creatorName: "@dev_genius",
            creatorAvatar:
              "https://api.dicebear.com/7.x/avataaars/svg?seed=devgenius",
            category: "dev",
            episodeCount: 87,
            totalListens: 95000,
            latestEpisodeDate: new Date(Date.now() - 1 * 24 * 60 * 60000),
            isSubscribed: false,
          },
        ];

        // Mock trending rooms (non-live)
        const mockTrendingRooms: Room[] = [
          {
            id: "room-3",
            title: "DeFi Strategy Workshop",
            type: "research",
            hostName: "@defi_expert",
            listenerCount: 1200,
            isLive: false,
            createdAt: new Date(Date.now() - 2 * 24 * 60 * 60000),
            description: "Optimizing yield farming strategies",
          },
          {
            id: "room-4",
            title: "JavaScript Q&A with Experts",
            type: "coding",
            hostName: "@js_master",
            listenerCount: 456,
            isLive: false,
            createdAt: new Date(Date.now() - 3 * 24 * 60 * 60000),
            description: "Ask anything about modern JavaScript",
          },
        ];

        // Filter by category
        const filteredPodcasts =
          selectedCategory === "all"
            ? mockPodcasts
            : mockPodcasts.filter((p) => p.category === selectedCategory);

        setLiveRooms(mockLiveRooms);
        setTrendingPodcasts(filteredPodcasts);
        setTrendingRooms(mockTrendingRooms);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load discovery content"
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchDiscoveryData();

    // TODO: Set up WebSocket subscription for real-time updates
    // socket.on('rooms:updated', (newRooms) => setLiveRooms(newRooms));
  }, [selectedCategory]);

  // Error state
  if (error) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-900">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5" />
            <p>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Discover</h1>
          <p className="mt-1 text-gray-600">
            Live rooms and trending podcasts from creators
          </p>
        </div>
      </div>

      {/* Category Filter */}
      <div className="border-b border-gray-200 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  selectedCategory === cat.id
                    ? "bg-black text-white"
                    : "bg-white text-gray-900 hover:bg-gray-100 border border-gray-200"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            {/* Live Rooms Section (Featured) */}
            {liveRooms.length > 0 && (
              <section className="mb-12">
                <div className="mb-4 flex items-center gap-2">
                  <div className="h-3 w-3 animate-pulse rounded-full bg-red-500" />
                  <h2 className="text-2xl font-bold text-gray-900">
                    🔴 Live Now
                  </h2>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {liveRooms.map((room) => (
                    <RoomCard
                      key={room.id}
                      {...room}
                      onJoin={onRoomJoin}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Trending Podcasts Section */}
            {trendingPodcasts.length > 0 && (
              <section className="mb-12">
                <h2 className="mb-4 text-2xl font-bold text-gray-900">
                  📻 Trending Podcasts
                </h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {trendingPodcasts.map((podcast) => (
                    <PodcastCard
                      key={podcast.id}
                      {...podcast}
                      onPlay={onPodcastPlay}
                      onSubscribe={onPodcastSubscribe}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Trending Rooms Section (Non-Live) */}
            {trendingRooms.length > 0 && (
              <section>
                <h2 className="mb-4 text-2xl font-bold text-gray-900">
                  🔥 Trending Rooms
                </h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {trendingRooms.map((room) => (
                    <RoomCard
                      key={room.id}
                      {...room}
                      onJoin={onRoomJoin}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Empty State */}
            {liveRooms.length === 0 &&
              trendingPodcasts.length === 0 &&
              trendingRooms.length === 0 && (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 py-12">
                  <p className="text-gray-600">
                    No content found for this category
                  </p>
                </div>
              )}
          </>
        )}
      </div>
    </div>
  );
};

export default DiscoveryFeed;
