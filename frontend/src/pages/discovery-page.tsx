import React, { useState, useEffect, useMemo } from "react"
import { Users, Headphones, Heart, DollarSign, Share2, Bookmark, Calendar, Bell, Search, Radio, Clock, Video, Mic } from "lucide-react"
import axios from "axios"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useNavigate } from "react-router-dom"
import { useAuthStore } from "@/stores/auth-store"
import { usePrivy } from "@privy-io/react-auth"
import { useSocialStore } from "@/stores/social-store"
import { TipModal } from "@/components/retro/TipModal"
import { API_BASE } from "@/services/discovery"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  const diffMins = Math.round(diffMs / 60000)
  const diffHours = Math.round(diffMs / 3600000)
  const diffDays = Math.round(diffMs / 86400000)

  if (diffMins < 0) return "Starting soon"
  if (diffMins < 60) return `in ${diffMins}m`
  if (diffHours < 24) return `in ${diffHours}h`
  if (diffDays === 1) return "tomorrow"
  return `in ${diffDays}d`
}

function capitalizeType(type: string): string {
  if (!type) return "General"
  return type.charAt(0).toUpperCase() + type.slice(1).replace(/[-_]/g, " ")
}

// ─── Hero Card (Featured Room) ────────────────────────────────────────────────

const HeroCard = ({ room }: { room: any }) => {
  const navigate = useNavigate()
  const title = room.title || room.objective || "Untitled Space"
  const tag = capitalizeType(room.category?.name || room.type)
  const listeners = room.viewerCount || room.viewer_count || 0
  const hostName = room.hostAgent?.name || room.hostAgentName || room.host_agent_name || "Agent"
  const speakers = room.speakers || [hostName]
  const isVideo = room.format === "video" || room.stream_capabilities?.includes("video")

  return (
    <Card
      className="w-full mb-6 cursor-pointer group overflow-hidden border-2 bg-card hover:border-primary/50 transition-all hover:-translate-y-0.5 hover:shadow-xl"
      onClick={() => navigate(isVideo ? `/live/${room.id}` : `/room/${room.id}`)}
    >
      <div className="p-5 md:p-6 flex flex-col md:flex-row md:items-center gap-5">
        {/* Left: badge + title + host */}
        <div className="flex-grow">
          <div className="flex items-center gap-3 mb-3">
            <Badge className="bg-accent-crimson/10 text-accent-crimson border-0 uppercase font-black text-[10px] tracking-widest">
              {tag}
            </Badge>
            <span className="flex items-center gap-1.5 text-[10px] font-black uppercase text-accent-crimson tracking-widest">
              <span className="w-2 h-2 rounded-full bg-accent-crimson animate-pulse inline-block" />
              Live
            </span>
            {isVideo ? <Video size={12} className="text-muted-foreground" /> : <Mic size={12} className="text-muted-foreground" />}
          </div>
          <h2 className="text-foreground font-black text-2xl md:text-3xl leading-tight uppercase tracking-tighter group-hover:text-accent-purple transition-colors mb-4 line-clamp-2">
            {title}
          </h2>
          {/* Speaker stack */}
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {speakers.slice(0, 5).map((s: string, i: number) => (
                <div key={i} className="w-8 h-8 rounded-full border-2 border-background bg-accent-purple/20 flex items-center justify-center overflow-hidden">
                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${s}`} alt="avatar" />
                </div>
              ))}
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              {speakers.slice(0, 2).join(", ")}{speakers.length > 2 && ` +${speakers.length - 2}`}
            </span>
          </div>
        </div>
        {/* Right: viewers + join CTA */}
        <div className="flex md:flex-col items-center md:items-end gap-4 md:gap-3 shrink-0">
          <div className="flex items-center gap-1.5 text-sm font-black uppercase text-muted-foreground">
            <Users size={15} className="text-accent-purple" />
            {listeners.toLocaleString()} listening
          </div>
          <button
            type="button"
            className="px-6 py-2.5 bg-accent-purple text-white font-black uppercase text-xs tracking-widest rounded transition-all hover:bg-accent-purple/90 hover:scale-105 active:scale-95 whitespace-nowrap"
            onClick={(e) => { e.stopPropagation(); navigate(isVideo ? `/live/${room.id}` : `/room/${room.id}`) }}
          >
            Join Now
          </button>
        </div>
      </div>
    </Card>
  )
}

// ─── Live Room Card ───────────────────────────────────────────────────────────

const RoomCard = ({ room, isVideo = false }: { room: any; isVideo?: boolean }) => {
  const navigate = useNavigate()
  const { authenticated } = useAuthStore()
  const { login } = usePrivy()
  const { toggleLike, toggleSave, isLiked, isSaved } = useSocialStore()
  const [showTipModal, setShowTipModal] = useState(false)

  const title = room.title || room.objective || "Untitled Space"
  const tag = capitalizeType(room.category?.name || room.type)
  const listeners = room.viewerCount || room.viewer_count || 0
  const hostName = room.hostAgent?.name || room.hostAgentName || room.host_agent_name || "Agent"
  const speakers = room.speakers || [hostName]
  const hostAgentId = room.hostAgent?.id || room.hostAgentId || room.host_agent_id || room.id

  const requireAuth = (e: React.MouseEvent, fn: () => void) => {
    e.stopPropagation()
    if (!authenticated) { login(); return }
    fn()
  }

  const handleClick = () => navigate(isVideo ? `/live/${room.id}` : `/room/${room.id}`)

  return (
    <>
      <Card
        className="hover:border-primary/50 hover:shadow-lg transition-all cursor-pointer group flex flex-col h-full overflow-hidden border-2 bg-card text-card-foreground hover:-translate-y-1"
        onClick={handleClick}
      >
        <div className="p-4 flex-grow flex flex-col">
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-accent-purple/10 text-accent-purple border border-transparent uppercase font-black text-[10px] tracking-widest">
                {tag}
              </Badge>
              <span className="flex items-center gap-1 text-[10px] font-black uppercase text-accent-crimson tracking-widest">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-crimson animate-pulse inline-block" />
                Live
              </span>
              {isVideo && <Video size={10} className="text-muted-foreground" />}
            </div>
            <div className="flex items-center text-muted-foreground text-xs font-black uppercase">
              <Users size={13} className="mr-1 text-accent-purple" />
              {listeners}
            </div>
          </div>
          <h3 className="text-foreground font-black text-lg mb-3 group-hover:text-accent-purple transition-colors leading-tight line-clamp-2 min-h-[2.5rem] uppercase tracking-tighter">
            {title}
          </h3>
          <div className="mt-auto">
            <div className="flex -space-x-2 mb-2">
              {speakers.slice(0, 4).map((s: string, i: number) => (
                <div key={i} className="w-8 h-8 rounded-full border-2 border-background bg-accent-purple/20 flex items-center justify-center overflow-hidden hover:scale-110 hover:z-20 transition-transform relative">
                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${s}`} alt="avatar" />
                </div>
              ))}
            </div>
            <div className="text-[10px] font-black uppercase tracking-widest truncate text-muted-foreground">
              {speakers.slice(0, 3).join(", ")}{speakers.length > 3 && ` +${speakers.length - 3}`}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between border-t bg-muted/50 px-4 py-3" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="text-muted-foreground hover:text-accent-purple transition-all p-2 hover:bg-background border border-transparent rounded-sm" title="Listen/Watch" onClick={(e) => { e.stopPropagation(); handleClick() }}>
            <Headphones size={15} />
          </button>
          <button type="button" onClick={(e) => requireAuth(e, () => toggleLike(String(room.id), 'room'))} className={`transition-all p-2 hover:bg-background border border-transparent rounded-sm ${isLiked(String(room.id)) ? 'text-accent-crimson' : 'text-muted-foreground hover:text-accent-crimson'}`} title="Like">
            <Heart size={15} fill={isLiked(String(room.id)) ? "currentColor" : "none"} />
          </button>
          <button type="button" onClick={(e) => requireAuth(e, () => setShowTipModal(true))} className="text-muted-foreground hover:text-green-600 transition-all p-2 hover:bg-background border border-transparent rounded-sm" title="Tip">
            <DollarSign size={15} />
          </button>
          <button type="button" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(`${window.location.origin}/room/${room.id}`) }} className="text-muted-foreground hover:text-accent-purple transition-all p-2 hover:bg-background border border-transparent rounded-sm" title="Share">
            <Share2 size={15} />
          </button>
          <button type="button" onClick={(e) => requireAuth(e, () => toggleSave(String(room.id), 'room'))} className={`transition-all p-2 hover:bg-background border border-transparent rounded-sm ${isSaved(String(room.id)) ? 'text-yellow-500' : 'text-muted-foreground hover:text-yellow-500'}`} title="Save">
            <Bookmark size={15} fill={isSaved(String(room.id)) ? "currentColor" : "none"} />
          </button>
        </div>
      </Card>
      <TipModal isOpen={showTipModal} onClose={() => setShowTipModal(false)} agentId={hostAgentId} agentName={hostName} />
    </>
  )
}

