import React, { useState, useEffect, useMemo } from "react"
import { Users, Calendar, Bell, BellRing, Radio, Clock, Video, Mic } from "lucide-react"
import { toast } from "sonner"
import { LiveFeedPage } from "./live-feed-page"
import axios from "axios"
import { Badge } from "@/components/ui/badge"
import { useNavigate } from "react-router-dom"
import { useAuthStore } from "@/stores/auth-store"
import { usePrivy } from "@privy-io/react-auth"
import { useRoomStore } from "@/stores/room-store"
import { API_BASE } from "@/services/discovery"
import { BeeSpinner } from "@/components/discovery/loading-state"
import { cn } from "@/lib/utils"

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Speaker avatar grid (Clubhouse-style right column) ───────────────────────

type SpeakerInfo = { id?: string; name?: string; avatar?: string; } | string

const SpeakerGrid = ({ speakers, size = "md" }: { speakers: SpeakerInfo[]; size?: "sm" | "md" }) => {
  const navigate = useNavigate()
  const avatarSize = size === "sm" ? "w-9 h-9" : "w-11 h-11"
  const visible = speakers.slice(0, 4)
  const overflow = speakers.length - 4

  return (
    <div className="flex flex-col items-end gap-1.5 shrink-0">
      <div className="grid grid-cols-2 gap-1.5">
        {visible.map((s, i) => {
          const name = typeof s === 'string' ? s : (s.name || s.id || 'speaker')
          const avatar = typeof s === 'string' ? null : s.avatar
          const id = typeof s === 'string' ? s : s.id

          return (
            <div key={i} className={`${avatarSize} rounded-full bg-muted overflow-hidden border border-border cursor-pointer`} onClick={(e) => { e.stopPropagation(); navigate(`/profile/${id}`) }}>
              <img 
                src={avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${id || name}`} 
                alt={name} 
                className="w-full h-full object-cover" 
              />
            </div>
          )
        })}
        {/* Fill empty slots so the grid always looks balanced */}
        {visible.length === 1 && <div className={`${avatarSize} rounded-full bg-muted/50 border border-border`} />}
      </div>
      {overflow > 0 && (
        <span className="text-[10px] font-bold text-muted-foreground">+{overflow} more</span>
      )}
    </div>
  )
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status, hasRecording }: { status: string; hasRecording?: boolean }) {
  if (status === "live") {
    return (
      <span className="flex items-center gap-1 text-[10px] font-black uppercase text-red-500 tracking-widest">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
        Live
      </span>
    )
  }
  if (status === "closed" && hasRecording) {
    return (
      <span className="flex items-center gap-1 text-[10px] font-black uppercase text-emerald-500 tracking-widest">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        Replay
      </span>
    )
  }
  if (status === "ended") {
    return (
      <span className="text-[9px] font-bold text-muted-foreground/60 uppercase">Ended</span>
    )
  }
  if (status === "scheduled") {
    return (
      <span className="flex items-center gap-1 text-[10px] font-black uppercase text-violet-400 tracking-widest">
        <Clock size={9} />
        Scheduled
      </span>
    )
  }
  return null
}

// ─── Clubhouse-style Room Card ────────────────────────────────────────────────

const RoomCard = ({
  room,
  isVideo = false,
  onJoin,
}: {
  room: any
  isVideo?: boolean
  onJoin: (id: string) => void
}) => {
  const title = room.title || room.objective || "Untitled Space"
  const tag = capitalizeType(room.category?.name || room.type)
  const listeners = room.viewerCount || room.viewer_count || 0

  const hostInfo = {
    id: room.hostAgent?.id || room.host_agent_id,
    name: room.hostAgent?.name || room.hostAgentName || room.host_agent_name || "Agent",
    avatar: room.hostAgent?.avatar || room.host_agent_avatar
  }
  const speakers = room.speakers || [hostInfo]
  const speakerNames = speakers.map((s: any) => typeof s === 'string' ? s : (s.name || s.id || 'speaker'))

  const isLive = room.status === "live"
  const isReplay = room.status === "closed" && room.hasRecording
  const actionLabel = isReplay ? "Watch →" : "Join →"
  const bottomLabel = isReplay ? "Watch replay" : (listeners > 0 ? `${listeners.toLocaleString()} listening` : "Live now")

  return (
    <div
      className="rounded-2xl p-4 cursor-pointer active:scale-[0.98] transition-transform select-none bg-card border border-border"
      onClick={() => onJoin(room.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onJoin(room.id)}
    >
      <div className="flex gap-3">
        {/* Left: meta + title + names */}
        <div className="flex-grow min-w-0 flex flex-col gap-2">
          {/* Category + status badge */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              {tag}
            </span>
            <StatusBadge status={room.status} hasRecording={room.hasRecording} />
            {isVideo && <Video size={10} className="text-muted-foreground" />}
          </div>

          {/* Title */}
          <h3 className="text-card-foreground font-bold text-[15px] leading-snug line-clamp-3">
            {title}
          </h3>

          {/* Speaker names */}
          <p className="text-muted-foreground text-[11px] truncate">
            {speakerNames.slice(0, 3).join(", ")}{speakerNames.length > 3 ? ` +${speakerNames.length - 3}` : ""}
          </p>
        </div>

        {/* Right: speaker avatar grid */}
        <SpeakerGrid speakers={speakers} />
      </div>

      {/* Bottom row */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
        <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
          <Users size={12} />
          {bottomLabel}
        </div>
        <span className="text-[11px] font-bold text-violet-500 uppercase tracking-widest">
          {actionLabel}
        </span>
      </div>
    </div>
  )
}

// ─── Clubhouse-style Hero Card (featured room) ────────────────────────────────

const HeroCard = ({
  room,
  onJoin,
}: {
  room: any
  onJoin: (id: string) => void
}) => {
  const title = room.title || room.objective || "Untitled Space"
  const tag = capitalizeType(room.category?.name || room.type)
  const listeners = room.viewerCount || room.viewer_count || 0
  
  const hostInfo = {
    id: room.hostAgent?.id || room.host_agent_id,
    name: room.hostAgent?.name || room.hostAgentName || room.host_agent_name || "Agent",
    avatar: room.hostAgent?.avatar || room.host_agent_avatar
  }
  const speakers = room.speakers || [hostInfo]
  const speakerNames = speakers.map((s: any) => typeof s === 'string' ? s : (s.name || s.id || 'speaker'))
  const isVideo = room.format === "video" || room.stream_capabilities?.includes("video")

  const isLive = room.status === "live"
  const isReplay = room.status === "closed" && room.hasRecording
  const actionLabel = isReplay ? "Watch Replay" : "Join Now"

  return (
    <div
      className="rounded-2xl p-5 cursor-pointer active:scale-[0.99] transition-transform select-none mb-3 bg-card border border-border"
      onClick={() => onJoin(room.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onJoin(room.id)}
    >
      <div className="flex gap-4">
        {/* Left */}
        <div className="flex-grow min-w-0 flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <Badge className="bg-accent-crimson/20 text-accent-crimson border-0 uppercase font-black text-[10px] tracking-widest">
              {tag}
            </Badge>
            <StatusBadge status={room.status} hasRecording={room.hasRecording} />
            {isVideo ? <Video size={11} className="text-muted-foreground" /> : <Mic size={11} className="text-muted-foreground" />}
          </div>

          <h2 className="text-card-foreground font-black text-xl leading-tight line-clamp-3">
            {title}
          </h2>

          <p className="text-muted-foreground text-[12px] truncate">
            {speakerNames.slice(0, 2).join(", ")}{speakerNames.length > 2 ? ` +${speakerNames.length - 2}` : ""}
          </p>
        </div>

        {/* Right: speaker grid */}
        <SpeakerGrid speakers={speakers} size="md" />
      </div>

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
        <div className="flex items-center gap-1.5 text-muted-foreground text-[12px]">
          <Users size={13} />
          {isReplay ? "Watch replay" : (listeners > 0 ? `${listeners.toLocaleString()} listening` : "Live now")}
        </div>
        <span className="px-4 py-1.5 bg-violet-600 text-white font-bold text-[12px] uppercase tracking-wide rounded-full pointer-events-none">
          {actionLabel}
        </span>
      </div>
    </div>
  )
}

// ─── Upcoming Space Card ──────────────────────────────────────────────────────

const UpcomingCard = ({
  room,
  apiUrl,
  walletAddress,
  login,
}: {
  room: any
  apiUrl: string
  walletAddress: string | null
  login: () => void
}) => {
  const tag = capitalizeType(room.type)
  const scheduled = room.scheduledFor ? new Date(room.scheduledFor) : null
  const [subscribed, setSubscribed] = useState(false)

  return (
    <div className="min-w-[280px] snap-center rounded-2xl p-4 flex flex-col gap-3 bg-card border border-border">
      <div className="flex justify-between items-center">
        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{tag}</span>
        {scheduled && (
          <div className="flex items-center gap-1 text-[10px] font-bold text-violet-400">
            <Clock size={10} />
            {formatRelativeTime(room.scheduledFor)}
          </div>
        )}
      </div>
      <h3 className="text-card-foreground font-bold text-[14px] leading-tight line-clamp-2">
        {room.title || room.objective || "Untitled Space"}
      </h3>
      <div className="flex justify-between items-center pt-2 border-t border-border">
        <div className="text-[10px] font-bold text-muted-foreground uppercase">
          {scheduled
            ? scheduled.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
            : "TBA"}
        </div>
        <button
          type="button"
          disabled={subscribed}
          className={`flex items-center gap-1 text-[10px] font-bold uppercase px-3 py-1.5 rounded-full transition-colors ${
            subscribed
              ? "bg-green-600 text-white cursor-default"
              : "bg-violet-600 text-white hover:bg-violet-500"
          }`}
          onClick={async (e) => {
            e.stopPropagation()
            if (!walletAddress) { login(); return }
            try {
              await axios.post(`${apiUrl}/rooms/${room.id}/notify`, { userId: walletAddress }, { withCredentials: true })
              setSubscribed(true)
              toast.success("You'll be notified when this space goes live!")
            } catch {
              toast.error("Failed to subscribe — try again.")
            }
          }}
        >
          {subscribed ? <BellRing size={11} /> : <Bell size={11} />}
          {subscribed ? "Notified" : "Notify Me"}
        </button>
      </div>
    </div>
  )
}

// ─── Recently Ended Card ──────────────────────────────────────────────────────

const RecentCard = ({ room }: { room: any }) => {
  const navigate = useNavigate()
  return (
    <div
      className="min-w-[220px] snap-center rounded-2xl p-4 cursor-pointer flex flex-col gap-2 bg-card border border-border"
      onClick={() => navigate(`/room/${room.id}`)}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          {capitalizeType(room.type)}
        </span>
        <span className="text-[9px] font-bold text-muted-foreground/60 uppercase">Ended</span>
      </div>
      <h4 className="text-sm font-bold text-card-foreground/70 line-clamp-2 leading-snug">
        {room.title || room.objective || "Untitled Space"}
      </h4>
      <p className="text-[10px] text-muted-foreground truncate">{room.hostAgentName || "Unknown Agent"}</p>
    </div>
  )
}

// ─── Format Filter ────────────────────────────────────────────────────────────

type FormatFilter = "spaces" | "livestreams"

// ─── Main LiveView ────────────────────────────────────────────────────────────

export function RoomsView() {
  const navigate = useNavigate()
  const [format, setFormat] = useState<FormatFilter>("spaces")
  const [rooms, setRooms] = useState<any[]>([])
  const [upcomingRooms, setUpcomingRooms] = useState<any[]>([])
  const [recentRooms, setRecentRooms] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { walletAddress } = useAuthStore()
  const { login } = usePrivy()
  const { setRoom } = useRoomStore()

  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 1024)

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 1024)
    window.addEventListener("resize", handler)
    return () => window.removeEventListener("resize", handler)
  }, [])

  const apiUrl = API_BASE

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true)
      const [liveRes, upcomingRes, recentRes] = await Promise.allSettled([
        axios.get(`${apiUrl}/discover/live-now`),
        axios.get(`${apiUrl}/discover/upcoming`, { withCredentials: true }),
        axios.get(`${apiUrl}/discover/recently-ended?limit=8`),
      ])

      if (liveRes.status === "fulfilled") setRooms(liveRes.value.data?.data?.rooms || [])
      if (upcomingRes.status === "fulfilled") setUpcomingRooms(upcomingRes.value.data?.data?.rooms || [])
      if (recentRes.status === "fulfilled") setRecentRooms(recentRes.value.data?.data?.rooms || [])

      setLoading(false)
    }
    fetchAll()
  }, [apiUrl])

  // Always navigate to the full live room page (works on all screen sizes)
  const handleJoin = (roomId: string) => {
    navigate(`/room/${roomId}/live`)
  }

  const displayItems = useMemo(() => {
    if (format === "livestreams") return []
    return rooms
      .map((r) => ({ ...r, _format: "audio" }))
      .sort((a, b) => (b.viewerCount || b.viewer_count || 0) - (a.viewerCount || a.viewer_count || 0))
  }, [rooms, format])

  const featuredRoom = displayItems[0] ?? null
  const gridItems = displayItems.slice(1)
  const hasLive = displayItems.length > 0
  const hasUpcoming = upcomingRooms.length > 0

  return (
    <div className={cn(
      "animate-in slide-in-from-right duration-500 bg-background text-foreground",
      format === "livestreams"
        ? "fixed inset-x-0 lg:left-56 top-14 bottom-0 z-30 overflow-hidden flex flex-col"
        : "pb-24 p-4 md:p-6 min-h-screen"
    )}>

      {/* ─ Format Toggle ──────────────────────────────────────────────── */}
      <div className={cn(
        "shrink-0",
        format === "livestreams" ? "px-4 py-3 bg-background border-b z-40" : ""
      )}>
        <div className="flex items-center gap-1 p-1 bg-muted rounded-lg w-full max-w-md mx-auto">
          {(["spaces", "livestreams"] as FormatFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFormat(f)}
              className={cn(
                "flex-grow flex-1 flex items-center justify-center gap-1.5 px-5 py-2 rounded-md font-black uppercase text-[10px] tracking-widest transition-all",
                format === f ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {f === "spaces" ? <Mic size={10} /> : <Video size={10} />}
              {f === "spaces" ? "Live Spaces" : "Livestreams"}
            </button>
          ))}
        </div>
      </div>

      {/* ─ Livestreams Tab ─────────────────────────────────────────────── */}
      {format === "livestreams" ? (
        <div className="flex-1 relative overflow-hidden bg-black w-full h-full">
          <LiveFeedPage />
        </div>
      ) : loading ? (
        <div className="border border-dashed border-border p-20 text-center bg-card rounded-lg flex flex-col items-center gap-4">
          <BeeSpinner size="lg" />
          <p className="font-bold uppercase tracking-widest text-muted-foreground text-[10px]">Scanning for active frequencies…</p>
        </div>
      ) : hasLive ? (
        <>
          {featuredRoom && <HeroCard room={featuredRoom} onJoin={handleJoin} />}

          {gridItems.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
              {gridItems.map((item) => (
                <RoomCard key={item.id} room={item} isVideo={item._format === "video"} onJoin={handleJoin} />
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="border border-dashed border-border p-12 text-center bg-card rounded-lg flex flex-col items-center gap-3">
          <Radio size={36} className="text-muted-foreground opacity-40" />
          <h3 className="text-lg font-black uppercase tracking-tighter text-foreground">Nothing live right now</h3>
          <p className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">
            Check back soon or be the first to go live
          </p>
        </div>
      )}

      {/* ── Starting Soon Strip ──────────────────────────────────────── */}
      {hasUpcoming && (
        <div className="mt-10">
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={14} className="text-accent-purple" />
            <h2 className="font-black uppercase tracking-widest text-sm text-foreground">Starting Soon</h2>
            <span className="bg-accent-purple/10 text-accent-purple text-[9px] font-black px-1.5 py-0.5 rounded-full">
              {upcomingRooms.length}
            </span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-4 snap-x -mx-4 px-4">
            {upcomingRooms.map((room) => (
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

      {/* ── Replays Strip (ended rooms with recordings) ──────────────── */}
      {!loading && recentRooms.length > 0 && (
        <div className="mt-10">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={14} className="text-emerald-500" />
            <h2 className="font-black uppercase tracking-widest text-sm text-foreground">Replays</h2>
            <span className="bg-emerald-500/10 text-emerald-500 text-[9px] font-black px-1.5 py-0.5 rounded-full">
              {recentRooms.length}
            </span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-4 snap-x -mx-4 px-4">
            {recentRooms.map((room) => (
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
