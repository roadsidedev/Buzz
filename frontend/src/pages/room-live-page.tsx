import React, { useState, useEffect, useRef, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import {
  MessageSquare, Share2, DollarSign,
  Copy, ChevronDown, Mic, MicOff, Headphones, ArrowLeft, PhoneOff, Send, Users,
} from "lucide-react"
import axios from "axios"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useAuthStore } from "@/stores/auth-store"
import { useSocialStore } from "@/stores/social-store"
import { usePrivy } from "@privy-io/react-auth"
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
import wsService from "@/services/websocket"

// ── Types ─────────────────────────────────────────────────────────────────────

interface ParticipantInfo {
  id: string
  name: string
  avatar: string | null
  role: string
}

const ROLE_LABEL: Record<string, string> = {
  host: "Host",
  co_host: "Co-host",
  speaker: "Speaker",
  moderator: "Moderator",
  spectator: "Listener",
}

// ── ScoreBar ──────────────────────────────────────────────────────────────────

function ScoreBar({ score }: { score?: number }) {
  if (score === undefined) return null
  return (
    <div className="flex items-center gap-1.5 mt-1">
      <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-violet-400 rounded-full transition-all duration-700"
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>
      <span className="text-[9px] font-bold text-violet-300 tabular-nums">
        {Math.round(score)}
      </span>
    </div>
  )
}

// ── Waveform (speaking indicator) ─────────────────────────────────────────────

function Waveform({ size = "sm" }: { size?: "sm" | "md" | "lg" }) {
  const h = size === "lg"
    ? ["h-4", "h-7", "h-4"]
    : size === "md"
      ? ["h-3", "h-5", "h-3"]
      : ["h-2.5", "h-3.5", "h-2.5"]
  return (
    <span className="flex items-end gap-px">
      {h.map((cls, i) => (
        <span
          key={i}
          className={`block w-[3px] ${cls} bg-primary rounded-sm animate-bounce`}
          style={{ animationDuration: `${0.5 + i * 0.15}s`, animationDelay: `${i * 0.12}s` }}
        />
      ))}
    </span>
  )
}

// ── HostTile ──────────────────────────────────────────────────────────────────

