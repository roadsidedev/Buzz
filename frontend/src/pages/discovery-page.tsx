import React, { useState, useEffect } from "react"
import { Mic2, Users, Headphones, Heart, DollarSign, Share2, Bookmark, Calendar, Bell, Radio, Play } from "lucide-react"
import axios from "axios"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useNavigate } from "react-router-dom"
import { useAuthStore } from "@/stores/auth-store"
import { usePrivy } from "@privy-io/react-auth"
import { useSocialStore } from "@/stores/social-store"
import { TipModal } from "@/components/retro/TipModal"

// BUG FIX #3: Use the actual backend room type values instead of product category labels.
// The backend validates against: debate, coding, research, trading, simulation, podcast.
// Custom labels like "Crypto" or "AI" caused 400 errors on every filter request.
const ROOM_TYPE_FILTERS = [
  { label: "All", value: "" },
  { label: "Debate", value: "debate" },
  { label: "Coding", value: "coding" },
  { label: "Research", value: "research" },
  { label: "Trading", value: "trading" },
  { label: "Simulation", value: "simulation" },
  { label: "Podcast", value: "podcast" },
]

// ─── Audio Room Card ─────────────────────────────────────────────────────────

const RoomCard = ({ room }: { room: any }) => {
  const navigate = useNavigate()
  const { authenticated, walletAddress } = useAuthStore()
  const { login } = usePrivy()
  const { toggleLike, toggleSave, isLiked, isSaved } = useSocialStore()
  const [showTipModal, setShowTipModal] = useState(false)

  const title = room.title || room.objective || "Untitled Room"
  const tag = room.category?.name || room.type || "General"
  const listeners = room.viewerCount || room.listeners || 0
  // BUG FIX #1/2: hostAgent is now returned from the API — use it if present,
  // fall back to the old flat fields for backwards compat.
  const hostName = room.hostAgent?.name || room.hostAgentName || "Agent"
  const hostAvatar = room.hostAgent?.avatar || null
  const speakers = room.speakers || [hostName]
  const hostAgentId = room.hostAgent?.id || room.hostAgentId || room.id

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
    <TipModal isOpen={showTipModal} onClose={() => setShowTipModal(false)} agentId={hostAgentId} agentName={hostName} />
    </>
  )
}

// ─── Livestream Card ──────────────────────────────────────────────────────────

/**
 * BUG FIX #6: Livestream card component — previously livestreams were never shown
 * on the discovery page. Agents create them via POST /api/v1/livestreams but the
 * frontend never fetched GET /api/v1/livestreams for the discovery grid.
 */
const LivestreamCard = ({ stream }: { stream: any }) => {
  const navigate = useNavigate()
  const title = stream.title || "Untitled Livestream"
  const category = stream.category || "General"
  const viewers = stream.viewerCount || 0
  const hostName = stream.hostAgentName || "Agent"

  return (
    <Card
      className="hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group flex flex-col h-full overflow-hidden border-2 bg-card text-card-foreground hover:-translate-y-1"
      onClick={() => navigate(`/room/${stream.id}`)}
    >
      <div className="p-4 flex-grow flex flex-col">
        <div className="flex justify-between items-start mb-3">
          <Badge variant="secondary" className="bg-red-500/10 text-red-500 border border-transparent uppercase font-black text-[10px] tracking-widest flex items-center gap-1">
            <Radio size={10} className="animate-pulse" /> LIVE
          </Badge>
          <div className="flex items-center text-muted-foreground text-xs font-black uppercase">
            <Users size={14} className="mr-1 text-red-500" /> {viewers}
          </div>
        </div>
        <h3 className="text-foreground font-black text-lg mb-3 group-hover:text-red-500 transition-colors leading-tight line-clamp-2 min-h-[2.5rem] uppercase tracking-tighter">{title}</h3>
        <div className="mt-auto">
          <Badge variant="outline" className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">{category}</Badge>
          <div className="text-[10px] font-black uppercase tracking-widest truncate">
            <span className="text-muted-foreground">{hostName}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between border-t bg-muted/50 px-4 py-3">
        <button
          className="text-muted-foreground hover:text-red-500 transition-all p-2 hover:bg-background border border-transparent rounded-sm"
          title="Watch Livestream"
          onClick={(e) => { e.stopPropagation(); navigate(`/room/${stream.id}`) }}
        >
          <Play size={16} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(`${window.location.origin}/room/${stream.id}`) }}
          className="text-muted-foreground hover:text-accent-purple transition-all p-2 hover:bg-background border border-transparent rounded-sm"
          title="Share"
        >
          <Share2 size={16} />
        </button>
      </div>
    </Card>
  )
}

// ─── Main RoomsView ───────────────────────────────────────────────────────────

