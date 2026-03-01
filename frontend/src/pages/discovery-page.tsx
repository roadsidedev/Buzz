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
    <Card className="hover:border-accent-purple hover:shadow-retro-purple transition-all cursor-pointer group flex flex-col h-full" onClick={() => navigate(`/room/${room.id}`)}>
      <div className="flex justify-between items-start mb-4">
        <Badge variant="secondary" className="bg-accent-teal/20 text-accent-teal border-transparent tracking-widest uppercase">{tag}</Badge>
        <div className="flex items-center text-base-gray-500 text-xs font-bold">
          <Users size={16} className="mr-1" /> {listeners}
        </div>
      </div>
      <h3 className="text-mac-charcoal font-bold text-xl mb-4 group-hover:text-accent-purple transition-colors uppercase leading-tight line-clamp-2 min-h-[3rem]">{title}</h3>
      
      <div className="mt-auto">
        <div className="flex -space-x-3 mb-4">
          {speakers.slice(0, 3).map((s: string, i: number) => (
            <div key={i} className="w-11 h-11 rounded-full border-2 border-mac-charcoal bg-mac-gray flex items-center justify-center overflow-hidden z-10 hover:z-20 hover:scale-105 transition-transform">
              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${s}`} alt="avatar" />
            </div>
          ))}
          {speakers.length > 3 && (
            <div className="w-11 h-11 rounded-full border-2 border-mac-charcoal bg-mac-charcoal text-mac-white flex items-center justify-center text-xs font-bold z-10">
              +{speakers.length - 3}
            </div>
          )}
        </div>
        <div className="text-sm truncate mb-4">
          <span className="text-base-gray-700 font-bold">{speakers.join(', ')}</span>
        </div>
        
        {/* Engagement Buttons */}
        <div className="flex items-center justify-between border-t-4 border-mac-charcoal pt-4 mt-4" onClick={(e) => e.stopPropagation()}>
           <button className="text-mac-charcoal hover:text-accent-purple transition-all p-2 hover:bg-mac-white border-2 border-transparent hover:border-mac-charcoal hover:-translate-y-1 hover:shadow-retro-sm" title="Listen In"><Headphones size={20} /></button>
           <button onClick={(e) => requireLoginForAction(e, 'Like')} className="text-mac-charcoal hover:text-accent-crimson transition-all p-2 hover:bg-mac-white border-2 border-transparent hover:border-mac-charcoal hover:-translate-y-1 hover:shadow-retro-sm" title="Like Room"><Heart size={20} /></button>
           <button onClick={(e) => requireLoginForAction(e, 'Tip')} className="text-mac-charcoal hover:text-accent-teal transition-all p-2 hover:bg-mac-white border-2 border-transparent hover:border-mac-charcoal hover:-translate-y-1 hover:shadow-retro-sm" title="Tip Hosts"><DollarSign size={20} /></button>
           <button className="text-mac-charcoal hover:text-accent-purple transition-all p-2 hover:bg-mac-white border-2 border-transparent hover:border-mac-charcoal hover:-translate-y-1 hover:shadow-retro-sm" title="Share Room"><Share2 size={20} /></button>
           <button onClick={(e) => requireLoginForAction(e, 'Save')} className="text-mac-charcoal hover:text-accent-yellow transition-all p-2 hover:bg-mac-white border-2 border-transparent hover:border-mac-charcoal hover:-translate-y-1 hover:shadow-retro-sm" title="Save Room"><Bookmark size={20} /></button>
        </div>
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
          <h1 className="text-4xl font-bold uppercase tracking-tighter mb-2 text-shadow-sm">Audio Rooms</h1>
          <p className="text-base-gray-600 font-bold">Join real-time conversations between humans and AI agents.</p>
        </div>
      </div>

      <div className="flex gap-3 mb-8 overflow-x-auto pb-4 pt-2 -mx-4 px-4 lg:mx-0 lg:px-0 no-scrollbar">
        {CATEGORIES.map(cat => (
          <Button 
            key={cat} 
            variant={cat === activeCategory ? 'default' : 'outline'}
            className={`rounded-full whitespace-nowrap uppercase tracking-widest ${cat === activeCategory ? 'shadow-retro-sm' : ''}`}
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 auto-rows-fr">
        {loading ? (
             <div className="col-span-full border-2 border-dashed border-mac-charcoal p-12 text-center text-mac-charcoal font-bold uppercase tracking-widest">
                Loading rooms...
             </div>
        ) : rooms.map(room => (
          <RoomCard key={room.id} room={room} />
        ))}
        {/* Placeholder for "more" */}
        <div className="border-2 border-dashed border-mac-charcoal bg-mac-gray/50 flex flex-col items-center justify-center p-8 opacity-70 hover:opacity-100 transition-opacity cursor-pointer hover:bg-mac-white group hover:shadow-retro-purple min-h-[250px]">
          <Mic2 size={48} className="text-base-gray-400 group-hover:text-accent-purple mb-4 transition-colors" />
          <p className="text-mac-charcoal font-bold uppercase tracking-widest text-center">Discover more rooms...</p>
        </div>
      </div>
    </div>
  )
}

export default RoomsView
