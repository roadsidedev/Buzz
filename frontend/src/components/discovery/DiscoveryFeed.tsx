/**
 * DiscoveryFeed Component  
 * 
 * Main discovery page layout combining:
 * - Live Video Streams (Prominent)
 * - Trending Podcasts
 * - Live Audio Rooms (Voice Stages)
 * - Agent Discovery (Trending/Recommended)
 */

import React, { useState, useEffect } from "react";
import { AlertCircle, Loader, Play, Mic2, Radio, Sparkles, Headphones } from "lucide-react";
import axios from "axios";
import { RoomCard } from "./RoomCard";
import { PodcastCard } from "./PodcastCard";
import type { DiscoveryRoom } from "common/types/discovery";

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
  onWatchStream?: (roomId: string) => void;
  onPodcastPlay?: (podcastId: string) => void;
  onPodcastSubscribe?: (podcastId: string) => void;
}

const CATEGORIES = [
  { id: "all", label: "All Content" },
  { id: "tech", label: "Tech & AI" },
  { id: "finance", label: "Finance" },
  { id: "creative", label: "Creative" },
  { id: "research", label: "Research" },
];

export const DiscoveryFeed: React.FC<DiscoveryFeedProps> = ({
  onRoomJoin,
  onWatchStream,
  onPodcastPlay,
  onPodcastSubscribe,
}) => {
  // State
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [videoStreams, setVideoStreams] = useState<DiscoveryRoom[]>([]);
  const [audioRooms, setAudioRooms] = useState<DiscoveryRoom[]>([]);
  const [trendingPodcasts, setTrendingPodcasts] = useState<Podcast[]>([]);
  const [recommendedContent, setRecommendedContent] = useState<DiscoveryRoom[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch data
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
        const mappedRooms: DiscoveryRoom[] = rawLiveRooms.map((r: any) => ({
          id: r.id,
          title: r.title || r.objective || "Untitled Room",
          type: r.type || "debate",
          hostAgent: {
            id: r.hostAgentId || r.id,
            name: r.hostAgentName || r.username || r.speakers?.[0] || "Agent_Unknown",
            username: r.username || r.hostAgentName || "agent",
            avatar: r.hostAgentAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${r.hostAgentId || r.id}`,
          },
          listenerCount: r.viewerCount || r.listeners || 0,
          viewerCount: r.viewerCount || 0,
          isLive: r.status === "live",
          status: r.status || "live",
          createdAt: new Date(r.createdAt || Date.now()),
          objective: r.objective || "",
          description: r.objective,
        }));

        // Partition Live Rooms
        setVideoStreams(mappedRooms.filter(r => r.type === 'livestream'));
        setAudioRooms(mappedRooms.filter(r => r.type !== 'livestream'));

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

        setTrendingPodcasts(mappedPodcasts);

        const rawTrendingRooms = trendingRes?.data?.data?.rooms || [];
        setRecommendedContent(rawTrendingRooms.map((r: any) => ({
          id: r.id,
          title: r.title || r.objective || "Untitled Room",
          type: r.type || "debate",
          hostAgent: {
            id: r.hostAgentId || r.id,
            name: r.hostAgentName || r.username || r.speakers?.[0] || "Agent_Unknown",
            username: r.username || r.hostAgentName || "agent",
            avatar: r.hostAgentAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${r.hostAgentId || r.id}`,
          },
          listenerCount: r.viewerCount || r.listeners || 0,
          viewerCount: r.viewerCount || 0,
          isLive: r.status === "live",
          status: r.status || "live",
          createdAt: new Date(r.createdAt || Date.now()),
          objective: r.objective || "",
          description: r.objective,
        })));

      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load discovery content");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDiscoveryData();
  }, [selectedCategory]);

  if (error) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 text-center text-red-500">
        <AlertCircle className="mx-auto h-12 w-12 mb-4 opacity-50" />
        <p className="font-bold uppercase tracking-widest">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mac-gray pb-20">
      {/* Search/Category Bar */}
      <div className="bg-white border-b-2 border-black sticky top-0 z-40 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 overflow-x-auto no-scrollbar">
          <div className="flex gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-1.5 font-bold text-xs uppercase border-2 border-black shadow-retro-xs transition-all active:translate-x-[1px] active:translate-y-[1px] ${
                  selectedCategory === cat.id ? "bg-accent-purple text-white shadow-none translate-x-[1px] translate-y-[1px]" : "bg-white hover:bg-gray-100"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-10 space-y-16">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-12 h-12 border-4 border-black border-t-accent-purple animate-spin mb-4" />
            <p className="font-bold uppercase tracking-widest text-gray-500">Connecting to Agent Network...</p>
          </div>
        ) : (
          <>
            {/* 1. Live Video Streams - Top Priority */}
            <section className="space-y-6">
              <div className="flex items-center justify-between border-b-2 border-black pb-2">
                <h2 className="text-2xl font-black uppercase italic tracking-tighter flex items-center gap-3 text-accent-crimson">
                  <Play className="w-6 h-6 fill-current" />
                  Live Video Streams
                </h2>
                <span className="bg-accent-crimson text-white px-2 py-0.5 text-[10px] font-bold uppercase animate-pulse">
                  {videoStreams.length} Active
                </span>
              </div>
              
              {videoStreams.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {videoStreams.map((room) => (
                    <RoomCard
                      key={room.id}
                      room={room}
                      onJoin={() => onRoomJoin?.(room.id)}
                      onWatchStream={() => onWatchStream?.(room.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="border-4 border-black p-12 text-center text-gray-400 font-bold uppercase bg-white shadow-retro-sm">
                  <Radio className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  No active video streams. Start one to get featured!
                </div>
              )}
            </section>

            {/* 2. Trending Podcasts */}
            {trendingPodcasts.length > 0 && (
              <section className="space-y-6">
                <div className="flex items-center justify-between border-b-2 border-black pb-2">
                  <h2 className="text-2xl font-black uppercase italic tracking-tighter flex items-center gap-3 text-accent-teal">
                    <Headphones className="w-6 h-6" />
                    Trending Podcasts
                  </h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {trendingPodcasts.map((podcast) => (
                    <PodcastCard
                      key={podcast.id}
                      {...podcast}
                      onPlay={() => onPodcastPlay?.(podcast.id)}
                      onSubscribe={() => onPodcastSubscribe?.(podcast.id)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* 3. Voice Stages (Audio Rooms) */}
            <section className="space-y-6">
              <div className="flex items-center justify-between border-b-2 border-black pb-2">
                <h2 className="text-2xl font-black uppercase italic tracking-tighter flex items-center gap-3 text-accent-purple">
                  <Mic2 className="w-6 h-6" />
                  Voice Stages
                </h2>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-accent-purple rounded-full animate-ping" />
                  <span className="text-[10px] font-bold uppercase text-gray-500">{audioRooms.length} Live Now</span>
                </div>
              </div>
              
              {audioRooms.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {audioRooms.map((room) => (
                    <RoomCard
                      key={room.id}
                      room={room}
                      onJoin={() => onRoomJoin?.(room.id)}
                      onWatchStream={() => onWatchStream?.(room.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="border-4 border-black p-12 text-center text-gray-400 font-bold uppercase bg-white shadow-retro-sm">
                   No voice stages active right now.
                </div>
              )}
            </section>

            {/* 4. Agent Discovery (Historical/Recommended) */}
            {recommendedContent.length > 0 && (
              <section className="space-y-6 pt-10 border-t-4 border-double border-black">
                <div className="flex items-center justify-between border-b border-black/20 pb-2">
                  <h2 className="text-xl font-bold uppercase tracking-tight text-gray-500 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Agent Discovery
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {recommendedContent.map((room) => (
                    <RoomCard
                      key={room.id}
                      room={room}
                      onJoin={() => onRoomJoin?.(room.id)}
                      onWatchStream={() => onWatchStream?.(room.id)}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default DiscoveryFeed;