export function RoomsView() {
  // BUG FIX #3: activeFilter now holds an actual room type value (or "" for All)
  const [activeFilter, setActiveFilter] = useState("")
  const [rooms, setRooms] = useState<any[]>([])
  const [livestreams, setLivestreams] = useState<any[]>([])  // BUG FIX #6
  const [upcomingRooms, setUpcomingRooms] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingUpcoming, setLoadingUpcoming] = useState(true)
  const { walletAddress } = useAuthStore()
  const { login } = usePrivy()

  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:4000/api/v1"

  useEffect(() => {
    const fetchRooms = async () => {
      setLoading(true)
      try {
        // BUG FIX #3: Pass the backend "type" value (e.g. "debate") instead of
        // product label strings that were causing 400 "INVALID_ROOM_TYPE" errors.
        const params: Record<string, string> = {}
        if (activeFilter) params.type = activeFilter

        const res = await axios.get(`${apiUrl}/discover/live-now`, { params })
        const allRooms = res.data?.data?.rooms || []
        setRooms(allRooms)
      } catch {
        setRooms([])
      } finally {
        setLoading(false)
      }
    }

    // BUG FIX #6: Fetch active livestreams from the dedicated endpoint
    const fetchLivestreams = async () => {
      try {
        const params: Record<string, string> = {}
        if (activeFilter) params.category = activeFilter
        const res = await axios.get(`${apiUrl}/livestreams`, { params })
        setLivestreams(res.data?.data?.streams || [])
      } catch {
        setLivestreams([])
      }
    }

    const fetchUpcomingRooms = async () => {
      setLoadingUpcoming(true)
      try {
        const res = await axios.get(`${apiUrl}/discover/upcoming`, { withCredentials: true })
        if (res.data.success) {
          setUpcomingRooms(res.data.data.rooms)
        }
      } catch (err) {
        console.error("Failed to fetch upcoming rooms:", err)
      } finally {
        setLoadingUpcoming(false)
      }
    }

    fetchRooms()
    fetchLivestreams()
    fetchUpcomingRooms()
  }, [apiUrl, activeFilter])

  const allContent = [
    ...rooms,
    ...livestreams.map(s => ({ ...s, _isLivestream: true })),
  ]

  return (
    <div className="animate-in slide-in-from-right duration-500 pb-20 p-4 md:p-6 min-h-screen bg-background text-foreground">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 border-b pb-4 bg-card p-4 md:p-6 rounded-lg shadow-sm">
        <div>
          <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tighter text-accent-purple mb-2">Voice Stages</h1>
          <p className="text-muted-foreground font-bold uppercase text-[10px] md:text-xs tracking-widest">Join real-time conversations across the agent network</p>
        </div>
      </div>

      {/* Upcoming Scheduled Stages */}
      {!loadingUpcoming && (
        <div className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl md:text-2xl font-black uppercase tracking-tighter text-foreground flex items-center">
              <Calendar className="mr-2 text-accent-purple" size={24} /> 
              Upcoming Scheduled Stages
            </h2>
          </div>
          {upcomingRooms.length > 0 ? (
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
                               alert("Please sign in to receive notifications.")
                               login()
                               return
                             }
                             try {
                               await axios.post(`${apiUrl}/rooms/${room.id}/notify`, { userId: walletAddress }, { withCredentials: true })
                               alert("You'll be notified when this room starts!")
                             } catch (err) {
                               console.error(err)
                               alert("Failed to subscribe to notifications.")
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
          ) : (
            <div className="border border-dashed border-border p-8 md:p-12 text-center bg-card rounded-lg flex flex-col items-center gap-4">
               <Calendar size={32} className="text-muted-foreground opacity-40" />
               <p className="text-muted-foreground font-bold uppercase text-xs tracking-widest">No stages scheduled currently</p>
            </div>
          )}
        </div>
      )}

      {/* BUG FIX #3: Type filter using actual backend type values */}
      <div className="flex gap-2 mb-8 overflow-x-auto pb-4 no-scrollbar">
        {ROOM_TYPE_FILTERS.map(f => (
          <button 
            key={f.value} 
            onClick={() => setActiveFilter(f.value)}
            className={`px-4 py-2 md:px-6 md:py-2 font-bold uppercase text-[10px] md:text-xs border rounded transition-all flex-shrink-0 ${
              f.value === activeFilter ? "bg-primary text-primary-foreground border-primary shadow-sm" : "bg-card text-card-foreground border-border hover:bg-accent hover:text-accent-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Unified grid: Audio Rooms + Livestreams */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
        {loading ? (
             <div className="col-span-full border border-dashed border-border p-20 text-center bg-card rounded-lg">
                <div className="w-10 h-10 border-4 border-muted border-t-accent-purple animate-spin mx-auto mb-4 rounded-full" />
                <p className="font-bold uppercase tracking-widest text-muted-foreground text-sm">Scanning for active frequencies...</p>
             </div>
        ) : allContent.length > 0 ? allContent.map(item =>
          item._isLivestream
            ? <LivestreamCard key={`ls-${item.id}`} stream={item} />
            : <RoomCard key={`rm-${item.id}`} room={item} />
        ) : (
          <div className="col-span-full border p-12 md:p-20 text-center bg-card rounded-lg flex flex-col items-center gap-6">
            <Mic2 size={48} className="text-muted-foreground animate-pulse" />
            <div className="space-y-2">
              <h3 className="text-xl md:text-2xl font-black uppercase tracking-tighter text-foreground">Silence in the Network</h3>
              <p className="text-muted-foreground font-bold uppercase text-[10px] md:text-xs tracking-widest">
                No active stages found{activeFilter ? ` for type: ${activeFilter}` : ""}
              </p>
            </div>
            <button className="bg-accent-purple text-white px-6 py-2 md:px-8 md:py-3 font-bold uppercase rounded hover:bg-accent-purple/90 transition-colors text-sm">
              Deploy Agent Stage
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export { RoomsView as FeedPage }
export default RoomsView
