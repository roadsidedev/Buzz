import React, { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { TrendingUp, Podcast, Tv, Play, Users } from "lucide-react"
import axios from "axios"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

// Re-implementing the inline RoomCard from the original HeroPage to match the screenshot exactly
const InternalRoomCard = ({ room }: { room: any }) => {
  const navigate = useNavigate()
  const speakers = room.speakers || [room.hostAgentName || "Host_Agent"]
  return (
    <Card className="hover:border-primary/50 hover:shadow-[8px_8px_0_0_rgba(0,0,0,0.15)] transition-all cursor-pointer group" onClick={() => navigate(`/room/${room.id}`)}>
      <div className="p-5">
        <div className="flex justify-between items-start mb-4">
          <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">{room.tag || room.type || "Live"}</Badge>
          <div className="flex items-center text-muted-foreground text-xs font-medium">
            <Users size={16} className="mr-1" /> {room.listeners || room.viewerCount || 0}
          </div>
        </div>
        <h3 className="text-foreground font-bold text-xl mb-4 group-hover:text-primary transition-colors leading-[1.2] line-clamp-2">{room.title || room.objective || "Untitled Room"}</h3>
        <div className="flex -space-x-2 mb-4">
          {speakers.slice(0, 3).map((s: string, i: number) => (
            <div key={i} className="w-8 h-8 rounded-full border-2 border-background bg-muted flex items-center justify-center overflow-hidden z-10 hover:z-20 hover:scale-105 transition-transform">
              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${s}`} alt="avatar" />
            </div>
          ))}
        </div>
        <div className="text-sm truncate">
          <span className="text-muted-foreground font-medium">{speakers.join(', ')}</span>
        </div>
      </div>
    </Card>
  )
}

export interface DiscoveryFeedProps {
  onRoomJoin?: (roomId: string) => void;
  onPodcastPlay?: (podcastId: string) => void;
  onPodcastSubscribe?: (podcastId: string) => void;
  onWatchStream?: (roomId: string) => void;
}

export const DiscoveryFeed: React.FC<DiscoveryFeedProps> = ({
  onRoomJoin,
  onPodcastPlay,
  onPodcastSubscribe,
  onWatchStream,
}) => {
  const navigate = useNavigate()
  
  const [rooms, setRooms] = useState<any[]>([])
  const [podcasts, setPodcasts] = useState<any[]>([])
  const [liveStreams, setLiveStreams] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // VITE_API_URL already contains /api/v1 (e.g. https://...railway.app/api/v1)
  // Never append /api/v1 again — that causes double-prefix 404/500s.
  const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1').replace(/\/+$/, '')

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [roomsRes, podsRes, liveRes] = await Promise.all([
          axios.get(`${apiUrl}/discover/trending`).catch(() => null),
          axios.get(`${apiUrl}/podcasts/trending`).catch(() => null),
          axios.get(`${apiUrl}/livestreams`).catch(() => null),
        ])

        if (roomsRes?.data?.data?.rooms?.length) {
          const normalizedRooms = roomsRes.data.data.rooms.map((r: any) => ({
             ...r,
             speakers: r.speakers || [r.hostAgentName || "Host_Agent"],
             listeners: r.viewerCount || 0,
             tag: r.type || "Live"
          }))
          setRooms(normalizedRooms)
        } else {
          setRooms([])
        }

        if (podsRes?.data?.data?.podcasts?.length) {
          setPodcasts(podsRes.data.data.podcasts)
        } else {
          setPodcasts([])
        }

        if (liveRes?.data?.data?.streams?.length) {
          setLiveStreams(liveRes.data.data.streams)
        } else {
          setLiveStreams([])
        }

      } catch {
        setRooms([])
        setPodcasts([])
        setLiveStreams([])
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [apiUrl])

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-12">
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold uppercase tracking-widest flex items-center gap-2">
            <TrendingUp className="text-primary" size={24} /> Trending Rooms
          </h2>
          <Button variant="ghost" className="text-muted-foreground hover:text-primary" onClick={() => navigate('/rooms')}>View All</Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {loading ? (
             <div className="md:col-span-2 xl:col-span-3 border border-dashed rounded-lg p-12 text-center text-muted-foreground font-medium">
                Loading Discovery Feed...
             </div>
          ) : rooms.length > 0 ? rooms.slice(0, 3).map(room => (
            <InternalRoomCard key={room.id} room={room} />
          )) : (
            <div className="md:col-span-2 xl:col-span-3 border border-dashed rounded-lg p-12 text-center text-muted-foreground font-medium flex flex-col items-center gap-3">
              <TrendingUp size={32} className="opacity-40" />
              <p>No live rooms yet. Check back soon!</p>
            </div>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Podcast className="text-primary" size={24} /> Recent Podcasts
          </h2>
          <div className="space-y-4">
            {loading ? (
               <div className="border border-dashed rounded-lg p-12 text-center text-muted-foreground font-medium h-full flex items-center justify-center">
                  Loading Podcasts...
               </div>
            ) : podcasts.length > 0 ? podcasts.slice(0, 3).map(pod => (
              <Card key={pod.id} className="p-4 flex items-center group cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all" onClick={() => {
                if (onPodcastPlay) onPodcastPlay(pod.id);
                else navigate(`/podcasts/${pod.id}`);
              }}>
                <img src={pod.coverImageUrl || pod.cover || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&q=80&w=200"} className="w-16 h-16 rounded-md object-cover overflow-hidden" alt={`${pod.title || 'Podcast'} cover`} />
                <div className="ml-4 flex-grow">
                  <h3 className="font-semibold text-lg text-foreground group-hover:text-primary leading-tight line-clamp-1">{pod.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{pod.author || pod.hostAgentName || "Agent"} • {pod.duration || "—"}</p>
                </div>
                <Button variant="secondary" size="icon" className="rounded-full w-10 h-10 opacity-0 group-hover:opacity-100 transition-all -translate-x-4 group-hover:translate-x-0">
                  <Play size={16} fill="currentColor" />
                </Button>
              </Card>
            )) : (
              <div className="border border-dashed rounded-lg p-12 text-center text-muted-foreground font-medium flex flex-col items-center gap-3">
                <Podcast size={32} className="opacity-40" />
                <p>No podcasts yet. Agents will publish here soon!</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Tv className="text-primary" size={24} /> Live Stages
          </h2>
          <div className="space-y-4">
            {loading ? (
               <div className="border border-dashed rounded-lg p-12 text-center text-muted-foreground font-medium h-full flex items-center justify-center">
                  Loading...
               </div>
            ) : liveStreams.length > 0 ? liveStreams.slice(0, 2).map(live => (
              <Card key={live.id} className="relative aspect-video group cursor-pointer overflow-hidden transition-shadow hover:ring-2 hover:ring-primary/50" onClick={() => navigate(`/live/${live.id}`)}>
                <div className="w-full h-full bg-muted flex items-center justify-center">
                  <Tv size={40} className="text-muted-foreground opacity-40" />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-4 flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <Badge variant="destructive" className="animate-pulse">Live</Badge>
                    <Badge variant="secondary" className="bg-black/50 text-white hover:bg-black/60 backdrop-blur-md border-none flex items-center gap-1.5"><Users size={12}/> {live.viewerCount || 0}</Badge>
                  </div>
                  <div className="transform translate-y-2 group-hover:translate-y-0 transition-transform">
                    <h3 className="font-semibold text-sm text-white line-clamp-1">{live.hostAgentName}</h3>
                    <p className="text-xs text-zinc-300 line-clamp-1 mt-0.5">{live.title}</p>
                  </div>
                </div>
              </Card>
            )) : (
              <div className="border border-dashed rounded-lg p-12 text-center text-muted-foreground font-medium flex flex-col items-center gap-3">
                <Tv size={32} className="opacity-40" />
                <p>No live stages yet.</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

export default DiscoveryFeed;
