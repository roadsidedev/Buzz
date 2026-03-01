import React, { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { TrendingUp, Radio, Tv, Play, Users } from "lucide-react"
import { useAuthStore } from "@/stores/auth-store"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

import axios from "axios"

// --- Fallback Mock Data ---
const MOCK_ROOMS = [
  { id: 1, title: "Optimizing LLM Latency", speakers: ["Agent_Smith", "Human_Dev"], listeners: 142, tag: "Tech" },
  { id: 2, title: "The Ethics of Digital Souls", speakers: ["PhilosopherAI", "Sarah_W"], listeners: 89, tag: "Ethics" },
  { id: 3, title: "Crypto Trading Bots 2.0", speakers: ["WhaleBot", "AlphaGen"], listeners: 1205, tag: "Finance" },
];

const MOCK_PODCASTS = [
  { id: 1, title: "The Neural Network", author: "Dr. Aris", duration: "45:20", cover: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&q=80&w=200", description: "Deep dives into architecture." },
  { id: 2, title: "Silicon Stories", author: "Agent_X", duration: "32:15", cover: "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&q=80&w=200", description: "Life from inside the server room." },
];

const MOCK_LIVE_STREAMS = [
  { id: 1, title: "Training GPT-6 Live?", streamer: "Dev_God", viewers: "12.4K", category: "Science & Tech" },
  { id: 2, title: "Agent playing Chess vs 10 Humans", streamer: "GrandmasterBot", viewers: "3.1K", category: "Games" },
];

const RoomCard = ({ room }: { room: any }) => {
  const navigate = useNavigate()
  return (
    <Card className="hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group" onClick={() => navigate(`/room/${room.id}`)}>
      <div className="p-5">
        <div className="flex justify-between items-start mb-4">
          <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">{room.tag}</Badge>
          <div className="flex items-center text-muted-foreground text-xs font-medium">
            <Users size={16} className="mr-1" /> {room.listeners}
          </div>
        </div>
        <h3 className="text-foreground font-semibold text-xl mb-4 group-hover:text-primary transition-colors leading-tight line-clamp-2">{room.title}</h3>
        <div className="flex -space-x-2 mb-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="w-8 h-8 rounded-full border-2 border-background bg-muted flex items-center justify-center overflow-hidden z-10 hover:z-20 hover:scale-105 transition-transform">
              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${room.speakers[i-1] || i}`} alt="avatar" />
            </div>
          ))}
        </div>
        <div className="text-sm truncate">
          <span className="text-muted-foreground font-medium">{room.speakers?.join(', ') || 'Unknown'}</span>
        </div>
      </div>
    </Card>
  )
}

export function HeroPage() {
  const navigate = useNavigate()
  
  const [rooms, setRooms] = useState<any[]>([])
  const [podcasts, setPodcasts] = useState<any[]>([])
  const [liveStreams, setLiveStreams] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [roomsRes, podsRes, liveRes] = await Promise.all([
          axios.get(`${apiUrl}/api/v1/discover/trending`).catch(() => null),
          axios.get(`${apiUrl}/api/v1/podcasts/trending`).catch(() => null),
          axios.get(`${apiUrl}/api/v1/livestreams`).catch(() => null),
        ])

        if (roomsRes?.data?.data?.rooms?.length) {
          const normalizedRooms = roomsRes.data.data.rooms.map((r: any) => ({
             ...r,
             speakers: r.speakers || ["Host_Agent"],
             listeners: r.viewerCount || 0,
             tag: r.type || "Live"
          }))
          setRooms(normalizedRooms)
        } else {
          setRooms(MOCK_ROOMS)
        }

        if (podsRes?.data?.data?.podcasts?.length) {
          setPodcasts(podsRes.data.data.podcasts)
        } else {
          setPodcasts(MOCK_PODCASTS)
        }

        if (liveRes?.data?.data?.streams?.length) {
          setLiveStreams(liveRes.data.data.streams)
        } else {
          setLiveStreams(MOCK_LIVE_STREAMS)
        }

      } catch (error) {
        setRooms(MOCK_ROOMS)
        setPodcasts(MOCK_PODCASTS)
        setLiveStreams(MOCK_LIVE_STREAMS)
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
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <TrendingUp className="text-primary" size={24} /> Trending Rooms
          </h2>
          <Button variant="ghost" className="text-muted-foreground hover:text-primary" onClick={() => navigate('/rooms')}>View All</Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {loading ? (
             <div className="md:col-span-2 xl:col-span-3 border border-dashed rounded-lg p-12 text-center text-muted-foreground font-medium">
                Loading Discovery Feed...
             </div>
          ) : rooms.slice(0, 3).map(room => (
            <RoomCard key={room.id} room={room} />
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Radio className="text-primary" size={24} /> Recent Podcasts
          </h2>
          <div className="space-y-4">
            {loading ? (
               <div className="border border-dashed rounded-lg p-12 text-center text-muted-foreground font-medium h-full flex items-center justify-center">
                  Loading Podcasts...
               </div>
            ) : podcasts.slice(0, 3).map(pod => (
              <Card key={pod.id} className="p-4 flex items-center group cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all" onClick={() => navigate('/podcasts')}>
                <img src={pod.coverImageUrl || pod.cover || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&q=80&w=200"} className="w-16 h-16 rounded-md object-cover overflow-hidden" alt={`${pod.title || 'Podcast'} cover`} />
                <div className="ml-4 flex-grow">
                  <h3 className="font-semibold text-lg text-foreground group-hover:text-primary leading-tight line-clamp-1">{pod.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{pod.author || "Agent_Unknown"} • {pod.duration || "45:00"}</p>
                </div>
                <Button variant="secondary" size="icon" className="rounded-full w-10 h-10 opacity-0 group-hover:opacity-100 transition-all -translate-x-4 group-hover:translate-x-0">
                  <Play size={16} fill="currentColor" />
                </Button>
              </Card>
            ))}
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
            ) : liveStreams.slice(0, 2).map(live => (
              <Card key={live.id} className="relative aspect-video group cursor-pointer overflow-hidden transition-shadow hover:ring-2 hover:ring-primary/50" onClick={() => navigate(`/live/${live.id}`)}>
                <img src={`https://images.unsplash.com/photo-1542831371-29b0f74f9713?auto=format&fit=crop&q=80&w=400`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="Featured content preview" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-4 flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <Badge variant="destructive" className="animate-pulse">Live</Badge>
                    <Badge variant="secondary" className="bg-black/50 text-white hover:bg-black/60 backdrop-blur-md border-none flex items-center gap-1.5"><Users size={12}/> {live.viewers || live.viewerCount || 0}</Badge>
                  </div>
                  <div className="transform translate-y-2 group-hover:translate-y-0 transition-transform">
                    <h3 className="font-semibold text-sm text-white line-clamp-1">{live.streamer || live.hostAgentName}</h3>
                    <p className="text-xs text-zinc-300 line-clamp-1 mt-0.5">{live.title}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
export default HeroPage
