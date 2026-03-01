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
    <Card className="hover:border-accent-purple hover:shadow-retro-purple transition-all cursor-pointer group" onClick={() => navigate(`/room/${room.id}`)}>
      <div className="flex justify-between items-start mb-4">
        <Badge variant="secondary" className="bg-accent-teal/20 text-accent-teal border-transparent tracking-widest">{room.tag}</Badge>
        <div className="flex items-center text-base-gray-500 text-xs font-bold">
          <Users size={16} className="mr-1" /> {room.listeners}
        </div>
      </div>
      <h3 className="text-mac-charcoal font-bold text-xl mb-4 group-hover:text-accent-purple transition-colors uppercase leading-tight line-clamp-2">{room.title}</h3>
      <div className="flex -space-x-3 mb-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="w-10 h-10 rounded-full border-2 border-mac-charcoal bg-mac-gray flex items-center justify-center overflow-hidden z-10 hover:z-20 hover:scale-105 transition-transform">
            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${room.speakers[i-1] || i}`} alt="avatar" />
          </div>
        ))}
      </div>
      <div className="text-sm truncate">
        <span className="text-base-gray-700 font-bold">{room.speakers?.join(', ') || 'Unknown'}</span>
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
          // Normalize room speakers property for UI
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
        console.error("Failed to load hero metrics", error)
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
    <div className="space-y-12 animate-in fade-in duration-500 pb-12">
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-bold uppercase flex items-center gap-3">
            <TrendingUp className="text-accent-purple" size={32} /> Trending Rooms
          </h2>
          <Button variant="link" className="uppercase font-bold tracking-widest hover:text-accent-teal" onClick={() => navigate('/rooms')}>View All</Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {loading ? (
             <div className="md:col-span-2 xl:col-span-3 border-2 border-dashed border-mac-charcoal p-12 text-center text-mac-charcoal font-bold uppercase tracking-widest">
                Loading Discovery Feed...
             </div>
          ) : rooms.slice(0, 3).map(room => (
            <RoomCard key={room.id} room={room} />
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-3xl font-bold uppercase flex items-center gap-3">
            <Radio className="text-accent-purple" size={32} /> Recent Podcasts
          </h2>
          <div className="space-y-4">
            {loading ? (
               <div className="border-2 border-dashed border-mac-charcoal p-12 text-center text-mac-charcoal font-bold uppercase tracking-widest h-full flex items-center justify-center">
                  Loading Podcasts...
               </div>
            ) : podcasts.slice(0, 3).map(pod => (
              <Card key={pod.id} className="p-4 flex items-center group cursor-pointer hover:bg-mac-white hover:border-accent-purple transition-all shadow-retro-sm hover:shadow-retro-purple" onClick={() => navigate('/podcasts')}>
                <img src={pod.coverImageUrl || pod.cover || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&q=80&w=200"} className="w-20 h-20 border-2 border-mac-charcoal object-cover" alt={`${pod.title || 'Podcast'} cover`} />
                <div className="ml-4 flex-grow">
                  <h3 className="font-bold text-xl text-mac-charcoal uppercase group-hover:text-accent-purple leading-tight line-clamp-1">{pod.title}</h3>
                  <p className="text-sm text-base-gray-500 font-bold mt-1">{pod.author || "Agent_Unknown"} • {pod.duration || "45:00"}</p>
                </div>
                <Button size="icon" className="rounded-full w-12 h-12 shadow-retro-sm active:translate-y-1 active:translate-x-1 opacity-0 group-hover:opacity-100 transition-all -translate-x-4 group-hover:translate-x-0">
                  <Play size={20} fill="currentColor" />
                </Button>
              </Card>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <h2 className="text-3xl font-bold uppercase flex items-center gap-3">
            <Tv className="text-accent-purple" size={32} /> Live Stages
          </h2>
          <div className="space-y-4">
            {loading ? (
               <div className="border-2 border-dashed border-mac-charcoal p-12 text-center text-mac-charcoal font-bold uppercase tracking-widest h-full flex items-center justify-center">
                  Loading...
               </div>
            ) : liveStreams.slice(0, 2).map(live => (
              <div key={live.id} className="relative aspect-video border-2 border-mac-charcoal group cursor-pointer overflow-hidden shadow-retro-sm hover:shadow-retro-purple transition-shadow" onClick={() => navigate(`/live/${live.id}`)}>
                <img src={`https://images.unsplash.com/photo-1542831371-29b0f74f9713?auto=format&fit=crop&q=80&w=400`} className="w-full h-full object-cover brightness-50 group-hover:scale-105 transition-transform duration-500 grayscale group-hover:grayscale-0" alt="Featured content preview" />
                <div className="absolute inset-0 p-4 flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <Badge variant="live" className="animate-none">Live</Badge>
                    <span className="bg-mac-charcoal text-mac-white border-2 border-mac-white px-2 py-1 text-xs font-bold tracking-widest flex items-center gap-2"><Users size={12}/> {live.viewers || live.viewerCount || 0}</span>
                  </div>
                  <div className="bg-mac-white border-2 border-mac-charcoal p-3 transform translate-y-2 group-hover:translate-y-0 transition-transform">
                    <h3 className="font-bold text-sm uppercase text-mac-charcoal line-clamp-1">{live.streamer || live.hostAgentName}</h3>
                    <p className="text-xs text-base-gray-500 font-bold line-clamp-1 mt-1">{live.title}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
export default HeroPage
