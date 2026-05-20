import React, { useState, useEffect, useRef, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import {
  Heart, MessageSquare, Users, Share2, DollarSign, Bookmark,
  Copy, Plus, X, ChevronDown, Check, Volume2, Tv,
} from "lucide-react"
import axios from "axios"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useAuthStore } from "@/stores/auth-store"
import { useSocialStore } from "@/stores/social-store"
import { usePrivy } from "@privy-io/react-auth"
import { TipModal } from "@/components/retro/TipModal"
import { cn } from "@/lib/utils"
import { BeeSpinner } from "@/components/discovery/loading-state"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import HlsPlayer from "@/components/livestream/HlsPlayer"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  if (hrs > 0) return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
  return `${mins}:${String(secs).padStart(2, "0")}`
}

interface Stream {
  id: string
  title: string
  description: string
  category: string
  hostAgentName: string
  hostAgentId: string
  hostAgentAvatar?: string
  viewerCount: number
  likeCount?: number
  status: string
  hlsUrl?: string
  streamKey?: string
  durationSeconds?: number
  recordingAvailable?: boolean
  recordingUrl?: string
}

interface ChatMessage {
  user: string
  msg: string
  isAgent: boolean
  isPriority: boolean
}

// ─── Per-stream chat state ───────────────────────────────────────────────────

interface StreamChatState {
  messages: ChatMessage[]
  input: string
}

// ─── Action Button (right-side stack) ───────────────────────────────────────

interface ActionButtonProps {
  icon: React.ReactNode
  label?: string | number
  onClick: () => void
  active?: boolean
  activeColor?: string
}

const ActionButton: React.FC<ActionButtonProps> = ({ icon, label, onClick, active, activeColor = "text-primary" }) => (
  <button
    onClick={onClick}
    className="flex flex-col items-center gap-1 group"
    type="button"
  >
    <div className={cn(
      "w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200",
      "bg-black/40 backdrop-blur-sm border border-white/10",
      "group-hover:bg-black/60 group-hover:scale-110",
      active && activeColor,
    )}>
      <div className={cn("transition-colors", active ? activeColor : "text-white")}>
        {icon}
      </div>
    </div>
    {label !== undefined && (
      <span className="text-white text-xs font-semibold drop-shadow-md">{label}</span>
    )}
  </button>
)

// ─── Skeleton card shown while loading ──────────────────────────────────────

const SkeletonCard: React.FC = () => (
  <div className="snap-start h-full w-full relative bg-black flex items-center justify-center">
    <div className="flex flex-col items-center gap-4">
      <BeeSpinner size="lg" variant="primary" />
      <span className="text-white/40 font-bold uppercase text-[10px] tracking-widest animate-pulse">
        Tuning into broadcast...
      </span>
    </div>
  </div>
)

// ─── Individual feed card ────────────────────────────────────────────────────

interface LiveFeedCardProps {
  stream: Stream
  viewerCount: number
  navigate: ReturnType<typeof useNavigate>
  onOpenChat: () => void
  onOpenTip: () => void
  onOpenShare: () => void
}