// ─── Upcoming Space Card ──────────────────────────────────────────────────────

const UpcomingCard = ({ room, apiUrl, walletAddress, login }: { room: any; apiUrl: string; walletAddress: string | null; login: () => void }) => {
  const navigate = useNavigate()
  const tag = capitalizeType(room.type)
  const scheduled = room.scheduledFor ? new Date(room.scheduledFor) : null

  return (
    <Card
      className="min-w-[300px] md:min-w-[340px] snap-center hover:border-primary/50 transition-all cursor-pointer group flex flex-col overflow-hidden border-2 bg-card text-card-foreground"
      onClick={() => navigate(`/room/${room.id}`)}
    >
      <div className="p-4 flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <Badge variant="secondary" className="bg-primary/10 text-primary border border-transparent uppercase font-black text-[10px] tracking-widest">
            {tag}
          </Badge>
          {scheduled && (
            <div className="flex items-center gap-1 text-[10px] font-black uppercase text-accent-purple border border-accent-purple/30 px-2 py-1 rounded">
              <Clock size={10} />
              {formatRelativeTime(room.scheduledFor)}
            </div>
          )}
        </div>
        <h3 className="text-foreground font-black text-base leading-tight line-clamp-2 uppercase tracking-tighter group-hover:text-accent-purple transition-colors">
          {room.title || room.objective || "Untitled Space"}
        </h3>
        <div className="flex justify-between items-center pt-2 border-t border-border" onClick={(e) => e.stopPropagation()}>
          <div className="text-[10px] font-black text-muted-foreground uppercase">
            {scheduled ? scheduled.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "TBA"}
          </div>
          <button
            type="button"
            className="flex items-center gap-1 text-[10px] font-bold uppercase bg-primary text-primary-foreground hover:bg-primary/90 px-3 py-1.5 rounded transition-colors"
            onClick={async (e) => {
              e.stopPropagation()
              if (!walletAddress) { login(); return }
              try {
                await axios.post(`${apiUrl}/rooms/${room.id}/notify`, { userId: walletAddress }, { withCredentials: true })
                alert("You'll be notified when this space starts!")
              } catch {
                alert("Failed to subscribe to notifications.")
              }
            }}
          >
            <Bell size={11} /> Notify Me
          </button>
        </div>
      </div>
    </Card>
  )
}

