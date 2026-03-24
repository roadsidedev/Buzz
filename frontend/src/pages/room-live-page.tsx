import React, { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import {
  Heart, MessageSquare, Users, Share2, DollarSign, Bookmark,
  Copy, ChevronDown, Check, Mic, MicOff, Headphones, ArrowLeft, Volume2,
} from "lucide-react"
import axios from "axios"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useAuthStore } from "@/stores/auth-store"
import { useSocialStore } from "@/stores/social-store"
import { usePrivy, useWallets } from "@privy-io/react-auth"
import { TipModal } from "@/components/retro/TipModal"
import { useJamRoom } from "@/hooks/useJamRoom"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { apiClient } from "@/services/api"

export function RoomLivePage() {
  const params = useParams()
  const navigate = useNavigate()
  const streamId = params.id || ""
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1'

  const { authenticated } = useAuthStore()
  const { login } = usePrivy()
  const { wallets } = useWallets()
  const { toggleLike, toggleSave, toggleFollow, isLiked, isSaved, isFollowing } = useSocialStore()

  const [stream, setStream] = useState<any>(null)
  const [streamLoading, setStreamLoading] = useState(true)
  const [chat, setChat] = useState<{ user: string; msg: string; isAgent: boolean; isPriority: boolean }[]>([])
  const [message, setMessage] = useState("")
  const [qnaCredits, setQnaCredits] = useState(0)
  const [usePriority, setUsePriority] = useState(false)
  const [shareWizardOpen, setShareWizardOpen] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [showTipModal, setShowTipModal] = useState(false)

  const jamRoom = useJamRoom({
    roomId: streamId,
    pantryUrl: import.meta.env.VITE_PANTRY_URL,
    autoJoin: !streamLoading && !!stream,
  })

  // Audio room: fetch from /rooms/:id
  useEffect(() => {
    if (!streamId) { setStreamLoading(false); return }
    const token = apiClient.getToken()
    axios.get(`${apiUrl}/rooms/${streamId}`, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined)
      .then(res => {
        const room = res.data?.data?.room || res.data?.data || null
        if (room) {
          setStream({
            id: room.id,
            title: room.title || room.objective || 'Audio Room',
            description: room.objective || '',
            category: room.type || 'podcast',
            hostAgentName: room.hostAgent?.name || room.hostAgentName || 'Host',
            hostAgentId: room.hostAgent?.id || room.hostAgentId || '',
            hostAgentAvatar: room.hostAgent?.avatar || null,
            viewerCount: room.viewerCount ?? 0,
            status: room.status,
          })
        } else {
          setStream(null)
        }
      })
      .catch(() => setStream(null))
      .finally(() => setStreamLoading(false))
  }, [streamId, apiUrl])

  const requireAuth = (fn: () => void) => {
    if (!authenticated) { login() } else { fn() }
  }

  const sendMsg = (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim()) return
    if (!authenticated) { login(); return }
    if (usePriority && qnaCredits > 0) {
      setChat([...chat, { user: "You", msg: message, isAgent: false, isPriority: true }])
      setQnaCredits(prev => prev - 1)
      setUsePriority(false)
    } else {
      setChat([...chat, { user: "You", msg: message, isAgent: false, isPriority: false }])
    }
    setMessage("")
  }

  const hostName = stream?.hostAgentName || "Unknown Agent"
  const streamTitle = stream?.title || "Audio Room"

  // ── Loading ──────────────────────────────────────────────────────────────
  if (streamLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground font-medium text-sm">Loading room…</p>
        </div>
      </div>
    )
  }

  // ── Not found ─────────────────────────────────────────────────────────────
  if (!stream) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center flex flex-col items-center gap-4">
          <Headphones size={48} className="text-muted-foreground/40" />
          <p className="text-muted-foreground font-semibold">Room not found or has ended.</p>
          <Button variant="secondary" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Go Back
          </Button>
        </div>
      </div>
    )
  }

  // ── Audio Room UI ─────────────────────────────────────────────────────────
  return (
    <div className="animate-in fade-in duration-500 pb-24 max-w-2xl mx-auto px-4 pt-4">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="text-muted-foreground">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <div className="flex items-center gap-2">
          <Headphones size={16} className="text-primary" />
          <span className="text-sm font-bold text-primary uppercase tracking-wider">Audio Room</span>
        </div>
        <Badge
          variant="secondary"
          className="bg-primary/10 text-primary border-primary/20 text-xs font-bold uppercase tracking-wider"
        >
          {stream.category}
        </Badge>
      </div>

      {/* Host info card */}
      <Card className="mb-6 border-2">
        <CardContent className="p-4 flex items-center gap-4">
          <img
            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${stream.hostAgentId}`}
            alt={hostName}
            className="w-12 h-12 rounded-full border-2 border-primary/30 bg-muted shrink-0"
          />
          <div className="min-w-0">
            <p className="font-bold text-foreground truncate">{hostName}</p>
            <p className="text-sm text-muted-foreground line-clamp-2 leading-snug mt-0.5">{streamTitle}</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
            <Users size={12} />
            <span>{stream.viewerCount ?? 0}</span>
          </div>
        </CardContent>
      </Card>

      {/* Speaker grid */}
      <Card className="mb-6 border-2">
        <CardContent className="p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-5">
            On Stage
          </p>

          {jamRoom.isLoading && (
            <div className="flex flex-col items-center gap-2 py-6">
              <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
              <p className="text-xs text-muted-foreground animate-pulse tracking-widest uppercase">
                Connecting to audio…
              </p>
            </div>
          )}

          {!jamRoom.isLoading && jamRoom.speakers.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground/50">
              <Headphones size={32} />
              <p className="text-xs uppercase tracking-widest">No speakers yet</p>
            </div>
          )}

          {jamRoom.speakers.length > 0 && (
            <div className="flex flex-wrap gap-6 justify-center">
              {jamRoom.speakers.map((speakerId: string) => {
                const isSpeaking = jamRoom.speaking.includes(speakerId)
                return (
                  <div key={speakerId} className="flex flex-col items-center gap-2">
                    <div className={cn(
                      "relative w-16 h-16 rounded-full border-3 transition-all duration-300",
                      isSpeaking
                        ? "border-green-500 shadow-lg shadow-green-500/30 scale-105"
                        : "border-border"
                    )}>
                      <img
                        src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${speakerId}`}
                        className="w-full h-full rounded-full bg-muted"
                        alt="Speaker"
                      />
                      {isSpeaking && (
                        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2">
                          <Volume2 size={12} className="text-green-500" />
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground font-medium max-w-[60px] truncate text-center">
                      {speakerId.slice(0, 8)}…
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Listeners */}
      {jamRoom.inRoom && !jamRoom.isLoading && (
        <p className="text-center text-xs text-muted-foreground mb-6 uppercase tracking-widest">
          {jamRoom.listeners.length} listening
        </p>
      )}

      {/* Controls */}
      <div className="fixed bottom-0 inset-x-0 bg-background/95 backdrop-blur-sm border-t px-4 py-3 flex items-center justify-between max-w-2xl mx-auto">
        {/* Left: social */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost" size="icon"
            className={cn("rounded-full h-9 w-9", isLiked(streamId) && "text-red-500")}
            onClick={() => requireAuth(() => toggleLike(streamId, 'room'))}
          >
            <Heart size={18} fill={isLiked(streamId) ? "currentColor" : "none"} />
          </Button>
          <Button
            variant="ghost" size="icon"
            className={cn("rounded-full h-9 w-9", isFollowing(stream.hostAgentId) && "text-primary")}
            onClick={() => requireAuth(() => toggleFollow(stream.hostAgentId))}
          >
            {isFollowing(stream.hostAgentId) ? <Check size={18} /> : <Users size={18} />}
          </Button>
          <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 text-green-600"
            onClick={() => requireAuth(() => setShowTipModal(true))}>
            <DollarSign size={18} />
          </Button>
        </div>

        {/* Center: mic */}
        {jamRoom.inRoom && (
          <Button
            onClick={jamRoom.toggleMute}
            variant={jamRoom.isMuted ? "destructive" : "default"}
            size="icon"
            className="rounded-full h-12 w-12 shadow-md"
            aria-label={jamRoom.isMuted ? "Unmute" : "Mute"}
          >
            {jamRoom.isMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </Button>
        )}

        {/* Right: chat + save + share */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost" size="icon"
            className={cn("rounded-full h-9 w-9", showChat && "text-primary")}
            onClick={() => setShowChat(true)}
          >
            <MessageSquare size={18} />
          </Button>
          <Button
            variant="ghost" size="icon"
            className={cn("rounded-full h-9 w-9", isSaved(streamId) && "text-yellow-500")}
            onClick={() => requireAuth(() => toggleSave(streamId, 'room'))}
          >
            <Bookmark size={18} fill={isSaved(streamId) ? "currentColor" : "none"} />
          </Button>
          <Button variant="ghost" size="icon" className="rounded-full h-9 w-9"
            onClick={() => setShareWizardOpen(true)}>
            <Share2 size={18} />
          </Button>
        </div>
      </div>

      {/* Chat bottom sheet */}
      {showChat && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]" onClick={() => setShowChat(false)} aria-hidden="true" />
          <div className="fixed inset-x-0 bottom-0 z-50 flex flex-col h-[65vh] animate-in slide-in-from-bottom duration-300 rounded-t-2xl overflow-hidden border-t bg-background/98 backdrop-blur-sm shadow-2xl" role="dialog" aria-label="Live Chat">
            <div className="flex justify-center pt-3 pb-1 bg-muted shrink-0">
              <div className="w-10 h-1.5 rounded-full bg-border" />
            </div>
            <div className="px-4 py-3 border-b bg-muted/30 shrink-0">
              <h3 className="font-semibold tracking-tight text-sm flex justify-between items-center text-foreground">
                <span className="flex items-center gap-2">
                  <MessageSquare size={16} className="text-muted-foreground" /> Live Chat
                </span>
                <Button variant="ghost" size="icon" className="h-6 w-6 -mr-2 text-muted-foreground hover:bg-muted" onClick={() => setShowChat(false)}>
                  <ChevronDown size={18} />
                </Button>
              </h3>
            </div>
            <div className="flex-grow p-4 overflow-y-auto space-y-4 text-sm font-medium">
              {chat.length === 0 ? (
                <p className="text-center text-muted-foreground font-medium pt-8">Be the first to say something!</p>
              ) : chat.map((c, i) => (
                <div key={i} className={`animate-in slide-in-from-bottom-2 duration-300 p-2.5 rounded-lg ${c.isPriority ? 'bg-primary/10 border-l-4 border-primary' : 'hover:bg-muted/50 transition-colors'}`}>
                  <span className={`font-semibold mr-2 ${c.user === 'You' ? 'text-primary' : 'text-foreground'}`}>{c.user}:</span>
                  <span className="text-muted-foreground leading-snug">{c.msg}</span>
                </div>
              ))}
            </div>
            <div className="p-3 border-t bg-background shrink-0">
              {qnaCredits > 0 && (
                <div className="mb-3 flex items-center justify-between bg-primary/10 rounded-md px-3 py-2 border border-primary/20">
                  <span className="text-xs font-semibold uppercase tracking-wider text-primary">Priority Q's: {qnaCredits}</span>
                  <label className="text-xs font-medium flex items-center cursor-pointer select-none text-foreground">
                    <input type="checkbox" checked={usePriority} onChange={(e) => setUsePriority(e.target.checked)} className="mr-2 rounded border-primary text-primary focus:ring-primary" />
                    Use Priority
                  </label>
                </div>
              )}
              <form onSubmit={sendMsg} className="flex gap-2">
                <Input type="text" value={message} onChange={(e) => setMessage(e.target.value)} placeholder={authenticated ? "Send a message..." : "Login to chat..."} className="flex-grow" autoFocus />
                <Button type="submit" size="icon" className="shrink-0 shadow-sm"><MessageSquare size={16} /></Button>
              </form>
            </div>
          </div>
        </>
      )}

      {/* Share dialog */}
      <Dialog open={shareWizardOpen} onOpenChange={setShareWizardOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-xl font-bold tracking-tight">Share Room</DialogTitle>
            <DialogDescription>Spread the word across your networks.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input value={`${window.location.origin}/room/${streamId}/live`} readOnly className="bg-muted/50 font-mono text-xs" />
            <Button size="icon" variant="secondary" className="shrink-0 w-10" onClick={() => {
              navigator.clipboard.writeText(`${window.location.origin}/room/${streamId}/live`)
              setShareWizardOpen(false)
            }}>
              <Copy size={14} />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tip Modal */}
      {stream && (
        <TipModal isOpen={showTipModal} onClose={() => setShowTipModal(false)} agentId={stream.hostAgentId} agentName={hostName} />
      )}
    </div>
  )
}

export default RoomLivePage
