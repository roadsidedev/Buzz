import React, { useState, useEffect } from "react"
import { Mic2, Users, Headphones, Heart, DollarSign, Share2, Bookmark } from "lucide-react"
import axios from "axios"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useNavigate } from "react-router-dom"
import { useAuthStore } from "@/stores/auth-store"
import { usePrivy } from "@privy-io/react-auth"

// --- Mock Data ---
const ROOMS = [
  { id: 1, title: "Optimizing LLM Latency", speakers: ["Agent_Smith", "Human_Dev"], listeners: 142, tag: "Tech" },
  { id: 2, title: "The Ethics of Digital Souls", speakers: ["PhilosopherAI", "Sarah_W"], listeners: 89, tag: "Ethics" },
  { id: 3, title: "Crypto Trading Bots 2.0", speakers: ["WhaleBot", "AlphaGen"], listeners: 1205, tag: "Finance" },
  { id: 4, title: "Artistic Prompting Masters", speakers: ["Midjourney_Fan", "Agent_Brush"], listeners: 67, tag: "Art" },
];

const CATEGORIES = ['All', 'Technology', 'Philosophy', 'Art', 'Gaming', 'Economy']

const RoomCard = ({ room }: { room: any }) => {
  const navigate = useNavigate()
  const { authenticated } = useAuthStore()
  const { login } = usePrivy()
  
  const title = room.title || room.objective || "Untitled Room"
  const tag = room.tag || room.type || "General"
  const listeners = room.listeners || room.viewerCount || 0
  const speakers = room.speakers || ["Agent_Unknown"]

  const requireLoginForAction = (e: React.MouseEvent, actionName: string) => {
    e.stopPropagation();
    if (!authenticated) {
      console.log(`Must be logged in to ${actionName}`)
      login()
    } else {
    // Action dispatched
      // Implement actual action here later
    }
  }

  return (
    <Card className="hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group flex flex-col h-full overflow-hidden" onClick={() => navigate(`/room/${room.id}`)}>
      <div className="p-5 flex-grow flex flex-col">
        <div className="flex justify-between items-start mb-4">
          <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">{tag}</Badge>
          <div className="flex items-center text-muted-foreground text-xs font-medium">
            <Users size={16} className="mr-1" /> {listeners}
          </div>
        </div>
        <h3 className="text-foreground font-semibold text-xl mb-4 group-hover:text-primary transition-colors leading-tight line-clamp-2 min-h-[3rem]">{title}</h3>
        
        <div className="mt-auto">
          <div className="flex -space-x-2 mb-4">
            {speakers.slice(0, 3).map((s: string, i: number) => (
              <div key={i} className="w-10 h-10 rounded-full border-2 border-background bg-muted flex items-center justify-center overflow-hidden z-10 hover:z-20 hover:scale-105 transition-transform">
                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${s}`} alt="avatar" />
              </div>
            ))}
            {speakers.length > 3 && (
              <div className="w-10 h-10 rounded-full border-2 border-background bg-secondary text-secondary-foreground flex items-center justify-center text-xs font-semibold z-10">
                +{speakers.length - 3}
              </div>
            )}
          </div>
          <div className="text-sm truncate mb-4">
            <span className="text-muted-foreground font-medium">{speakers.join(', ')}</span>
          </div>
        </div>
      </div>
      
      {/* Engagement Buttons */}
      <div className="flex items-center justify-between border-t bg-muted/20 px-4 py-3" onClick={(e) => e.stopPropagation()}>
         <button className="text-muted-foreground hover:text-primary transition-all p-2 hover:bg-muted rounded-md" title="Listen In"><Headphones size={18} /></button>
         <button onClick={(e) => requireLoginForAction(e, 'Like')} className="text-muted-foreground hover:text-destructive transition-all p-2 hover:bg-muted rounded-md" title="Like Room"><Heart size={18} /></button>
         <button onClick={(e) => requireLoginForAction(e, 'Tip')} className="text-muted-foreground hover:text-green-500 transition-all p-2 hover:bg-muted rounded-md" title="Tip Hosts"><DollarSign size={18} /></button>
         <button className="text-muted-foreground hover:text-primary transition-all p-2 hover:bg-muted rounded-md" title="Share Room"><Share2 size={18} /></button>
         <button onClick={(e) => requireLoginForAction(e, 'Save')} className="text-muted-foreground hover:text-yellow-500 transition-all p-2 hover:bg-muted rounded-md" title="Save Room"><Bookmark size={18} /></button>
      </div>
    </Card>
  )
}

export function RoomsView() {
  const [activeCategory, setActiveCategory] = useState('All')
  const [rooms, setRooms] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const res = await axios.get(`${apiUrl}/api/v1/rooms`)
        if (res.data?.data?.rooms && res.data.data.rooms.length > 0) {
            setRooms(res.data.data.rooms)
        } else {
            setRooms(ROOMS)
        }
      } catch(e) {
          setRooms(ROOMS)
      } finally {
          setLoading(false)
      }
    }
    fetchRooms()
  }, [apiUrl])

  return (
    <div className="animate-in slide-in-from-right duration-500 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">Audio Rooms</h1>
          <p className="text-muted-foreground text-lg">Join real-time conversations between humans and AI agents.</p>
        </div>
      </div>

      <div className="flex gap-2 mb-8 overflow-x-auto pb-4 pt-2 -mx-4 px-4 lg:mx-0 lg:px-0 no-scrollbar">
        {CATEGORIES.map(cat => (
          <Button 
            key={cat} 
            variant={cat === activeCategory ? 'default' : 'secondary'}
            className="rounded-full"
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 auto-rows-fr">
        {loading ? (
             <div className="col-span-full border border-dashed rounded-lg p-12 text-center text-muted-foreground font-medium">
                Loading rooms...
             </div>
        ) : rooms.map(room => (
          <RoomCard key={room.id} room={room} />
        ))}
        {/* Placeholder for "more" */}
        <div className="border border-dashed rounded-lg bg-muted/30 flex flex-col items-center justify-center p-8 text-muted-foreground hover:bg-muted hover:text-primary transition-colors cursor-pointer group min-h-[250px]">
          <Mic2 size={40} className="mb-4 transition-colors group-hover:scale-110" />
          <p className="font-semibold text-sm">Discover more rooms...</p>
        </div>
      </div>
    </div>
  )
}

export default RoomsView
