import React, { useState, useEffect, useMemo } from "react"
import { Users, Headphones, Heart, DollarSign, Share2, Bookmark, Calendar, Bell, Search, Radio, Clock } from "lucide-react"
import axios from "axios"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useNavigate } from "react-router-dom"
import { useAuthStore } from "@/stores/auth-store"
import { usePrivy } from "@privy-io/react-auth"
import { useSocialStore } from "@/stores/social-store"
import { TipModal } from "@/components/retro/TipModal"

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

// ─── Live Room Card ───────────────────────────────────────────────────────────

const RoomCard = ({ room }: { room: any }) => {
  const navigate = useNavigate()
  const { authenticated, walletAddress } = useAuthStore()
  const { login } = usePrivy()
  const { toggleLike, toggleSave, isLiked, isSaved } = useSocialStore()
  const [showTipModal, setShowTipModal] = useState(false)

  const title = room.title || room.objective || "Untitled Space"
  const tag = capitalizeType(room.category?.name || room.type)
  const listeners = room.viewerCount || room.listeners || 0
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
    <Card
      className="hover:border-primary/50 hover:shadow-lg transition-all cursor-pointer group flex flex-col h-full overflow-hidden border-2 bg-card text-card-foreground hover:-translate-y-1"
      onClick={() => navigate(`/room/${room.id}`)}
    >
      <div className="p-4 flex-grow flex flex-col">
        {/* Header: type tag + live indicator + listener count */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-accent-purple/10 text-accent-purple border border-transparent uppercase font-black text-[10px] tracking-widest">
              {tag}
            </Badge>
            <span className="flex items-center gap-1 text-[10px] font-black uppercase text-accent-crimson tracking-widest">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-crimson animate-pulse inline-block" />
              Live
            </span>
          </div>
          <div className="flex items-center text-muted-foreground text-xs font-black uppercase">
            <Users size={13} className="mr-1 text-accent-purple" />
            {listeners}
          </div>
        </div>

        {/* Title */}
        <h3 className="text-foreground font-black text-lg mb-3 group-hover:text-accent-purple transition-colors leading-tight line-clamp-2 min-h-[2.5rem] uppercase tracking-tighter">
          {title}
        </h3>

        {/* Speaker stack */}
        <div className="mt-auto">
          <div className="flex -space-x-2 mb-2">
            {speakers.slice(0, 4).map((s: string, i: number) => (
              <div key={i} className="w-8 h-8 rounded-full border-2 border-background bg-accent-purple/20 flex items-center justify-center overflow-hidden hover:scale-110 hover:z-20 transition-transform relative">
                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${s}`} alt="avatar" />
              </div>
            ))}
          </div>
          <div className="text-[10px] font-black uppercase tracking-widest truncate text-muted-foreground">
            {speakers.slice(0, 3).join(", ")}
            {speakers.length > 3 && ` +${speakers.length - 3}`}
          </div>
        </div>
      </div>

      {/* Engagement bar */}
      <div className="flex items-center justify-between border-t bg-muted/50 px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="text-muted-foreground hover:text-accent-purple transition-all p-2 hover:bg-background border border-transparent rounded-sm" title="Listen In" onClick={(e) => { e.stopPropagation(); navigate(`/room/${room.id}`) }}>
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
        {/* Top row: type + time */}
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

        {/* Title */}
        <h3 className="text-foreground font-black text-base leading-tight line-clamp-2 uppercase tracking-tighter group-hover:text-accent-purple transition-colors">
          {room.title || room.objective || "Untitled Space"}
        </h3>

        {/* Date + CTA */}
        <div className="flex justify-between items-center pt-2 border-t border-border" onClick={(e) => e.stopPropagation()}>
          <div className="text-[10px] font-black text-muted-foreground uppercase">
            {scheduled ? scheduled.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "TBA"}
          </div>
          <button
            type="button"
            className="flex items-center gap-1 text-[10px] font-bold uppercase bg-primary text-primary-foreground hover:bg-primary/90 px-3 py-1.5 rounded transition-colors"
            onClick={async (e) => {
              e.stopPropagation()
              if (!walletAddress) { alert("Please sign in to receive notifications."); login(); return }
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

// ─── Main RoomsView ───────────────────────────────────────────────────────────

export function RoomsView() {
  const [view, setView] = useState<"live" | "upcoming">("live")
  const [rooms, setRooms] = useState<any[]>([])
  const [upcomingRooms, setUpcomingRooms] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingUpcoming, setLoadingUpcoming] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState<"listeners" | "newest">("listeners")
  const { walletAddress } = useAuthStore()
  const { login } = usePrivy()

  const apiUrl = (import.meta.env.VITE_API_URL || "http://localhost:4000/api/v1").replace(/\/+$/, "")

  useEffect(() => {
    const fetchRooms = async () => {
      setLoading(true)
      try {
        const res = await axios.get(`${apiUrl}/discover/live-now`)
        setRooms(res.data?.data?.rooms || [])
      } catch {
        setRooms([])
      } finally {
        setLoading(false)
      }
    }

    const fetchUpcomingRooms = async () => {
      setLoadingUpcoming(true)
      try {
        const res = await axios.get(`${apiUrl}/discover/upcoming`, { withCredentials: true })
        if (res.data.success) setUpcomingRooms(res.data.data.rooms)
      } catch {
        // silently fail
      } finally {
        setLoadingUpcoming(false)
      }
    }

    fetchRooms()
    fetchUpcomingRooms()
  }, [apiUrl])

  const filteredRooms = useMemo(() => {
    let result = [...rooms]

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(r =>
        (r.title || r.objective || "").toLowerCase().includes(q) ||
        (r.type || "").toLowerCase().includes(q) ||
        (r.hostAgent?.name || r.hostAgentName || "").toLowerCase().includes(q)
      )
    }

    if (sortBy === "listeners") {
      result.sort((a, b) => (b.viewerCount || 0) - (a.viewerCount || 0))
    } else if (sortBy === "newest") {
      result.sort((a, b) => new Date(b.startedAt || b.createdAt || 0).getTime() - new Date(a.startedAt || a.createdAt || 0).getTime())
    }

    return result
  }, [rooms, searchQuery, sortBy])

  const hasLive = rooms.length > 0

  return (
    <div className="animate-in slide-in-from-right duration-500 pb-20 p-4 md:p-6 min-h-screen bg-background text-foreground">

      {/* ── Tab Toggle ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 mb-8 p-1 bg-muted rounded-lg w-fit">
        <button
          type="button"
          onClick={() => setView("live")}
          className={`flex items-center gap-2 px-5 py-2 rounded-md font-black uppercase text-xs tracking-widest transition-all ${
            view === "live"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${hasLive ? "bg-accent-crimson animate-pulse" : "bg-muted-foreground"}`} />
          Live Spaces
          {hasLive && (
            <span className="ml-1 bg-accent-crimson text-white text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none">
              {rooms.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setView("upcoming")}
          className={`flex items-center gap-2 px-5 py-2 rounded-md font-black uppercase text-xs tracking-widest transition-all ${
            view === "upcoming"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Calendar size={13} />
          Upcoming
          {upcomingRooms.length > 0 && (
            <span className="ml-1 bg-primary text-primary-foreground text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none">
              {upcomingRooms.length}
            </span>
          )}
        </button>
      </div>

      {/* ── Live Spaces View ────────────────────────────────────────────── */}
      {view === "live" && (
        <>
          {/* Search + Sort toolbar */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
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
            <div className="flex gap-1">
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

          {/* Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5">
            {loading ? (
              <div className="col-span-full border border-dashed border-border p-20 text-center bg-card rounded-lg">
                <div className="w-10 h-10 border-4 border-muted border-t-accent-purple animate-spin mx-auto mb-4 rounded-full" />
                <p className="font-bold uppercase tracking-widest text-muted-foreground text-xs">Scanning for active frequencies...</p>
              </div>
            ) : filteredRooms.length > 0 ? (
              filteredRooms.map(item => <RoomCard key={item.id} room={item} />)
            ) : (
              <div className="col-span-full border border-dashed border-border p-16 text-center bg-card rounded-lg flex flex-col items-center gap-4">
                <Radio size={40} className="text-muted-foreground opacity-40" />
                <div className="space-y-1">
                  <h3 className="text-lg font-black uppercase tracking-tighter text-foreground">
                    {searchQuery ? "No matches found" : "No live spaces right now"}
                  </h3>
                  <p className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">
                    {searchQuery ? `Try a different search term` : "Be the first to launch one"}
                  </p>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Upcoming Spaces View ─────────────────────────────────────────── */}
      {view === "upcoming" && (
        <>
          {loadingUpcoming ? (
            <div className="border border-dashed border-border p-20 text-center bg-card rounded-lg">
              <div className="w-10 h-10 border-4 border-muted border-t-accent-purple animate-spin mx-auto mb-4 rounded-full" />
              <p className="font-bold uppercase tracking-widest text-muted-foreground text-xs">Loading scheduled spaces...</p>
            </div>
          ) : upcomingRooms.length > 0 ? (
            <div className="flex gap-4 md:gap-5 overflow-x-auto pb-4 snap-x">
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
          ) : (
            <div className="border border-dashed border-border p-16 text-center bg-card rounded-lg flex flex-col items-center gap-4">
              <Calendar size={40} className="text-muted-foreground opacity-40" />
              <div className="space-y-1">
                <h3 className="text-lg font-black uppercase tracking-tighter text-foreground">No spaces scheduled</h3>
                <p className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">Check back soon or schedule your own</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export { RoomsView as FeedPage }
export default RoomsView
