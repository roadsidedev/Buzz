import React, { useState, useEffect, useRef, useCallback, useMemo } from "react"
import {
  ChevronDown, Mic, MicOff, MessageSquare, Share2, DollarSign,
  PhoneOff, Copy, Plus, Headphones, Volume2, VolumeX,
} from "lucide-react"
import axios from "axios"
import { cn } from "@/lib/utils"
import { useRoomStore } from "@/stores/room-store"
import { useLiveRoom } from "@/contexts/live-room-context"
import { useAuthStore } from "@/stores/auth-store"
import { usePrivy } from "@privy-io/react-auth"
import { TipModal } from "@/components/retro/TipModal"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { apiClient } from "@/services/api"
import wsService from "@/services/websocket"
import { BeeSpinner } from "@/components/discovery/loading-state"

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
  moderator: "Mod",
  spectator: "Listener",
}

// ── Audio Utilities ───────────────────────────────────────────────────────────

const playBeep = (freq: number, type: OscillatorType, duration: number, vol: number) => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, ctx.currentTime)
    gain.gain.setValueAtTime(vol, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + duration)
  } catch (e) {
    console.warn("Audio Context not supported or allowed", e)
  }
}


// ── ScoreBar ──────────────────────────────────────────────────────────────────

function ScoreBar({ score }: { score?: number }) {
  if (score === undefined) return null
  return (
    <div className="flex items-center gap-1 mt-0.5">
      <div className="w-14 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-violet-400 rounded-full transition-all duration-700"
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>
      <span className="text-[9px] font-bold text-violet-300 tabular-nums">{Math.round(score)}</span>
    </div>
  )
}

// ── Waveform ──────────────────────────────────────────────────────────────────

function Waveform({ size = "sm" }: { size?: "sm" | "md" }) {
  const h = size === "md" ? ["h-3", "h-5", "h-3"] : ["h-2", "h-3", "h-2"]
  return (
    <span className="flex items-end gap-px">
      {h.map((cls, i) => (
        <span
          key={i}
          className={`block w-[2px] ${cls} bg-violet-400 rounded-sm animate-bounce`}
          style={{ animationDuration: `${0.5 + i * 0.15}s`, animationDelay: `${i * 0.1}s` }}
        />
      ))}
    </span>
  )
}

// ── SpeakerCell ───────────────────────────────────────────────────────────────

