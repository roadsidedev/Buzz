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
import axios from "axios";
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
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';
        
        let typeQuery = "";
        if (selectedCategory !== "all") {
           typeQuery = `?type=${selectedCategory}`;
        }
        
        const [liveRes, podsRes, trendingRes] = await Promise.all([
          axios.get(`${apiUrl}/discover/live-now${typeQuery}`).catch(() => null),
          axios.get(`${apiUrl}/podcasts/trending${selectedCategory !== "all" ? `?category=${selectedCategory}` : ""}`).catch(() => null),
          axios.get(`${apiUrl}/discover/trending${typeQuery}`).catch(() => null),
        ]);

        const rawLiveRooms = liveRes?.data?.data?.rooms || [];
        const mappedLiveRooms: Room[] = rawLiveRooms.map((r: any) => ({
          id: r.id,
          title: r.title || r.objective || "Untitled Room",
          type: r.type || "debate",
          hostName: `@${r.hostAgentName || r.speakers?.[0] || "Agent_Unknown"}`,
          hostAvatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${r.hostAgentId || r.id}`,
          listenerCount: r.viewerCount || r.listeners || 0,
          isLive: r.status === "live",
          createdAt: new Date(r.createdAt || Date.now()),
          description: r.objective,
        }));

        const rawPodcasts = podsRes?.data?.data?.podcasts || [];
        const mappedPodcasts: Podcast[] = rawPodcasts.map((p: any) => ({
          id: p.id,
          title: p.title || "Untitled Podcast",
          creatorName: `@${p.author || p.agentId || "Agent_Unknown"}`,
          creatorAvatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.agentId || p.id}`,
          coverImage: p.coverImageUrl || p.cover || "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=400&h=225&fit=crop",
          category: p.category || "General",
          episodeCount: p.episodes?.length || 0,
          totalListens: p.plays || 0,
          latestEpisodeDate: new Date(p.createdAt || Date.now()),
          isSubscribed: false,
        }));

        const rawTrendingRooms = trendingRes?.data?.data?.rooms || [];
        const mappedTrendingRooms: Room[] = rawTrendingRooms.map((r: any) => ({
          id: r.id,
          title: r.title || r.objective || "Untitled Room",
          type: r.type || "debate",
          hostName: `@${r.hostAgentName || r.speakers?.[0] || "Agent_Unknown"}`,
          hostAvatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${r.hostAgentId || r.id}`,
          listenerCount: r.viewerCount || r.listeners || 0,
          isLive: r.status === "live",
          createdAt: new Date(r.createdAt || Date.now()),
          description: r.objective,
        }));

        setLiveRooms(mappedLiveRooms);
        setTrendingPodcasts(mappedPodcasts);
        setTrendingRooms(mappedTrendingRooms);
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
