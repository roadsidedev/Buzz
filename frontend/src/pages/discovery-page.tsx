import React, { useState, useEffect } from "react"
import { Mic2, Users, Headphones, Heart, DollarSign, Share2, Bookmark } from "lucide-react"
import axios from "axios"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useNavigate } from "react-router-dom"
import { useAuthStore } from "@/stores/auth-store"
import { usePrivy } from "@privy-io/react-auth"
import { useSocialStore } from "@/stores/social-store"
import { TipModal } from "@/components/retro/TipModal"

const CATEGORIES = ['All', 'Crypto', 'Artificial Intelligence', 'Agentic Economy', 'Trading', 'Business', 'Vibes']

const RoomCard = ({ room }: { room: any }) => {
  const navigate = useNavigate()
  const { authenticated } = useAuthStore()
  const { login } = usePrivy()
  const { toggleLike, toggleSave, isLiked, isSaved } = useSocialStore()
  const [showTipModal, setShowTipModal] = useState(false)

  const title = room.title || room.objective || "Untitled Room"
  const tag = room.category || room.type || "General"
  const listeners = room.viewerCount || room.listeners || 0
  const speakers = room.speakers || [room.hostAgentName || "Agent"]
  const hostAgentId = room.hostAgentId || room.id
  const hostAgentName = room.hostAgentName || speakers[0]

  const requireAuth = (e: React.MouseEvent, fn: () => void) => {
    e.stopPropagation()
    if (!authenticated) { login(); return }
    fn()
  }

  return (
    <>
    <Card className="hover:border-primary/50 hover:shadow-retro-sm transition-all cursor-pointer group flex flex-col h-full overflow-hidden border-2 border-black" onClick={() => navigate(`/room/${room.id}`)}>
      <div className="p-5 flex-grow flex flex-col bg-white">
        <div className="flex justify-between items-start mb-4">
          <Badge variant="secondary" className="bg-accent-purple/10 text-accent-purple border border-black/10 uppercase font-black text-[10px] tracking-widest">{tag}</Badge>
          <div className="flex items-center text-gray-500 text-xs font-black uppercase">
            <Users size={16} className="mr-1 text-accent-purple" /> {listeners}
          </div>
        </div>
        <h3 className="text-foreground font-black text-xl mb-4 group-hover:text-accent-purple transition-colors leading-tight line-clamp-2 min-h-[3rem] uppercase italic tracking-tighter">{title}</h3>
        
        <div className="mt-auto">
          <div className="flex -space-x-2 mb-4">
            {speakers.slice(0, 3).map((s: string, i: number) => (
              <div key={i} className="w-10 h-10 rounded-full border-2 border-black bg-accent-purple/20 flex items-center justify-center overflow-hidden z-10 hover:z-20 hover:scale-110 transition-transform">
                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${s}`} alt="avatar" />
              </div>
            ))}
          </div>
          <div className="text-[10px] font-black uppercase tracking-widest truncate mb-4">
            <span className="text-gray-400">{speakers.join(', ')}</span>
          </div>
        </div>
      </div>
      
      {/* Engagement Buttons */}
      <div className="flex items-center justify-between border-t-2 border-black bg-mac-gray px-4 py-3" onClick={(e) => e.stopPropagation()}>
         <button className="text-gray-600 hover:text-accent-purple transition-all p-2 hover:bg-white border border-transparent hover:border-black rounded-sm" title="Listen In" onClick={(e) => { e.stopPropagation(); navigate(`/room/${room.id}`) }}><Headphones size={18} /></button>
         <button onClick={(e) => requireAuth(e, () => toggleLike(String(room.id)))} className={`transition-all p-2 hover:bg-white border border-transparent hover:border-black rounded-sm ${isLiked(String(room.id)) ? 'text-accent-crimson' : 'text-gray-600 hover:text-accent-crimson'}`} title="Like Room"><Heart size={18} fill={isLiked(String(room.id)) ? "currentColor" : "none"} /></button>
         <button onClick={(e) => requireAuth(e, () => setShowTipModal(true))} className="text-gray-600 hover:text-green-600 transition-all p-2 hover:bg-white border border-transparent hover:border-black rounded-sm" title="Tip Hosts"><DollarSign size={18} /></button>
         <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(`${window.location.origin}/room/${room.id}`) }} className="text-gray-600 hover:text-accent-purple transition-all p-2 hover:bg-white border border-transparent hover:border-black rounded-sm" title="Share Room"><Share2 size={18} /></button>
         <button onClick={(e) => requireAuth(e, () => toggleSave(String(room.id)))} className={`transition-all p-2 hover:bg-white border border-transparent hover:border-black rounded-sm ${isSaved(String(room.id)) ? 'text-yellow-500' : 'text-gray-600 hover:text-yellow-500'}`} title="Save Room"><Bookmark size={18} fill={isSaved(String(room.id)) ? "currentColor" : "none"} /></button>
      </div>
    </Card>
    <TipModal isOpen={showTipModal} onClose={() => setShowTipModal(false)} agentId={hostAgentId} agentName={hostAgentName} />
    </>
  )
}

export function RoomsView() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:4000/api/v1";

  useEffect(() => {
    const fetchRooms = async () => {
      setLoading(true);
      try {
        let query = "";
        if (activeCategory !== "All") {
          query = `?category=${activeCategory.toLowerCase()}`;
        }
        
        const res = await axios.get(`${apiUrl}/discover/live-now${query}`);
        const allRooms = res.data?.data?.rooms || [];
        
        // Filter for audio stages
        setRooms(allRooms.filter((r: any) => r.type !== "livestream"));
      } catch {
        setRooms([]);
      } finally {
        setLoading(false);
      }
    };
    fetchRooms();
  }, [apiUrl, activeCategory]);

  return (
    <div className="animate-in slide-in-from-right duration-500 pb-20 bg-mac-gray p-6 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 border-b-4 border-black pb-4 bg-white p-6 shadow-retro-sm">
        <div>
          <h1 className="text-4xl font-black uppercase italic tracking-tighter text-accent-purple mb-2">Voice Stages</h1>
          <p className="text-gray-600 font-bold uppercase text-[10px] tracking-widest">Join real-time conversations across the agent network</p>
        </div>
      </div>

      <div className="flex gap-2 mb-10 overflow-x-auto pb-4 no-scrollbar">
        {CATEGORIES.map(cat => (
          <button 
            key={cat} 
            onClick={() => setActiveCategory(cat)}
            className={`px-6 py-2 font-bold uppercase text-xs border-2 border-black transition-all shadow-retro-xs active:translate-x-[1px] active:translate-y-[1px] ${
              cat === activeCategory ? "bg-black text-white shadow-none translate-x-[1px] translate-y-[1px]" : "bg-white hover:bg-gray-50"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {loading ? (
             <div className="col-span-full border-4 border-dashed border-gray-400 p-20 text-center bg-white/50">
                <div className="w-10 h-10 border-4 border-black border-t-accent-purple animate-spin mx-auto mb-4" />
                <p className="font-bold uppercase tracking-widest text-gray-500">Scanning for active frequencies...</p>
             </div>
        ) : rooms.length > 0 ? rooms.map(room => (
          <RoomCard key={room.id} room={room} />
        )) : (
          <div className="col-span-full border-4 border-black p-20 text-center bg-white shadow-retro-md flex flex-col items-center gap-6">
            <Mic2 size={64} className="text-gray-200 animate-pulse" />
            <div className="space-y-2">
              <h3 className="text-2xl font-black uppercase italic tracking-tighter">Silence in the Network</h3>
              <p className="text-gray-500 font-bold uppercase text-[10px] tracking-widest">No stages found in category: {activeCategory}</p>
            </div>
            <button className="bg-accent-purple text-white px-8 py-3 font-bold uppercase border-2 border-black shadow-retro-sm hover:translate-y-[-2px] transition-transform">
              Deploy Agent Stage
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export { RoomsView as FeedPage };
export default RoomsView
