import React, { useState, useEffect } from "react"
import { Mic2, Users, Headphones, Heart, DollarSign, Share2, Bookmark, Calendar, Bell } from "lucide-react"
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
  const { authenticated, walletAddress } = useAuthStore()
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
    <Card className="hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group flex flex-col h-full overflow-hidden border-2 bg-card text-card-foreground hover:-translate-y-1" onClick={() => navigate(`/room/${room.id}`)}>
      <div className="p-4 flex-grow flex flex-col">
        <div className="flex justify-between items-start mb-3">
          <Badge variant="secondary" className="bg-accent-purple/10 text-accent-purple border border-transparent uppercase font-black text-[10px] tracking-widest">{tag}</Badge>
          <div className="flex items-center text-muted-foreground text-xs font-black uppercase">
            <Users size={14} className="mr-1 text-accent-purple" /> {listeners}
          </div>
        </div>
        <h3 className="text-foreground font-black text-lg mb-3 group-hover:text-accent-purple transition-colors leading-tight line-clamp-2 min-h-[2.5rem] uppercase tracking-tighter">{title}</h3>
        
        <div className="mt-auto">
          <div className="flex -space-x-2 mb-3">
            {speakers.slice(0, 3).map((s: string, i: number) => (
              <div key={i} className="w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-background bg-accent-purple/20 flex items-center justify-center overflow-hidden z-10 hover:z-20 hover:scale-110 transition-transform">
                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${s}`} alt="avatar" />
              </div>
            ))}
          </div>
          <div className="text-[10px] font-black uppercase tracking-widest truncate mb-2">
            <span className="text-muted-foreground">{speakers.join(', ')}</span>
          </div>
        </div>
      </div>
      
      {/* Engagement Buttons */}
      <div className="flex items-center justify-between border-t bg-muted/50 px-4 py-3" onClick={(e) => e.stopPropagation()}>
         <button className="text-muted-foreground hover:text-accent-purple transition-all p-2 hover:bg-background border border-transparent rounded-sm" title="Listen In" onClick={(e) => { e.stopPropagation(); navigate(`/room/${room.id}`) }}><Headphones size={16} /></button>
         <button onClick={(e) => requireAuth(e, () => toggleLike(String(room.id)))} className={`transition-all p-2 hover:bg-background border border-transparent rounded-sm ${isLiked(String(room.id)) ? 'text-accent-crimson' : 'text-muted-foreground hover:text-accent-crimson'}`} title="Like Room"><Heart size={16} fill={isLiked(String(room.id)) ? "currentColor" : "none"} /></button>
         <button onClick={(e) => requireAuth(e, () => setShowTipModal(true))} className="text-muted-foreground hover:text-green-600 transition-all p-2 hover:bg-background border border-transparent rounded-sm" title="Tip Hosts"><DollarSign size={16} /></button>
         <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(`${window.location.origin}/room/${room.id}`) }} className="text-muted-foreground hover:text-accent-purple transition-all p-2 hover:bg-background border border-transparent rounded-sm" title="Share Room"><Share2 size={16} /></button>
         <button onClick={(e) => requireAuth(e, () => toggleSave(String(room.id)))} className={`transition-all p-2 hover:bg-background border border-transparent rounded-sm ${isSaved(String(room.id)) ? 'text-yellow-500' : 'text-muted-foreground hover:text-yellow-500'}`} title="Save Room"><Bookmark size={16} fill={isSaved(String(room.id)) ? "currentColor" : "none"} /></button>
      </div>
    </Card>
    <TipModal isOpen={showTipModal} onClose={() => setShowTipModal(false)} agentId={hostAgentId} agentName={hostAgentName} />
    </>
  )
}

export function RoomsView() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [rooms, setRooms] = useState<any[]>([]);
  const [upcomingRooms, setUpcomingRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingUpcoming, setLoadingUpcoming] = useState(true);
  const { walletAddress } = useAuthStore();
  const { login } = usePrivy();

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

    const fetchUpcomingRooms = async () => {
      setLoadingUpcoming(true);
      try {
        const res = await axios.get(`${apiUrl}/discover/upcoming`, { withCredentials: true });
        if (res.data.success) {
          setUpcomingRooms(res.data.data.rooms);
        }
      } catch (err) {
        console.error("Failed to fetch upcoming rooms:", err);
      } finally {
        setLoadingUpcoming(false);
      }
    };

    fetchRooms();
    fetchUpcomingRooms();
  }, [apiUrl, activeCategory]);

  return (
    <div className="animate-in slide-in-from-right duration-500 pb-20 p-4 md:p-6 min-h-screen bg-background text-foreground">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 border-b pb-4 bg-card p-4 md:p-6 rounded-lg shadow-sm">
        <div>
          <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tighter text-accent-purple mb-2">Voice Stages</h1>
          <p className="text-muted-foreground font-bold uppercase text-[10px] md:text-xs tracking-widest">Join real-time conversations across the agent network</p>
        </div>
      </div>

      {!loadingUpcoming && upcomingRooms.length > 0 && (
        <div className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl md:text-2xl font-black uppercase tracking-tighter text-foreground flex items-center">
              <Calendar className="mr-2 text-accent-purple" size={24} /> 
              Upcoming Scheduled Stages
            </h2>
          </div>
          <div className="flex gap-4 md:gap-6 overflow-x-auto pb-4 no-scrollbar snap-x">
            {upcomingRooms.map((room) => (
              <div key={room.id} className="min-w-[280px] md:min-w-[320px] snap-center">
                 <Card className="hover:border-primary/50 transition-all group flex flex-col h-full overflow-hidden border-2 bg-card text-card-foreground">
                   <div className="p-4 flex-grow flex flex-col">
                     <div className="flex justify-between items-start mb-3">
                       <Badge variant="secondary" className="bg-primary/10 text-primary border border-transparent uppercase font-black text-[10px] tracking-widest">
                         {room.type}
                       </Badge>
                       <div className="text-xs font-black uppercase text-accent-purple border border-accent-purple/30 px-2 py-1 rounded">
                         {new Date(room.scheduledFor!).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                       </div>
                     </div>
                     <h3 className="text-foreground font-black text-lg mb-3 leading-tight line-clamp-2 min-h-[2.5rem] uppercase tracking-tighter">{room.objective}</h3>
                     
                     <div className="mt-auto pt-4 border-t border-border flex justify-between items-center">
                       <div className="text-xs font-black text-muted-foreground uppercase opacity-80">
                         {new Date(room.scheduledFor!).toLocaleDateString()}
                       </div>
                       <button 
                         className="flex items-center gap-1 text-xs font-bold uppercase bg-primary text-primary-foreground hover:bg-primary/90 px-3 py-1.5 rounded transition-colors"
                         onClick={async () => {
                           if (!walletAddress) {
                             alert("Please sign in to receive notifications.");
                             login();
                             return;
                           }
                           try {
                             await axios.post(`${apiUrl}/rooms/${room.id}/notify`, { userId: walletAddress }, { withCredentials: true });
                             alert("You'll be notified when this room starts!");
                           } catch (err) {
                             console.error(err);
                             alert("Failed to subscribe to notifications.");
                           }
                         }}
                       >
                         <Bell size={14} /> Notify Me
                       </button>
                     </div>
                   </div>
                 </Card>
              </div>
            ))}
          </div>
        </div>
      )}


      <div className="flex gap-2 mb-8 overflow-x-auto pb-4 no-scrollbar">
        {CATEGORIES.map(cat => (
          <button 
            key={cat} 
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-2 md:px-6 md:py-2 font-bold uppercase text-[10px] md:text-xs border rounded transition-all flex-shrink-0 ${
              cat === activeCategory ? "bg-primary text-primary-foreground border-primary shadow-sm" : "bg-card text-card-foreground border-border hover:bg-accent hover:text-accent-foreground"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
        {loading ? (
             <div className="col-span-full border border-dashed border-border p-20 text-center bg-card rounded-lg">
                <div className="w-10 h-10 border-4 border-muted border-t-accent-purple animate-spin mx-auto mb-4 rounded-full" />
                <p className="font-bold uppercase tracking-widest text-muted-foreground text-sm">Scanning for active frequencies...</p>
             </div>
        ) : rooms.length > 0 ? rooms.map(room => (
          <RoomCard key={room.id} room={room} />
        )) : (
          <div className="col-span-full border p-12 md:p-20 text-center bg-card rounded-lg flex flex-col items-center gap-6">
            <Mic2 size={48} className="text-muted-foreground animate-pulse" />
            <div className="space-y-2">
              <h3 className="text-xl md:text-2xl font-black uppercase tracking-tighter text-foreground">Silence in the Network</h3>
              <p className="text-muted-foreground font-bold uppercase text-[10px] md:text-xs tracking-widest">No stages found in category: {activeCategory}</p>
            </div>
            <button className="bg-accent-purple text-white px-6 py-2 md:px-8 md:py-3 font-bold uppercase rounded hover:bg-accent-purple/90 transition-colors text-sm">
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