const LiveFeedCard: React.FC<LiveFeedCardProps> = ({
  stream, viewerCount, navigate, onOpenChat, onOpenTip, onOpenShare,
}) => {
  const { authenticated } = useAuthStore()
  const { login } = usePrivy()
  const { toggleLike, toggleSave, toggleFollow, isLiked, isSaved, isFollowing } = useSocialStore()

  const requireAuth = (fn: () => void) => {
    if (!authenticated) { login(); return }
    fn()
  }

  const viewerDisplay = viewerCount >= 1000
    ? `${(viewerCount / 1000).toFixed(1)}K`
    : String(viewerCount)

  const isLive = stream.status === "live"
  const durationDisplay = stream.durationSeconds
    ? formatDuration(stream.durationSeconds)
    : null

  return (
    <div className="snap-start h-full w-full relative bg-black flex-shrink-0 overflow-hidden">
      {/* Video player */}
      {stream.hlsUrl ? (
        <HlsPlayer
          src={stream.hlsUrl}
          className="absolute inset-0 w-full h-full object-cover"
          autoPlay
          muted={!isLive}
        />
      ) : (
        <>
          {/* Fallback gradient & icon when no video available */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-black/60 to-black/90" />
          <div className="absolute inset-0 opacity-30">
            <div
              className="w-full h-full animate-pulse"
              style={{
                background: `radial-gradient(ellipse at 30% 40%, hsl(262 83% 58% / 0.4) 0%, transparent 60%),
                             radial-gradient(ellipse at 70% 60%, hsl(262 83% 40% / 0.3) 0%, transparent 50%)`,
              }}
            />
          </div>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="flex flex-col items-center gap-3 opacity-20">
              <Tv size={72} className="text-white" />
            </div>
          </div>
        </>
      )}

      {/* ── Top-left: Status badge + category ── */}
      <div className="absolute top-4 left-4 flex items-center gap-2 z-10">
        {isLive ? (
          <Badge variant="destructive" className="animate-pulse text-xs px-2 py-0.5 font-bold">
            LIVE
          </Badge>
        ) : (
          <Badge variant="secondary" className="bg-black/60 text-white/80 border-none backdrop-blur-md text-xs font-bold">
            ENDED
          </Badge>
        )}
        {durationDisplay && !isLive && (
          <Badge variant="secondary" className="bg-black/50 text-white/70 hover:bg-black/50 border-none backdrop-blur-md text-xs">
            {durationDisplay}
          </Badge>
        )}
        {stream.category && (
          <Badge
            variant="secondary"
            className="bg-black/50 text-white hover:bg-black/50 border-none backdrop-blur-md capitalize text-xs"
          >
            {stream.category}
          </Badge>
        )}
      </div>

      {/* ── Top-right: viewer count ── */}
      <div className="absolute top-4 right-4 z-10">
        <Badge
          variant="secondary"
          className="bg-black/50 text-white hover:bg-black/50 border-none backdrop-blur-md flex items-center gap-1.5"
        >
          <Users size={11} /> {viewerDisplay}
        </Badge>
      </div>

      {/* ── Right-side vertical action stack (TikTok-style) ── */}
      <div className="absolute right-4 bottom-28 z-10 flex flex-col items-center gap-4">
        {/* Like */}
        <ActionButton
          icon={<Heart size={22} fill={isLiked(stream.id) ? "currentColor" : "none"} />}
          label={stream.likeCount ?? ""}
          onClick={() => requireAuth(() => toggleLike(stream.id, "livestream"))}
          active={isLiked(stream.id)}
          activeColor="text-red-500"
        />

        {/* Follow */}
        <ActionButton
          icon={isFollowing(stream.hostAgentId)
            ? <Check size={22} />
            : <Plus size={22} />
          }
          onClick={() => requireAuth(() => toggleFollow(stream.hostAgentId))}
          active={isFollowing(stream.hostAgentId)}
          activeColor="text-primary"
        />

        {/* Tip */}
        <ActionButton
          icon={<DollarSign size={22} />}
          onClick={() => requireAuth(onOpenTip)}
          activeColor="text-green-400"
        />

        {/* Chat */}
        <ActionButton
          icon={<MessageSquare size={22} />}
          onClick={onOpenChat}
          activeColor="text-blue-400"
        />

        {/* Save */}
        <ActionButton
          icon={<Bookmark size={22} fill={isSaved(stream.id) ? "currentColor" : "none"} />}
          onClick={() => requireAuth(() => toggleSave(stream.id, "livestream"))}
          active={isSaved(stream.id)}
          activeColor="text-yellow-400"
        />

        {/* Share */}
        <ActionButton
          icon={<Share2 size={22} />}
          onClick={onOpenShare}
          activeColor="text-sky-400"
        />
      </div>

      {/* ── Bottom overlay: host info ── */}
      <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-16 pb-5 px-4">
        <div className="flex items-end gap-3 pr-16">
          <div className="shrink-0">
            <img
              src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${stream.hostAgentId}`}
              alt={stream.hostAgentName}
              className="w-11 h-11 rounded-full border-2 border-primary/60 bg-muted cursor-pointer"
              onClick={() => navigate(`/profile/${stream.hostAgentId}`)}
            />
          </div>
          <div className="min-w-0">
            <p className="text-white font-bold text-sm drop-shadow-md truncate">
              {stream.hostAgentName}
            </p>
            <p className="text-white/75 text-xs drop-shadow-md line-clamp-2 leading-snug mt-0.5">
              {stream.title}
            </p>
            {stream.description && (
              <p className="text-white/50 text-xs mt-1 line-clamp-1">
                {stream.description}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Chat bottom sheet ───────────────────────────────────────────────────────

interface ChatSheetProps {
  onClose: () => void
  chat: ChatMessage[]
  input: string
  onInputChange: (v: string) => void
  onSend: (e: React.FormEvent) => void
  authenticated: boolean
}

const ChatSheet: React.FC<ChatSheetProps> = ({ onClose, chat, input, onInputChange, onSend, authenticated }) => (
  <>
    <div
      className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
      onClick={onClose}
      aria-hidden="true"
    />
    <div
      className="fixed inset-x-0 bottom-0 z-50 flex flex-col h-[65vh] animate-in slide-in-from-bottom duration-300 rounded-t-2xl overflow-hidden border-t bg-background/98 backdrop-blur-sm shadow-2xl"
      role="dialog"
      aria-label="Live Chat"
    >
      {/* drag handle */}
      <div className="flex justify-center pt-3 pb-1 bg-muted shrink-0">
        <div className="w-10 h-1.5 rounded-full bg-border" />
      </div>

      {/* header */}
      <div className="px-4 py-3 border-b bg-muted/30 shrink-0 flex items-center justify-between">
        <span className="font-semibold tracking-tight text-sm flex items-center gap-2 text-foreground">
          <MessageSquare size={16} className="text-muted-foreground" />
          Live Chat
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:bg-muted"
          onClick={onClose}
          aria-label="Close chat"
        >
          <ChevronDown size={18} />
        </Button>
      </div>

      {/* messages */}
      <div className="flex-grow p-4 overflow-y-auto space-y-3 text-sm font-medium">
        {chat.length === 0 ? (
          <p className="text-center text-muted-foreground font-medium pt-8">
            Be the first to say something!
          </p>
        ) : chat.map((c, i) => (
          <div
            key={i}
            className={cn(
              "animate-in slide-in-from-bottom-2 duration-300 p-2.5 rounded-lg",
              c.isPriority
                ? "bg-primary/10 border-l-4 border-primary"
                : "hover:bg-muted/50 transition-colors",
            )}
          >
            <span className={cn("font-semibold mr-2", c.user === "You" ? "text-primary" : "text-foreground")}>
              {c.user}:
            </span>
            <span className="text-muted-foreground leading-snug">{c.msg}</span>
          </div>
        ))}
      </div>

      {/* input */}
      <div className="p-3 border-t bg-background shrink-0">
        <form onSubmit={onSend} className="flex gap-2">
          <Input
            type="text"
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder={authenticated ? "Say something..." : "Login to chat..."}
            className="flex-grow"
            autoFocus
          />
          <Button type="submit" size="icon" className="shrink-0">
            <MessageSquare size={16} />
          </Button>
        </form>
      </div>
    </div>
  </>
)

// ─── Main page ───────────────────────────────────────────────────────────────

export function LiveFeedPage() {
  const { id: targetId } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:4000/api/v1"

  const { authenticated } = useAuthStore()
  const { login } = usePrivy()

  const [streams, setStreams] = useState<Stream[]>([])
  const [viewerCounts, setViewerCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [currentIndex, setCurrentIndex] = useState(0)

  // Per-stream chat keyed by stream id
  const [chatMap, setChatMap] = useState<Record<string, StreamChatState>>({})
  const [activeChatId, setActiveChatId] = useState<string | null>(null)

  // Tip
  const [tipTarget, setTipTarget] = useState<{ id: string; name: string } | null>(null)

  // Share
  const [shareStreamId, setShareStreamId] = useState<string | null>(null)

  // Refs for scroll-snap slides
  const slideRefs = useRef<(HTMLDivElement | null)[]>([])
  const containerRef = useRef<HTMLDivElement>(null)

  // ── Fetch streams ────────────────────────────────────────────────────────
  useEffect(() => {
    axios
      .get(`${apiUrl}/livestreams?include_ended=true`)
      .then((res) => {
        const data: Stream[] = res.data?.data?.streams || res.data?.data || []
        setStreams(data)
        const counts: Record<string, number> = {}
        data.forEach((s) => { counts[s.id] = s.viewerCount ?? 0 })
        setViewerCounts(counts)
      })
      .catch(() => setStreams([]))
      .finally(() => setLoading(false))
  }, [apiUrl])

  // ── Poll viewer counts every 30s ─────────────────────────────────────────
  useEffect(() => {
    if (streams.length === 0) return
    const timer = setInterval(() => {
      axios.get(`${apiUrl}/livestreams?include_ended=true`).then((res) => {
        const data: Stream[] = res.data?.data?.streams || res.data?.data || []
        const counts: Record<string, number> = {}
        data.forEach((s) => { counts[s.id] = s.viewerCount ?? 0 })
        setViewerCounts(counts)
      }).catch(() => {})
    }, 30000)
    return () => clearInterval(timer)
  }, [apiUrl, streams.length])

  // ── Scroll to target id once streams load ────────────────────────────────
  useEffect(() => {
    if (!targetId || streams.length === 0) return
    const idx = streams.findIndex((s) => s.id === targetId)
    if (idx !== -1 && slideRefs.current[idx]) {
      slideRefs.current[idx]!.scrollIntoView({ behavior: "instant" })
      setCurrentIndex(idx)
    }
  }, [targetId, streams])

  // ── IntersectionObserver: track current slide + register view ───────────
  useEffect(() => {
    if (streams.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = slideRefs.current.findIndex((ref) => ref === entry.target)
            if (idx !== -1) {
              setCurrentIndex(idx)
              const stream = streams[idx]
              // Register view (fire and forget)
              axios
                .post(`${apiUrl}/livestreams/${stream.id}/view`)
                .then((r) => {
                  if (r.data?.data?.viewerCount !== undefined) {
                    setViewerCounts((prev) => ({ ...prev, [stream.id]: r.data.data.viewerCount }))
                  }
                })
                .catch(() => {})
            }
          }
        })
      },
      { threshold: 0.6 },
    )

    slideRefs.current.forEach((ref) => { if (ref) observer.observe(ref) })
    return () => observer.disconnect()
  }, [streams, apiUrl])

  // ── Chat helpers ─────────────────────────────────────────────────────────
  const getChatState = (id: string): StreamChatState =>
    chatMap[id] ?? { messages: [], input: "" }

  const updateChat = (id: string, patch: Partial<StreamChatState>) => {
    setChatMap((prev) => ({
      ...prev,
      [id]: { ...getChatState(id), ...patch },
    }))
  }

  const handleSendMsg = useCallback(
    (streamId: string, e: React.FormEvent) => {
      e.preventDefault()
      const state = getChatState(streamId)
      if (!state.input.trim()) return
      if (!authenticated) { login(); return }
      updateChat(streamId, {
        messages: [...state.messages, { user: "You", msg: state.input.trim(), isAgent: false, isPriority: false }],
        input: "",
      })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [authenticated, chatMap, login],
  )

  // ── Tip helpers ──────────────────────────────────────────────────────────
  const openTip = (stream: Stream) => setTipTarget({ id: stream.hostAgentId, name: stream.hostAgentName })

  // ── Render ───────────────────────────────────────────────────────────────

  const activeChat = activeChatId ? getChatState(activeChatId) : null
  const activeStream = activeChatId ? streams.find((s) => s.id === activeChatId) : null

  return (
    <div className="relative h-full w-full animate-in fade-in duration-500 flex flex-col">
      {/* ─ Scroll-snap feed ── */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
        style={{ scrollBehavior: "smooth" }}
      >
        {/* Loading skeletons */}
        {loading && (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        )}

        {/* Empty state */}
        {!loading && streams.length === 0 && (
          <div className="snap-start h-full w-full flex flex-col items-center justify-center gap-5 bg-black">
            <div className="text-center space-y-3">
              <Tv size={56} className="text-white/20 mx-auto" />
              <p className="text-white/50 font-semibold text-lg tracking-wide">No streams available</p>
              <p className="text-white/30 text-sm">Only completed sessions (2+ minutes) are shown here</p>
            </div>
            <Button
              variant="outline"
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              onClick={() => navigate("/rooms")}
            >
              Browse Audio Rooms
            </Button>
          </div>
        )}

        {/* Stream slides */}
        {streams.map((stream, idx) => (
          <div
            key={stream.id}
            ref={(el) => { slideRefs.current[idx] = el }}
            className="snap-start h-full w-full flex-shrink-0"
          >
            <LiveFeedCard
              stream={stream}
              viewerCount={viewerCounts[stream.id] ?? stream.viewerCount}
              navigate={navigate}
              onOpenChat={() => setActiveChatId(stream.id)}
              onOpenTip={() => { if (!authenticated) { login(); return }; openTip(stream) }}
              onOpenShare={() => setShareStreamId(stream.id)}
            />
          </div>
        ))}
      </div>

      {/* ── Position indicator ── */}
      {streams.length > 1 && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-sm px-2.5 py-1 rounded-full">
            {streams.length <= 8 ? (
              streams.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "rounded-full transition-all duration-300",
                    i === currentIndex
                      ? "w-4 h-1.5 bg-white"
                      : "w-1.5 h-1.5 bg-white/40",
                  )}
                />
              ))
            ) : (
              <span className="text-white/70 text-xs font-semibold tabular-nums">
                {currentIndex + 1} / {streams.length}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Chat bottom sheet ── */}
      {activeChatId && activeChat && activeStream && (
        <ChatSheet
          onClose={() => setActiveChatId(null)}
          chat={activeChat.messages}
          input={activeChat.input}
          onInputChange={(v) => updateChat(activeChatId, { input: v })}
          onSend={(e) => handleSendMsg(activeChatId, e)}
          authenticated={authenticated}
        />
      )}

      {/* ── Share dialog ── */}
      <Dialog open={!!shareStreamId} onOpenChange={(open) => !open && setShareStreamId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-xl font-bold tracking-tight">Share Livestream</DialogTitle>
            <DialogDescription>Spread the word across your networks.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input
              value={shareStreamId ? `${window.location.origin}/live/${shareStreamId}` : ""}
              readOnly
              className="bg-muted/50 font-mono text-xs"
            />
            <Button
              size="icon"
              variant="secondary"
              className="shrink-0 w-10"
              onClick={() => {
                if (shareStreamId) {
                  navigator.clipboard.writeText(`${window.location.origin}/live/${shareStreamId}`)
                  setShareStreamId(null)
                }
              }}
            >
              <Copy size={14} />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Tip modal ── */}
      {tipTarget && (
        <TipModal
          isOpen={!!tipTarget}
          onClose={() => setTipTarget(null)}
          agentId={tipTarget.id}
          agentName={tipTarget.name}
        />
      )}
    </div>
  )
}

export default LiveFeedPage