function HostTile({
  participant,
  isSpeaking,
  score,
  large,
}: {
  participant: ParticipantInfo
  isSpeaking: boolean
  score?: number
  large?: boolean
}) {
  const avatarClass = large ? "w-32 h-32 border-4" : "w-24 h-24 border-4"
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={cn(
          `${avatarClass} rounded-full border-background transition-all duration-300 overflow-hidden bg-muted`,
          isSpeaking && "ring-4 ring-primary ring-offset-4 ring-offset-background shadow-2xl shadow-primary/30",
        )}
      >
        <img
          src={participant.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${participant.id}`}
          className="w-full h-full object-cover"
          alt={participant.name}
        />
      </div>

      <div className="h-5 flex items-center justify-center">
        {isSpeaking ? <Waveform size={large ? "lg" : "md"} /> : <MicOff size={12} className="text-muted-foreground/40" strokeWidth={1.5} />}
      </div>

      <p className={cn("font-bold text-white/90 text-center leading-tight", large ? "text-lg" : "text-base")}>
        {participant.name}
      </p>
      <span className="text-[10px] font-black uppercase tracking-widest text-violet-400">
        {ROLE_LABEL[participant.role] || "Host"}
      </span>
      <ScoreBar score={score} />
    </div>
  )
}

// ── SpeakerTile ───────────────────────────────────────────────────────────────

function SpeakerTile({
  participant,
  isSpeaking,
  score,
  compact,
}: {
  participant: ParticipantInfo
  isSpeaking: boolean
  score?: number
  compact?: boolean
}) {
  const sz = compact ? "w-14 h-14 border-2" : "w-[68px] h-[68px] border-2"
  return (
    <div className={cn("flex flex-col items-center gap-1.5", compact && "gap-1")}>
      <div className={cn(`${sz} rounded-full border-background transition-all duration-300 overflow-hidden bg-muted`, isSpeaking && "ring-2 ring-primary ring-offset-2 ring-offset-background shadow-lg shadow-primary/20")}>
        <img
          src={participant.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${participant.id}`}
          className="w-full h-full object-cover"
          alt={participant.name}
        />
      </div>
      <div className="h-4 flex items-center justify-center">
        {isSpeaking ? <Waveform size="sm" /> : <MicOff size={10} className="text-muted-foreground/40" strokeWidth={1.5} />}
      </div>
      <p className={cn("font-semibold text-white/80 text-center leading-tight truncate", compact ? "text-[10px] w-14" : "text-[11px] w-16")}>
        {participant.name}
      </p>
      <p className={cn("text-[10px] font-medium", participant.role === "co_host" ? "text-violet-400" : "text-white/40")}>
        {ROLE_LABEL[participant.role] || "Speaker"}
      </p>
      {!compact && <ScoreBar score={score} />}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function RoomLivePage() {
  const params = useParams()
  const navigate = useNavigate()
  const streamId = params.id || ""
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:4000/api/v1"

  const { authenticated } = useAuthStore()
  const { login } = usePrivy()
  const { isLiked, isSaved, toggleLike, toggleSave } = useSocialStore()

  const [stream, setStream] = useState<any>(null)
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null)
  const [streamLoading, setStreamLoading] = useState(true)
  const [participants, setParticipants] = useState<ParticipantInfo[]>([])
  const [chat, setChat] = useState<{ user: string; msg: string; isAgent: boolean; isPriority: boolean }[]>([])
  const [message, setMessage] = useState("")
  const [shareWizardOpen, setShareWizardOpen] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [showTipModal, setShowTipModal] = useState(false)
  const [agentScores, setAgentScores] = useState<Record<string, number>>({})
  const [isRecording, setIsRecording] = useState(false)
  const [recordingUploading, setRecordingUploading] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const recordingStreamRef = useRef<MediaStream | null>(null)
  const recordingStartRef = useRef<Date | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Responsive
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== "undefined" && window.innerWidth >= 1024)
  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= 1024)
    window.addEventListener("resize", handler)
    return () => window.removeEventListener("resize", handler)
  }, [])

  const jamRoom = useJamRoom({
    roomId: streamId,
    pantryUrl: import.meta.env.VITE_PANTRY_URL,
    autoJoin: !streamLoading && !!stream,
  })

  // ── Live score updates ───────────────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = wsService.onMessageSelected((data) => {
      if (data.roomId === streamId) {
        setAgentScores((prev) => ({ ...prev, [data.agentId]: data.score }))
      }
    })
    return unsubscribe
  }, [streamId])

  // ── Fetch room ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!streamId) { setStreamLoading(false); return }
    const token = apiClient.getToken()
    axios
      .get(`${apiUrl}/rooms/${streamId}`, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined)
      .then((res) => {
        const room = res.data?.data?.room || res.data?.data || null
        if (room) {
          setStream({
            id: room.id,
            title: room.title || room.objective || "Audio Room",
            description: room.objective || "",
            category: room.type || "debate",
            hostAgentName: room.hostAgent?.name || room.hostAgentName || "Host",
            hostAgentId: room.hostAgent?.id || room.hostAgentId || "",
            hostAgentAvatar: room.hostAgent?.avatar || null,
            viewerCount: room.viewerCount ?? 0,
            status: room.status,
            recordingUrl: room.recordingUrl || null,
            recordingEnabled: room.recordingEnabled ?? true,
          })
        } else {
          setStream(null)
        }
      })
      .catch(() => setStream(null))
      .finally(() => setStreamLoading(false))
  }, [streamId, apiUrl])

  // ── Fetch participants ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!streamId || !stream) return
    const token = apiClient.getToken()
    axios
      .get(`${apiUrl}/rooms/${streamId}/participants`, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined)
      .then((res) => setParticipants(res.data?.data?.participants || []))
      .catch(() => {})
  }, [streamId, stream, apiUrl])

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chat.length])

  // ── Stage participants ──────────────────────────────────────────────────────
  const stageParticipants = React.useMemo<ParticipantInfo[]>(() => {
    if (participants.length > 0) {
      const order: Record<string, number> = { host: 0, co_host: 1, moderator: 2, speaker: 3 }
      return [...participants]
        .filter((p) => p.role !== "spectator")
        .sort((a, b) => (order[a.role] ?? 99) - (order[b.role] ?? 99))
    }
    return jamRoom.speakers.map((id: string) => ({ id, name: id.slice(0, 8), avatar: null, role: "speaker" }))
  }, [participants, jamRoom.speakers])

  const host = stageParticipants.find((p) => p.role === "host") ?? stageParticipants[0] ?? null
  const supporters = stageParticipants.filter((p) => p !== host)

  const isHostSpeaking = host
    ? (jamRoom.speaking.includes(host.id) || (jamRoom.speaking.length > 0 && stageParticipants.indexOf(host) < jamRoom.speaking.length))
    : false

  const requireAuth = (fn: () => void) => {
    if (!authenticated) { login() } else { fn() }
  }

  // ── Recording ───────────────────────────────────────────────────────────────
  const uploadRecording = useCallback(async (blob: Blob) => {
    const token = apiClient.getToken()
    if (!token) return
    setRecordingUploading(true)
    try {
      const form = new FormData()
      form.append("audio", blob, "recording.webm")
      if (recordingStartRef.current) form.append("startedAt", recordingStartRef.current.toISOString())
      form.append("endedAt", new Date().toISOString())
      await axios.post(`${apiUrl}/rooms/${streamId}/recording`, form, { headers: { Authorization: `Bearer ${token}` } })
    } catch { /* best-effort */ } finally {
      setRecordingUploading(false)
    }
  }, [apiUrl, streamId])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop()
    }
    recordingStreamRef.current?.getTracks().forEach((t) => t.stop())
    recordingStreamRef.current = null
    setIsRecording(false)
  }, [])

  const startRecording = useCallback(async () => {
    if (!stream?.recordingEnabled || isRecording) return
    try {
      const captureStream = await navigator.mediaDevices.getDisplayMedia({ video: false, audio: true } as DisplayMediaStreamOptions)
      recordingStreamRef.current = captureStream
      chunksRef.current = []
      recordingStartRef.current = new Date()
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/ogg"
      const recorder = new MediaRecorder(captureStream, { mimeType })
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = () => uploadRecording(new Blob(chunksRef.current, { type: mimeType }))
      captureStream.getTracks().forEach((track) => { track.onended = () => stopRecording() })
      recorder.start(5000)
      mediaRecorderRef.current = recorder
      setIsRecording(true)
    } catch { /* user cancelled */ }
  }, [stream?.recordingEnabled, isRecording, uploadRecording, stopRecording])

  useEffect(() => {
    if (jamRoom.inRoom && stream?.recordingEnabled && !isRecording) startRecording()
  }, [jamRoom.inRoom, stream?.recordingEnabled, isRecording, startRecording])

  useEffect(() => () => stopRecording(), [stopRecording])

  const handleLeave = useCallback(() => {
    stopRecording()
    jamRoom.disconnect()
    navigate(-1)
  }, [stopRecording, jamRoom, navigate])

  // ── Chat ────────────────────────────────────────────────────────────────────
  const sendMsg = (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim()) return
    if (!authenticated) { login(); return }
    setChat([...chat, { user: "You", msg: message.trim(), isAgent: false, isPriority: false }])
    setMessage("")
  }

  const streamTitle = stream?.title || "Audio Room"

  // ── Loading ─────────────────────────────────────────────────────────────────
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

  // ── Replay UI ───────────────────────────────────────────────────────────────
  const isReplay = stream?.status === "completed" || stream?.status === "failed"

  if (isReplay && stream?.recordingUrl) {
    return (
      <div className="animate-in fade-in duration-500 pb-24 max-w-2xl mx-auto px-4 pt-4">
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="text-muted-foreground">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <div className="flex items-center gap-2">
            <Headphones size={16} className="text-primary" />
            <span className="text-sm font-bold text-primary uppercase tracking-wider">Replay</span>
          </div>
          <Badge variant="secondary" className="text-xs uppercase tracking-wider">Ended</Badge>
        </div>

        <div className="mb-6 border-2 rounded-lg p-4 flex items-center gap-4">
          <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${stream.hostAgentId}`} alt={stream.hostAgentName} className="w-12 h-12 rounded-full border-2 border-primary/30 bg-muted shrink-0" />
          <div className="min-w-0">
            <p className="font-bold text-foreground truncate">{stream.hostAgentName}</p>
            <p className="text-sm text-muted-foreground line-clamp-2 leading-snug mt-0.5">{stream.title}</p>
          </div>
        </div>

        <div className="mb-6 border-2 rounded-lg p-6 flex flex-col items-center gap-4">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Recording</p>
          <audio ref={audioPlayerRef} src={stream.recordingUrl} controls className="w-full" aria-label="Room recording" />
          <p className="text-xs text-muted-foreground text-center">This space has ended. Listen to the full recording above.</p>
        </div>

        <div className="fixed bottom-0 inset-x-0 bg-background/95 backdrop-blur-sm border-t px-4 py-3 flex items-center justify-between max-w-2xl mx-auto">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className={cn("rounded-full h-9 w-9", isLiked(streamId) && "text-red-500")} onClick={() => requireAuth(() => toggleLike(streamId, "room"))}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill={isLiked(streamId) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
            </Button>
            <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 text-green-600" onClick={() => requireAuth(() => setShowTipModal(true))}>
              <DollarSign size={18} />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className={cn("rounded-full h-9 w-9", isSaved(streamId) && "text-yellow-500")} onClick={() => requireAuth(() => toggleSave(streamId, "room"))}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill={isSaved(streamId) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"><path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>
            </Button>
            <Button variant="ghost" size="icon" className="rounded-full h-9 w-9" onClick={() => setShareWizardOpen(true)}>
              <Share2 size={18} />
            </Button>
          </div>
        </div>

        <Dialog open={shareWizardOpen} onOpenChange={setShareWizardOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader className="pb-4">
              <DialogTitle className="text-xl font-bold tracking-tight">Share Replay</DialogTitle>
              <DialogDescription>Share this recording with others.</DialogDescription>
            </DialogHeader>
            <div className="flex gap-2">
              <input value={`${window.location.origin}/room/${streamId}/live`} readOnly className="flex-1 bg-muted/50 font-mono text-xs px-3 py-2 rounded border" />
              <Button size="icon" variant="secondary" className="shrink-0 w-10" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/room/${streamId}/live`); setShareWizardOpen(false) }}>
                <Copy size={14} />
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {stream && <TipModal isOpen={showTipModal} onClose={() => setShowTipModal(false)} agentId={stream.hostAgentId} agentName={stream.hostAgentName} />}
      </div>
    )
  }

  if (isReplay && !stream?.recordingUrl) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center flex flex-col items-center gap-4">
          <Headphones size={48} className="text-muted-foreground/40" />
          <p className="text-muted-foreground font-semibold">This space has ended.</p>
          <p className="text-sm text-muted-foreground">No recording was saved for this room.</p>
          <Button variant="secondary" onClick={() => navigate(-1)}><ArrowLeft className="w-4 h-4 mr-2" /> Go Back</Button>
        </div>
      </div>
    )
  }

  // ── LIVE ROOM ───────────────────────────────────────────────────────────────
  const totalListeners = jamRoom.listeners.length + (stream.viewerCount || 0)

  // ── DESKTOP: Three-column Clubhouse layout ──────────────────────────────────
  if (isDesktop) {
    return (
      <div
        className="animate-in fade-in duration-500 flex flex-col h-full min-h-screen"
        style={{ background: "linear-gradient(180deg, #0f0a1e 0%, #0d0d14 100%)" }}
      >
        {/* ── Desktop Header ── */}
        <div className="flex items-center gap-4 px-6 py-4 border-b border-white/8 shrink-0">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-1.5 rounded-full text-white/40 hover:text-white/80 hover:bg-white/5 transition-all"
            aria-label="Back"
          >
            <ArrowLeft size={18} />
          </button>

          <div className="flex-grow min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="flex items-center gap-1.5 bg-red-500/15 text-red-400 text-[11px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                Live
              </span>
              <Badge variant="secondary" className="capitalize text-xs font-semibold bg-white/8 text-white/60 border-0">
                {stream.category}
              </Badge>
              {totalListeners > 0 && (
                <span className="text-sm font-bold text-white/30 flex items-center gap-1">
                  <Users size={12} /> {totalListeners.toLocaleString()}
                </span>
              )}
              {isRecording && (
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                  <span className="text-[11px] font-black text-red-400 uppercase tracking-widest">REC</span>
                </span>
              )}
            </div>
            <h1 className="text-base font-bold text-white/90 leading-snug mt-0.5 truncate">{streamTitle}</h1>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button type="button" onClick={() => setShareWizardOpen(true)} className="p-2 text-white/40 hover:text-white/80 transition-colors" aria-label="Share">
              <Share2 size={17} />
            </button>
          </div>
        </div>

        {/* ── THREE-COLUMN BODY ── */}
        <div className="flex flex-1 overflow-hidden min-h-0">

          {/* ── LEFT: Stage (speakers) ── */}
          <div className="flex flex-col flex-1 min-w-0 overflow-y-auto px-8 py-8 relative">
            {/* Ambient background */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(108,92,231,0.22) 0%, transparent 65%)" }}
            />

            {jamRoom.isLoading ? (
              <div className="flex flex-col items-center gap-3 py-16">
                <div className="w-8 h-8 border-4 border-violet-500/30 border-t-violet-400 rounded-full animate-spin" />
                <p className="text-xs text-white/40 animate-pulse tracking-widest uppercase">Connecting…</p>
              </div>
            ) : stageParticipants.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-white/20">
                <Headphones size={40} />
                <p className="text-xs uppercase tracking-widest">No speakers yet</p>
              </div>
            ) : (
              <div className="relative z-10">
                {/* Host — center, large */}
                {host && (
                  <div className="flex justify-center mb-12">
                    <HostTile
                      participant={host}
                      isSpeaking={isHostSpeaking}
                      score={agentScores[host.id]}
                      large
                    />
                  </div>
                )}

                {/* Supporting speakers */}
                {supporters.length > 0 && (
                  <div className="flex justify-center gap-10 flex-wrap">
                    {supporters.map((p, idx) => (
                      <SpeakerTile
                        key={p.id}
                        participant={p}
                        isSpeaking={jamRoom.speaking.includes(p.id) || (jamRoom.speaking.length > 0 && idx + 1 < jamRoom.speaking.length)}
                        score={agentScores[p.id]}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Desktop action bar (below the stage) ── */}
            <div className="mt-auto pt-10 flex items-center justify-center gap-8">
              <button
                type="button"
                onClick={handleLeave}
                className="flex items-center gap-1.5 text-red-400 hover:text-red-300 transition-colors bg-red-500/10 hover:bg-red-500/20 px-4 py-2 rounded-full"
                aria-label="Leave"
              >
                <PhoneOff size={16} />
                <span className="text-xs font-bold uppercase tracking-wide">Leave</span>
              </button>

              {/* Mic — primary CTA */}
              <button
                type="button"
                onClick={jamRoom.inRoom ? jamRoom.toggleMute : undefined}
                className={cn(
                  "w-16 h-16 rounded-full border-2 flex items-center justify-center transition-all duration-200 shadow-lg",
                  !jamRoom.inRoom
                    ? "border-white/10 text-white/20 cursor-default"
                    : jamRoom.isMuted
                      ? "border-white/20 bg-white/5 text-white/40"
                      : "border-violet-500 bg-violet-600 text-white shadow-violet-500/40",
                )}
                aria-label={jamRoom.isMuted ? "Unmute" : "Mute"}
              >
                {jamRoom.isMuted || !jamRoom.inRoom ? <MicOff size={24} /> : <Mic size={24} />}
              </button>

              <button
                type="button"
                onClick={() => requireAuth(() => setShowTipModal(true))}
                className="flex items-center gap-1.5 text-white/40 hover:text-green-400 transition-colors bg-white/5 hover:bg-green-500/10 px-4 py-2 rounded-full"
                aria-label="Tip"
              >
                <DollarSign size={16} />
                <span className="text-xs font-bold uppercase tracking-wide">Tip</span>
              </button>

              {!isRecording && !recordingUploading && stream?.recordingEnabled && jamRoom.inRoom && (
                <button
                  type="button"
                  onClick={startRecording}
                  className="flex items-center gap-1.5 text-white/25 hover:text-white/50 transition-colors bg-white/5 hover:bg-white/10 px-4 py-2 rounded-full"
                >
                  <span className="w-1.5 h-1.5 rounded-full border border-current" />
                  <span className="text-xs uppercase tracking-widest">Start Rec</span>
                </button>
              )}
              {recordingUploading && (
                <span className="text-[11px] text-white/30 uppercase tracking-widest">Saving…</span>
              )}
            </div>
          </div>

          {/* ── MIDDLE: Listeners ── */}
          <div className="w-[200px] shrink-0 border-l border-white/8 flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-white/8 shrink-0 flex items-center justify-between">
              <span className="font-black text-[11px] uppercase tracking-widest text-white/30">Listeners</span>
              <span className="text-[10px] font-bold text-white/20">{totalListeners}</span>
            </div>
            <div className="flex-grow overflow-y-auto p-3 space-y-2 scrollbar-hide">
              {jamRoom.listeners.length === 0 && (
                <p className="text-[11px] text-white/20 text-center mt-6">No listeners yet</p>
              )}
              {jamRoom.listeners.map((listenerId: string) => (
                <div key={listenerId} className="flex items-center gap-2">
                  <img
                    src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${listenerId}`}
                    className="w-7 h-7 rounded-full border border-white/10 bg-white/5"
                    alt="Listener"
                  />
                  <span className="text-xs text-white/40 font-medium truncate">{listenerId.slice(0, 8)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── RIGHT: Persistent Chat ── */}
          <div
            className="w-[280px] shrink-0 border-l border-white/8 flex flex-col overflow-hidden"
            style={{ background: "rgba(15,10,30,0.85)" }}
          >
            {/* Chat header */}
            <div className="px-4 py-3 border-b border-white/8 shrink-0 flex items-center gap-2">
              <MessageSquare size={14} className="text-white/30" />
              <span className="font-black text-[11px] uppercase tracking-widest text-white/30">Live Chat</span>
            </div>

            {/* Messages */}
            <div className="flex-grow overflow-y-auto p-3 space-y-2.5 scrollbar-hide">
              {chat.length === 0 ? (
                <p className="text-center text-white/20 text-xs font-medium pt-8">Be the first to say something!</p>
              ) : chat.map((c, i) => (
                <div
                  key={i}
                  className={cn(
                    "animate-in slide-in-from-bottom-2 duration-200 p-2 rounded-lg",
                    c.isPriority ? "bg-primary/10 border-l-2 border-primary" : "hover:bg-white/5 transition-colors",
                  )}
                >
                  <span className={cn("font-semibold text-xs mr-1.5", c.user === "You" ? "text-violet-400" : "text-white/70")}>
                    {c.user}:
                  </span>
                  <span className="text-white/45 text-xs leading-snug">{c.msg}</span>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Chat input */}
            <div className="p-2.5 border-t border-white/8 shrink-0">
              <form onSubmit={sendMsg} className="flex gap-2">
                <Input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={authenticated ? "Send a message…" : "Login to chat…"}
                  className="flex-grow h-8 text-xs bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-primary/40"
                />
                <Button type="submit" size="icon" className="h-8 w-8 shrink-0 bg-primary hover:bg-primary/80">
                  <Send size={13} />
                </Button>
              </form>
            </div>
          </div>
        </div>

        {/* Share dialog */}
        <Dialog open={shareWizardOpen} onOpenChange={setShareWizardOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader className="pb-4">
              <DialogTitle className="text-xl font-bold tracking-tight">Share Room</DialogTitle>
              <DialogDescription>Spread the word across your networks.</DialogDescription>
            </DialogHeader>
            <div className="flex gap-2">
              <Input value={`${window.location.origin}/room/${streamId}/live`} readOnly className="bg-muted/50 font-mono text-xs" />
              <Button size="icon" variant="secondary" className="shrink-0 w-10" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/room/${streamId}/live`); setShareWizardOpen(false) }}>
                <Copy size={14} />
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {stream && <TipModal isOpen={showTipModal} onClose={() => setShowTipModal(false)} agentId={stream.hostAgentId} agentName={stream.hostAgentName} />}
      </div>
    )
  }

  // ── MOBILE LAYOUT (original, preserved exactly) ──────────────────────────────
  return (
    <div
      className="animate-in fade-in duration-500 min-h-screen pb-28"
      style={{ background: "linear-gradient(180deg, #0f0a1e 0%, #0d0d14 100%)" }}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-1 text-white/50 hover:text-white/80 transition-colors"
          aria-label="Back"
        >
          <ChevronDown size={24} />
        </button>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 bg-red-500/15 text-red-400 text-[11px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            Live
          </span>
          {totalListeners > 0 && (
            <span className="text-sm font-bold text-white/50">
              {totalListeners.toLocaleString()}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setShareWizardOpen(true)} className="p-2 text-white/50 hover:text-white/80 transition-colors" aria-label="Share">
            <Share2 size={18} />
          </button>
        </div>
      </div>

      {/* ── Room title + category ── */}
      <div className="px-5 pb-2">
        <h1 className="text-xl font-bold text-white leading-snug mb-2 line-clamp-2">{streamTitle}</h1>
        <Badge variant="secondary" className="capitalize text-xs font-semibold bg-white/10 text-white/70 border-0">
          {stream.category}
        </Badge>
      </div>

      {/* ── Stage ── */}
      <div className="relative px-5 pt-8 pb-6">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(108,92,231,0.22) 0%, transparent 65%)" }}
        />

        {jamRoom.isLoading ? (
          <div className="flex flex-col items-center gap-3 py-10">
            <div className="w-8 h-8 border-4 border-violet-500/30 border-t-violet-400 rounded-full animate-spin" />
            <p className="text-xs text-white/40 animate-pulse tracking-widest uppercase">Connecting…</p>
          </div>
        ) : stageParticipants.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-white/20">
            <Headphones size={40} />
            <p className="text-xs uppercase tracking-widest">No speakers yet</p>
          </div>
        ) : (
          <>
            {host && (
              <div className="flex justify-center mb-8">
                <HostTile participant={host} isSpeaking={isHostSpeaking} score={agentScores[host.id]} />
              </div>
            )}
            {supporters.length > 0 && (
              <div className="flex justify-center gap-8 flex-wrap">
                {supporters.map((p, idx) => (
                  <SpeakerTile
                    key={p.id}
                    participant={p}
                    isSpeaking={jamRoom.speaking.includes(p.id) || (jamRoom.speaking.length > 0 && idx + 1 < jamRoom.speaking.length)}
                    score={agentScores[p.id]}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Listeners ── */}
      <div className="px-5 pt-4 pb-3 border-t border-white/10">
        <div className="flex items-center gap-3">
          {jamRoom.listeners.length > 0 && (
            <div className="flex -space-x-2">
              {jamRoom.listeners.slice(0, 8).map((listenerId: string) => (
                <img key={listenerId} src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${listenerId}`} className="w-8 h-8 rounded-full border-2 border-white/10 bg-white/5" alt="Listener" />
              ))}
            </div>
          )}
          <span className="text-sm font-semibold text-white/50">
            {totalListeners > 0 ? `${totalListeners > 8 ? `+${totalListeners - 8} ` : ""}listening` : "No listeners yet"}
          </span>
        </div>
      </div>

      {/* ── REC indicator ── */}
      <div className="px-5 py-2 min-h-[28px] flex items-center gap-3">
        {isRecording && (
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
            <span className="text-[11px] font-black text-red-400 uppercase tracking-widest">REC</span>
          </span>
        )}
        {recordingUploading && (
          <span className="text-[11px] text-white/40 uppercase tracking-widest">Saving…</span>
        )}
        {!isRecording && !recordingUploading && stream?.recordingEnabled && jamRoom.inRoom && (
          <button
            type="button"
            onClick={startRecording}
            className="text-[11px] text-white/30 hover:text-white/50 uppercase tracking-widest transition-colors flex items-center gap-1.5"
          >
            <span className="w-1.5 h-1.5 rounded-full border border-current" />
            Start Rec
          </button>
        )}
      </div>

      {/* ── Fixed bottom action bar ── */}
      <div
        className="fixed bottom-0 inset-x-0 backdrop-blur-sm border-t border-white/10 z-30"
        style={{ background: "rgba(13,13,20,0.95)" }}
      >
        <div className="max-w-2xl mx-auto px-6 py-3 flex items-center justify-between">
          <button type="button" onClick={handleLeave} className="flex flex-col items-center gap-0.5 text-red-400 hover:text-red-300 transition-colors" aria-label="Leave">
            <PhoneOff size={20} />
            <span className="text-[9px] font-bold uppercase tracking-wide">Leave</span>
          </button>
          <button type="button" onClick={() => requireAuth(() => setShowTipModal(true))} className="flex flex-col items-center gap-0.5 text-white/50 hover:text-green-400 transition-colors" aria-label="Tip">
            <DollarSign size={22} />
            <span className="text-[9px] font-bold uppercase tracking-wide">Tip</span>
          </button>
          <button
            type="button"
            onClick={jamRoom.inRoom ? jamRoom.toggleMute : undefined}
            className={cn(
              "w-16 h-16 rounded-full border-2 flex items-center justify-center transition-all duration-200 shadow-lg",
              !jamRoom.inRoom ? "border-white/10 text-white/20 cursor-default" : jamRoom.isMuted ? "border-white/20 bg-white/5 text-white/40" : "border-violet-500 bg-violet-600 text-white shadow-violet-500/40",
            )}
            aria-label={jamRoom.isMuted ? "Unmute" : "Mute"}
          >
            {jamRoom.isMuted || !jamRoom.inRoom ? <MicOff size={24} /> : <Mic size={24} />}
          </button>
          <button type="button" onClick={() => setShowChat(true)} className="relative flex flex-col items-center gap-0.5 text-white/50 hover:text-white/80 transition-colors" aria-label="Chat">
            <MessageSquare size={22} />
            <span className="text-[9px] font-bold uppercase tracking-wide">Chat</span>
            {chat.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[15px] h-[15px] flex items-center justify-center px-0.5">
                {chat.length > 9 ? "9+" : chat.length}
              </span>
            )}
          </button>
          <button type="button" onClick={() => setShareWizardOpen(true)} className="flex flex-col items-center gap-0.5 text-white/50 hover:text-white/80 transition-colors" aria-label="Share">
            <Share2 size={22} />
            <span className="text-[9px] font-bold uppercase tracking-wide">Share</span>
          </button>
        </div>
      </div>

      {/* ── Mobile Chat bottom sheet ── */}
      {showChat && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]" onClick={() => setShowChat(false)} aria-hidden="true" />
          <div
            className="fixed inset-x-0 bottom-0 z-50 flex flex-col h-[55vh] animate-in slide-in-from-bottom duration-300 rounded-t-2xl overflow-hidden border-t border-white/10 shadow-2xl"
            style={{ background: "rgba(15,10,30,0.98)", backdropFilter: "blur(12px)" }}
            role="dialog"
            aria-label="Live Chat"
          >
            <div className="flex justify-center pt-3 pb-1 bg-white/5 shrink-0">
              <div className="w-10 h-1.5 rounded-full bg-white/20" />
            </div>
            <div className="px-4 py-3 border-b border-white/10 bg-white/5 shrink-0 flex items-center justify-between">
              <span className="font-semibold tracking-tight text-sm flex items-center gap-2 text-white/80">
                <MessageSquare size={16} className="text-white/40" />
                Live Chat
              </span>
              <button type="button" title="Close chat" className="text-white/40 hover:text-white/70 transition-colors" onClick={() => setShowChat(false)}>
                <ChevronDown size={18} />
              </button>
            </div>
            <div className="flex-grow p-4 overflow-y-auto space-y-3 text-sm font-medium">
              {chat.length === 0 ? (
                <p className="text-center text-white/40 font-medium pt-8">Be the first to say something!</p>
              ) : chat.map((c, i) => (
                <div key={i} className="animate-in slide-in-from-bottom-2 duration-300 p-2.5 rounded-lg hover:bg-white/5 transition-colors">
                  <span className={cn("font-semibold mr-2", c.user === "You" ? "text-violet-400" : "text-white/80")}>{c.user}:</span>
                  <span className="text-white/50 leading-snug">{c.msg}</span>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="p-3 border-t border-white/10 bg-black/20 shrink-0">
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
            <Button size="icon" variant="secondary" className="shrink-0 w-10" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/room/${streamId}/live`); setShareWizardOpen(false) }}>
              <Copy size={14} />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {stream && <TipModal isOpen={showTipModal} onClose={() => setShowTipModal(false)} agentId={stream.hostAgentId} agentName={stream.hostAgentName} />}
    </div>
  )
}

export default RoomLivePage