function SpeakerCell({
  participant,
  isSpeaking,
  score,
  isSmall = false,
}: {
  participant: ParticipantInfo
  isSpeaking: boolean
  score?: number
  isSmall?: boolean
}) {
  const avatarSize = isSmall ? "w-11 h-11" : "w-[72px] h-[72px]"

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative">
        <div
          className={cn(
            `${avatarSize} rounded-full border-2 border-border overflow-hidden bg-muted transition-all duration-300`,
            isSpeaking && "ring-2 ring-violet-400 ring-offset-2 ring-offset-background",
          )}
        >
          <img
            src={participant.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${participant.id}`}
            className="w-full h-full object-cover"
            alt={participant.name}
          />
        </div>
        {!isSmall && (
          <>
            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-blue-500 border-2 border-background flex items-center justify-center">
              <Plus size={10} className="text-white" strokeWidth={3} />
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-muted border border-border flex items-center justify-center">
              {isSpeaking
                ? <Waveform size="sm" />
                : <MicOff size={9} className="text-muted-foreground/50" strokeWidth={1.5} />}
            </div>
          </>
        )}
      </div>
      {!isSmall && <ScoreBar score={score} />}
      <p className={cn(
        "text-foreground/90 text-center truncate font-semibold",
        isSmall ? "text-[10px] w-11" : "text-[11px] w-[72px]",
      )}>
        {participant.name}
      </p>
      {!isSmall && (
        <p className="text-[9px] text-violet-500 font-bold uppercase tracking-wide">
          {ROLE_LABEL[participant.role] || "Speaker"}
        </p>
      )}
    </div>
  )
}

// ── RoomDock ──────────────────────────────────────────────────────────────────

export function RoomDock() {
  const { activeRoomId, isExpanded, setExpanded } = useRoomStore()
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:4000/api/v1"

  const { authenticated } = useAuthStore()
  const { login } = usePrivy()

  const [stream, setStream] = useState<any>(null)
  const [streamLoading, setStreamLoading] = useState(true)
  const [participants, setParticipants] = useState<ParticipantInfo[]>([])
  const [chat, setChat] = useState<{ user: string; msg: string }[]>([])
  const [message, setMessage] = useState("")
  const [showChat, setShowChat] = useState(false)
  const [showTipModal, setShowTipModal] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [agentScores, setAgentScores] = useState<Record<string, number>>({})
  const [isRecording, setIsRecording] = useState(false)
  const [recordingUploading, setRecordingUploading] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const recordingStreamRef = useRef<MediaStream | null>(null)
  const recordingStartRef = useRef<Date | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const {
    jamInRoom,
    jamSpeakers: dockJamSpeakers,
    jamListeners: dockJamListeners,
    jamSpeaking: dockJamSpeaking,
    jamIsMuted,
    jamIsSoundMuted,
    jamIsLoading: jamLoading,
    jamToggleMute,
    jamToggleSoundMute,
    leaveRoom: contextLeaveRoom,
  } = useLiveRoom()

  // Reset on room change
  useEffect(() => {
    if (!activeRoomId) return
    setStreamLoading(true)
    setStream(null)
    setParticipants([])
    setChat([])
    setAgentScores({})
  }, [activeRoomId])

  // Live score updates
  useEffect(() => {
    if (!activeRoomId) return
    const unsub = wsService.onMessageSelected((data: any) => {
      if (data.roomId === activeRoomId) {
        setAgentScores((prev) => ({ ...prev, [data.agentId]: data.score }))
      }
    })
    return unsub
  }, [activeRoomId])

  // Unlock persistent audio element on first user interaction (satisfies autoplay policy)
  useEffect(() => {
    const unlock = () => {
      if (audioRef.current) {
        audioRef.current.play().then(() => audioRef.current?.pause()).catch(() => {})
      }
    }
    document.addEventListener("click", unlock, { once: true })
    document.addEventListener("touchstart", unlock, { once: true })
    return () => {
      document.removeEventListener("click", unlock)
      document.removeEventListener("touchstart", unlock)
    }
  }, [])

  // TTS Audio Playback — use persistent audio element + audioBase64 for autoplay compliance
  useEffect(() => {
    if (!activeRoomId) return
    const handleTtsAudio = (data: any) => {
      if (data.roomId !== activeRoomId) return
      if (!audioRef.current) return
      if (data.audioBase64) {
        try {
          const bytes = Uint8Array.from(atob(data.audioBase64), (c) => c.charCodeAt(0))
          const blob = new Blob([bytes.buffer], { type: "audio/mpeg" })
          const blobUrl = URL.createObjectURL(blob)
          audioRef.current.src = blobUrl
          audioRef.current.onended = () => URL.revokeObjectURL(blobUrl)
        } catch {
          if (data.audioUrl) audioRef.current.src = data.audioUrl
        }
      } else if (data.audioUrl) {
        audioRef.current.src = data.audioUrl
      } else {
        return
      }
      audioRef.current.muted = jamIsSoundMuted
      audioRef.current.play().catch((e) => console.warn("[RoomDock] Audio play blocked:", e))
    }
    wsService.on("tts:audio", handleTtsAudio)
    return () => wsService.off("tts:audio", handleTtsAudio)
  }, [activeRoomId, jamIsSoundMuted])

  // Fetch room
  useEffect(() => {
    if (!activeRoomId) return
    const token = apiClient.getToken()
    axios
      .get(`${apiUrl}/rooms/${activeRoomId}`, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined)
      .then((res) => {
        const room = res.data?.data?.room || res.data?.data || null
        if (room) {
          setStream({
            id: room.id,
            title: room.title || room.objective || "Audio Room",
            category: room.type || "debate",
            hostAgentName: room.hostAgent?.name || room.hostAgentName || "Host",
            hostAgentId: room.hostAgent?.id || room.hostAgentId || "",
            viewerCount: room.viewerCount ?? 0,
            recordingEnabled: room.recordingEnabled ?? true,
          })
        } else {
          setStream(null)
        }
      })
      .catch(() => setStream(null))
      .finally(() => setStreamLoading(false))
  }, [activeRoomId, apiUrl])

  // Fetch participants
  useEffect(() => {
    if (!activeRoomId || !stream) return
    const token = apiClient.getToken()
    axios
      .get(`${apiUrl}/rooms/${activeRoomId}/participants`, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined)
      .then((res) => setParticipants(res.data?.data?.participants || []))
      .catch(() => {})
  }, [activeRoomId, stream, apiUrl])

  // Safely coerce jam-core arrays — they may arrive as non-arrays before WebRTC init
  const safeSpeakers: string[] = Array.isArray(dockJamSpeakers) ? dockJamSpeakers : []
  const safeListeners: string[] = Array.isArray(dockJamListeners) ? dockJamListeners : []
  const safeSpeaking: string[] = Array.isArray(dockJamSpeaking) ? dockJamSpeaking : []

  // Sound Cues
  const prevListenersCount = useRef(0)
  useEffect(() => {
    if (safeListeners.length > prevListenersCount.current) {
      if (prevListenersCount.current > 0) playBeep(600, "sine", 0.1, 0.05) // Enter
    } else if (safeListeners.length < prevListenersCount.current) {
      if (prevListenersCount.current > 0) playBeep(400, "sine", 0.1, 0.05) // Exit
    }
    prevListenersCount.current = safeListeners.length
  }, [safeListeners.length])

  const stageParticipants = useMemo<ParticipantInfo[]>(() => {
    if (participants.length > 0) {
      const order: Record<string, number> = { host: 0, co_host: 1, moderator: 2, speaker: 3 }
      return [...participants]
        .filter((p) => p.role !== "spectator")
        .sort((a, b) => (order[a.role] ?? 99) - (order[b.role] ?? 99))
    }
    return safeSpeakers.map((id: string) => ({ id, name: id.slice(0, 8), avatar: null, role: "speaker" }))
  }, [participants, safeSpeakers])

  const listenerParticipants = useMemo<ParticipantInfo[]>(() => {
    const speakerIds = new Set(stageParticipants.map((p) => p.id))
    const apiListeners = participants.filter((p) => p.role === "spectator")
    if (apiListeners.length > 0) return apiListeners
    return safeListeners
      .filter((id: string) => !speakerIds.has(id))
      .map((id: string) => ({ id, name: id.slice(0, 6), avatar: null, role: "spectator" }))
  }, [participants, stageParticipants, safeListeners])

  // Recording
  const uploadRecording = useCallback(async (blob: Blob) => {
    const token = apiClient.getToken()
    if (!token) return
    setRecordingUploading(true)
    try {
      const form = new FormData()
      form.append("audio", blob, "recording.webm")
      if (recordingStartRef.current) form.append("startedAt", recordingStartRef.current.toISOString())
      form.append("endedAt", new Date().toISOString())
      await axios.post(`${apiUrl}/rooms/${activeRoomId}/recording`, form, { headers: { Authorization: `Bearer ${token}` } })
    } catch { /* best-effort */ } finally {
      setRecordingUploading(false)
    }
  }, [apiUrl, activeRoomId])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state !== "inactive") mediaRecorderRef.current?.stop()
    recordingStreamRef.current?.getTracks().forEach((t) => t.stop())
    recordingStreamRef.current = null
    setIsRecording(false)
  }, [])

  const startRecording = useCallback(async () => {
    if (!stream?.recordingEnabled || isRecording) return
    try {
      const captureStream = await navigator.mediaDevices.getDisplayMedia({ video: false, audio: true } as any)
      recordingStreamRef.current = captureStream
      chunksRef.current = []
      recordingStartRef.current = new Date()
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/ogg"
      const recorder = new MediaRecorder(captureStream, { mimeType })
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = () => uploadRecording(new Blob(chunksRef.current, { type: mimeType }))
      captureStream.getTracks().forEach((t) => { t.onended = () => stopRecording() })
      recorder.start(5000)
      mediaRecorderRef.current = recorder
      setIsRecording(true)
    } catch { /* user cancelled */ }
  }, [stream?.recordingEnabled, isRecording, uploadRecording, stopRecording])

  useEffect(() => {
    if (jamInRoom && stream?.recordingEnabled && !isRecording) startRecording()
  }, [jamInRoom, stream?.recordingEnabled, isRecording, startRecording])

  useEffect(() => () => stopRecording(), [stopRecording])

  const handleLeave = useCallback(() => {
    stopRecording()
    contextLeaveRoom()
  }, [stopRecording, contextLeaveRoom])

  const requireAuth = (fn: () => void) => {
    if (!authenticated) { login() } else { fn() }
  }

  const sendMsg = (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim()) return
    if (!authenticated) { login(); return }
    setChat((prev) => [...prev, { user: "You", msg: message.trim() }])
    setMessage("")
  }

  const totalListeners = safeListeners.length + (stream?.viewerCount || 0)

  if (!activeRoomId) return null

  // ── Collapsed bar ────────────────────────────────────────────────────────────
  if (!isExpanded) {
    return (
      <div
        className="fixed bottom-[60px] inset-x-0 z-40 h-16 flex items-center gap-3 px-4 border-t border-border cursor-pointer bg-background/95 backdrop-blur-md"
        onClick={() => setExpanded(true)}
      >
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
        <div className="flex-grow min-w-0">
          <p className="text-foreground font-semibold text-sm truncate">
            {streamLoading ? "Loading…" : (stream?.title || "Audio Room")}
          </p>
          {totalListeners > 0 && (
            <p className="text-muted-foreground text-[11px]">{totalListeners} listening</p>
          )}
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); if (jamInRoom) jamToggleMute() }}
          className={cn(
            "w-9 h-9 rounded-full border flex items-center justify-center shrink-0 transition-all",
            jamIsMuted || !jamInRoom
              ? "border-white/20 text-white/30"
              : "border-violet-500 bg-violet-600/30 text-violet-300",
          )}
        >
          {jamIsMuted || !jamInRoom ? <MicOff size={16} /> : <Mic size={16} />}
        </button>

        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); handleLeave() }}
          className="w-9 h-9 rounded-full border border-red-500/30 bg-red-500/10 text-red-400 flex items-center justify-center shrink-0"
        >
          <PhoneOff size={16} />
        </button>
      </div>
    )
  }

  // ── Expanded full sheet ───────────────────────────────────────────────────────
  return (
    <>
      {/* Hidden persistent audio element — reused for all TTS playback */}
      <audio ref={audioRef} preload="none" style={{ display: "none" }} />

      <div
        className="fixed inset-0 z-40 flex flex-col animate-in slide-in-from-bottom duration-300 bg-background text-foreground"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 shrink-0">
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Collapse"
          >
            <ChevronDown size={22} />
          </button>
          <div className="flex-grow min-w-0">
            <p className="text-muted-foreground text-[11px] uppercase font-bold tracking-widest truncate">
              {stream?.category || "Live"}
            </p>
            <p className="text-foreground font-bold text-base leading-tight truncate">
              {stream?.title || "Loading…"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className="p-2 text-white/40 hover:text-white/70 transition-colors"
            aria-label="Share"
          >
            <Share2 size={18} />
          </button>
          <button
            type="button"
            onClick={handleLeave}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-amber-400/40 bg-amber-400/10 text-amber-400 text-[12px] font-bold"
          >
            ✌️ leave
          </button>
        </div>

        {/* Scrollable stage */}
        <div className="flex-grow overflow-y-auto px-4 pb-4">
          {/* Live + listener count */}
          <div className="flex items-center gap-2 mb-5">
            <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-red-400">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              Live
            </span>
            {totalListeners > 0 && (
              <span className="text-white/30 text-[11px]">· {totalListeners} listening</span>
            )}
            {(isRecording || recordingUploading) && (
              <span className="ml-auto flex items-center gap-1.5 text-[10px] text-red-400 uppercase tracking-widest">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                {recordingUploading ? "Saving…" : "REC"}
              </span>
            )}
          </div>

          {/* On Stage */}
          <div className="mb-8">
            <p className="text-muted-foreground text-[11px] uppercase tracking-widest font-bold mb-4">
              On Stage
            </p>
            {jamLoading ? (
              <div className="flex items-center gap-3 py-8">
                <BeeSpinner size="sm" variant="primary" />
                <p className="text-xs text-muted-foreground uppercase tracking-widest">Connecting…</p>
              </div>
            ) : stageParticipants.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground/50">
                <Headphones size={36} />
                <p className="text-xs uppercase tracking-widest">No speakers yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-x-3 gap-y-7">
                {stageParticipants.map((p, idx) => (
                  <div key={p.id} className="flex justify-center">
                    <SpeakerCell
                      participant={p}
                      isSpeaking={
                        safeSpeaking.includes(p.id) ||
                        (safeSpeaking.length > 0 && idx < safeSpeaking.length)
                      }
                      score={agentScores[p.id]}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Listeners */}
          {listenerParticipants.length > 0 && (
            <div>
              <p className="text-white/30 text-[11px] uppercase tracking-widest font-bold mb-4">
                Listeners · {totalListeners}
              </p>
              <div className="grid grid-cols-5 gap-x-2 gap-y-4">
                {listenerParticipants.slice(0, 20).map((p) => (
                  <div key={p.id} className="flex justify-center">
                    <SpeakerCell participant={p} isSpeaking={false} isSmall />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Last chat preview */}
        {chat.length > 0 && (
          <div
            className="px-4 py-2 border-t border-white/5 cursor-pointer shrink-0"
            onClick={() => setShowChat(true)}
          >
            <p className="text-white/40 text-[12px] truncate">
              <span className="text-violet-400 font-semibold">{chat[chat.length - 1].user}: </span>
              {chat[chat.length - 1].msg}
            </p>
          </div>
        )}

        {/* Bottom action bar */}
        <div
          className="shrink-0 px-4 py-3 border-t border-border flex items-center gap-3 bg-muted/30"
        >
          {/* Speaker / audio-output mute pill */}
          <button
            type="button"
            onClick={jamInRoom ? jamToggleSoundMute : undefined}
            className={cn(
              "flex items-center gap-2 px-5 h-11 rounded-full border-2 font-bold text-sm transition-all duration-200",
              !jamInRoom
                ? "border-border text-muted-foreground cursor-default"
                : jamIsSoundMuted
                  ? "border-amber-500 bg-amber-500/15 text-amber-400 animate-pulse"
                  : "border-violet-500 bg-violet-600/20 text-violet-500",
            )}
            aria-label={jamIsSoundMuted ? "Unmute audio" : "Mute audio"}
          >
            {!jamInRoom || jamIsSoundMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            <span className="text-[13px]">
              {!jamInRoom ? "Connecting…" : jamIsSoundMuted ? "Tap to hear" : "Live"}
            </span>
          </button>

          <div className="flex-grow" />

          {/* Chat */}
          <button
            type="button"
            onClick={() => setShowChat(true)}
            className="relative w-11 h-11 rounded-full bg-muted border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Chat"
          >
            <MessageSquare size={20} />
            {chat.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-0.5">
                {chat.length > 9 ? "9+" : chat.length}
              </span>
            )}
          </button>

          {/* Tip */}
          <button
            type="button"
            onClick={() => requireAuth(() => setShowTipModal(true))}
            className="w-11 h-11 rounded-full bg-muted border border-border flex items-center justify-center text-muted-foreground hover:text-green-500 transition-colors"
            aria-label="Tip"
          >
            <DollarSign size={20} />
          </button>
        </div>
      </div>

      {/* Chat sheet */}
      {showChat && (
        <>
          <div className="fixed inset-0 z-[45] bg-black/40 backdrop-blur-sm" onClick={() => setShowChat(false)} />
          <div
            className="fixed inset-x-0 bottom-0 z-[46] flex flex-col h-[55vh] animate-in slide-in-from-bottom duration-300 rounded-t-2xl overflow-hidden border-t border-border bg-background/95 backdrop-blur-xl"
            role="dialog"
            aria-label="Live Chat"
          >
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1.5 rounded-full bg-muted-foreground/30" />
            </div>
            <div className="px-4 py-3 border-b border-border shrink-0 flex items-center justify-between">
              <span className="font-semibold text-sm text-foreground flex items-center gap-2">
                <MessageSquare size={15} className="text-muted-foreground" /> Live Chat
              </span>
              <button type="button" onClick={() => setShowChat(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <ChevronDown size={18} />
              </button>
            </div>
            <div className="flex-grow p-4 overflow-y-auto space-y-3 text-sm">
              {chat.length === 0 ? (
                <p className="text-center text-muted-foreground font-medium pt-8">Be the first to say something!</p>
              ) : chat.map((c, i) => (
                <div key={i} className="p-2.5 rounded-lg hover:bg-muted/50 transition-colors">
                  <span className={cn("font-semibold mr-2", c.user === "You" ? "text-violet-500" : "text-foreground")}>
                    {c.user}:
                  </span>
                  <span className="text-foreground/80 leading-snug">{c.msg}</span>
                </div>
              ))}
            </div>
            <div className="p-3 border-t border-border bg-muted/20 shrink-0">
              <form onSubmit={sendMsg} className="flex gap-2">
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={authenticated ? "Send a message…" : "Login to chat…"}
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
      )}

      {/* Share dialog */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share Room</DialogTitle>
            <DialogDescription>Spread the word.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <input
              value={`${window.location.origin}/room/${activeRoomId}/live`}
              readOnly
              className="flex-1 bg-muted/50 font-mono text-xs px-3 py-2 rounded border"
            />
            <Button
              size="icon"
              variant="secondary"
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/room/${activeRoomId}/live`)
                setShareOpen(false)
              }}
            >
              <Copy size={14} />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tip modal */}
      {stream && (
        <TipModal
          isOpen={showTipModal}
          onClose={() => setShowTipModal(false)}
          agentId={stream.hostAgentId}
          agentName={stream.hostAgentName}
        />
      )}
    </>
  )
}

export default RoomDock