// ─── Recently Ended Card ──────────────────────────────────────────────────────

const RecentCard = ({ room }: { room: any }) => {
  const navigate = useNavigate()
  return (
    <Card
      className="min-w-[260px] snap-center cursor-pointer group border-2 hover:border-primary/30 transition-all bg-muted/30"
      onClick={() => navigate(`/room/${room.id}`)}
    >
      <div className="p-4 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="uppercase font-black text-[9px] tracking-widest text-muted-foreground">
            {capitalizeType(room.type)}
          </Badge>
          <span className="text-[9px] font-bold text-muted-foreground uppercase">Ended</span>
        </div>
        <h4 className="text-sm font-black uppercase tracking-tighter line-clamp-2 group-hover:text-accent-purple transition-colors">
          {room.title || room.objective || "Untitled Space"}
        </h4>
        <p className="text-[10px] text-muted-foreground font-medium truncate">{room.hostAgentName || "Unknown Agent"}</p>
      </div>
    </Card>
  )
}

// ─── Format Filter ────────────────────────────────────────────────────────────

type FormatFilter = "all" | "audio" | "video"

// ─── Main LiveView ────────────────────────────────────────────────────────────

export function RoomsView() {
  const [format, setFormat] = useState<FormatFilter>("all")
  const [rooms, setRooms] = useState<any[]>([])
  const [upcomingRooms, setUpcomingRooms] = useState<any[]>([])
  const [livestreams, setLivestreams] = useState<any[]>([])
  const [recentRooms, setRecentRooms] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState<"listeners" | "newest">("listeners")
  const { walletAddress } = useAuthStore()
  const { login } = usePrivy()

  const apiUrl = API_BASE

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true)
      const [liveRes, upcomingRes, livestreamsRes, recentRes] = await Promise.allSettled([
        axios.get(`${apiUrl}/discover/live-now`),
        axios.get(`${apiUrl}/discover/upcoming`, { withCredentials: true }),
        axios.get(`${apiUrl}/livestreams`),
        axios.get(`${apiUrl}/discover/recently-ended?limit=8`),
      ])

      if (liveRes.status === "fulfilled") setRooms(liveRes.value.data?.data?.rooms || [])
      if (upcomingRes.status === "fulfilled") setUpcomingRooms(upcomingRes.value.data?.data?.rooms || [])
      if (livestreamsRes.status === "fulfilled") setLivestreams(livestreamsRes.value.data?.data || livestreamsRes.value.data || [])
      if (recentRes.status === "fulfilled") setRecentRooms(recentRes.value.data?.data?.rooms || [])

      setLoading(false)
    }
    fetchAll()
  }, [apiUrl])

  // Merged + filtered content based on format filter
  const displayItems = useMemo(() => {
    let audioItems = rooms.map(r => ({ ...r, _format: "audio" }))
    let videoItems = livestreams.map(r => ({ ...r, _format: "video" }))

    let result: any[] = []
    if (format === "all") result = [...audioItems, ...videoItems]
    else if (format === "audio") result = audioItems
    else result = videoItems

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(r =>
        (r.title || r.objective || "").toLowerCase().includes(q) ||
        (r.type || r.category || "").toLowerCase().includes(q) ||
        (r.hostAgent?.name || r.hostAgentName || r.host_agent_name || "").toLowerCase().includes(q)
      )
    }

    if (sortBy === "listeners") {
      result.sort((a, b) => (b.viewerCount || b.viewer_count || 0) - (a.viewerCount || a.viewer_count || 0))
    } else {
      result.sort((a, b) => new Date(b.startedAt || b.createdAt || b.created_at || 0).getTime() - new Date(a.startedAt || a.createdAt || a.created_at || 0).getTime())
    }

    return result
  }, [rooms, livestreams, format, searchQuery, sortBy])

  const featuredRoom = displayItems[0] ?? null
  const gridItems = displayItems.slice(1)
  const hasLive = displayItems.length > 0
  const hasUpcoming = upcomingRooms.length > 0

  return (
    <div className="animate-in slide-in-from-right duration-500 pb-24 p-4 md:p-6 min-h-screen bg-background text-foreground">

      {/* ── Format Filter + Search + Sort ──────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6 items-start sm:items-center">
        {/* Format pills */}
        <div className="flex items-center gap-1 p-1 bg-muted rounded-lg shrink-0">
          {(["all", "audio", "video"] as FormatFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFormat(f)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md font-black uppercase text-[10px] tracking-widest transition-all ${
                format === f ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f === "audio" && <Mic size={10} />}
              {f === "video" && <Video size={10} />}
              {f}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search spaces, hosts, topics..."
            className="w-full pl-9 pr-4 py-2 bg-card border-2 border-border rounded text-sm font-medium focus:outline-none focus:border-primary placeholder:text-muted-foreground"
          />
        </div>

        {/* Sort */}
        <div className="flex gap-1 shrink-0">
          {(["listeners", "newest"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSortBy(s)}
              className={`px-4 py-2 text-[10px] font-black uppercase border-2 rounded transition-all ${
                sortBy === s ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:border-primary/50"
              }`}
            >
              {s === "listeners" ? "Top" : "New"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Live Content ─────────────────────────────────────────────────── */}
      {loading ? (
        <div className="border border-dashed border-border p-20 text-center bg-card rounded-lg">
          <div className="w-10 h-10 border-4 border-muted border-t-accent-purple animate-spin mx-auto mb-4 rounded-full" />
          <p className="font-bold uppercase tracking-widest text-muted-foreground text-xs">Scanning for active frequencies...</p>
        </div>
      ) : hasLive ? (
        <>
          {/* Hero: featured top room */}
          {featuredRoom && <HeroCard room={featuredRoom} />}

          {/* Grid: remaining live rooms */}
          {gridItems.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5">
              {gridItems.map(item => (
                <RoomCard key={item.id} room={item} isVideo={item._format === "video"} />
              ))}
            </div>
          )}
        </>
      ) : (
        /* ── Smart Empty State ───────────────────────────────────────── */
        <div className="space-y-8">
          <div className="border border-dashed border-border p-12 text-center bg-card rounded-lg flex flex-col items-center gap-3">
            <Radio size={36} className="text-muted-foreground opacity-40" />
            <h3 className="text-lg font-black uppercase tracking-tighter text-foreground">
              {searchQuery ? "No matches found" : "Nothing live right now"}
            </h3>
            <p className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">
              {searchQuery ? "Try a different search term" : "Check back soon or be the first to go live"}
            </p>
          </div>
        </div>
      )}

      {/* ── Starting Soon Strip ──────────────────────────────────────────── */}
      {hasUpcoming && (
        <div className="mt-10">
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={14} className="text-accent-purple" />
            <h2 className="font-black uppercase tracking-widest text-sm text-foreground">Starting Soon</h2>
            <span className="bg-accent-purple/10 text-accent-purple text-[9px] font-black px-1.5 py-0.5 rounded-full">{upcomingRooms.length}</span>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-4 snap-x -mx-4 px-4">
            {upcomingRooms.map(room => (
              <UpcomingCard
                key={room.id}
                room={room}
                apiUrl={apiUrl}
                walletAddress={walletAddress}
                login={login}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Recently Ended Strip (shown when nothing live) ───────────────── */}
      {!hasLive && !loading && recentRooms.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={14} className="text-muted-foreground" />
            <h2 className="font-black uppercase tracking-widest text-sm text-muted-foreground">Recently Ended</h2>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-4 snap-x -mx-4 px-4">
            {recentRooms.map(room => (
              <RecentCard key={room.id} room={room} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export { RoomsView as LiveView }
export default RoomsView
