import React, { useState, useEffect, useRef, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import {
  MessageSquare, Share2, DollarSign,
  Copy, ChevronDown, MicOff, Headphones, ArrowLeft, PhoneOff, Send, Users,
  Volume2, VolumeX,
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
import { useRoomHeartbeat } from "@/hooks/useRoomHeartbeat"
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
  moderator: "Moderator",
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
  compact = false,
  onProfileClick,
}: {
  participant: ParticipantInfo
  isSpeaking: boolean
  score?: number
  compact?: boolean
  onProfileClick?: () => void
}) {
  const sizeClass = compact ? "w-16 h-16" : "w-[84px] h-[84px]"
  const innerClass = compact ? "w-[56px] h-[56px]" : "w-[76px] h-[76px]"

  return (
    <div className="flex flex-col items-center gap-2 cursor-pointer" onClick={onProfileClick}>
      <div className={cn("relative rounded-full flex items-center justify-center transition-all duration-300", sizeClass, isSpeaking ? "bg-violet-500/20" : "")}>
        {/* Ring */}
        {isSpeaking && (
          <div className="absolute inset-0 rounded-full border-2 border-violet-400 animate-pulse" />
        )}
        
        {/* Avatar */}
        <div className={cn("rounded-full overflow-hidden border-2 bg-muted relative z-10", innerClass, isSpeaking ? "border-violet-400" : "border-background")}>
          <img
            src={participant.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${participant.id}`}
            className="w-full h-full object-cover"
            alt={participant.name}
          />
        </div>
        
        {/* Badges */}
        <div className="absolute -bottom-1 -right-1 z-20 w-6 h-6 rounded-full bg-violet-500 border-2 border-background flex items-center justify-center shadow-sm">
          {isSpeaking ? <Waveform size="sm" /> : <MicOff size={10} className="text-white" strokeWidth={2} />}
        </div>
      </div>
      <ScoreBar score={score} />
      <p className={cn("font-semibold text-foreground text-center leading-tight truncate", compact ? "text-[10px] w-14" : "text-[11px] w-16")}>
        {participant.name}
      </p>
      <p className={cn("text-[10px] font-medium uppercase tracking-wider", participant.role === "co_host" || participant.role === "host" ? "text-violet-500 font-bold" : "text-muted-foreground")}>
        {ROLE_LABEL[participant.role] || "Speaker"}
      </p>
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
  // Local sound-mute state — starts UNMUTED for radio rooms so listeners
  // hear audio immediately without needing a click to unlock.
  const [soundMuted, setSoundMuted] = useState(false)
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

  // ── Ensure WebSocket is connected as soon as the room page mounts ──────────
  // room-live-page does not use use-room/use-episode/use-websocket hooks, so
  // wsService.connect() would never be called without this.  Without it,
  // joinRoom() queues to pendingRooms but the flush never fires → no events.
  useEffect(() => {
    if (!wsService.isConnectedStatus()) {
      wsService.connect(apiClient.getToken() || undefined).catch((err) =>
        console.warn("[Room] WebSocket connect error:", err)
      )
    }
  }, [])

  const jamRoom = useJamRoom({
    roomId: streamId,
    pantryUrl: import.meta.env.VITE_PANTRY_URL,
    autoJoin: !streamLoading && !!stream,
  })

  // ── Keep room alive with periodic heartbeats (any authenticated viewer) ─────
  useRoomHeartbeat(streamId, !!stream && authenticated)

  // Sync the HTML5 audio element's muted state with local soundMuted state
  useEffect(() => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.muted = soundMuted
    }
  }, [soundMuted])

  // ── Initialize WebRTCAudioBridge when Jam room connects ─────────────────────
  useEffect(() => {
    if (jamRoom.inRoom && streamId && !audioBridgeRef.current) {
      const sfuUrl = import.meta.env.VITE_SFU_URL || 'http://localhost:30002';
      console.log('[AudioBridge] Initializing with SFU URL:', sfuUrl);
      import('@/services/webrtc-audio-bridge').then(({ WebRTCAudioBridge }) => {
        audioBridgeRef.current = new WebRTCAudioBridge({
          sfuUrl,
          roomId: streamId,
          agentId: 'tts-bridge',
        })
        audioBridgeRef.current.connect().then(() => {
          console.log('[AudioBridge] Connected to SFU successfully')
        }).catch((err: Error) => {
          console.error('[AudioBridge] Failed to connect to SFU:', err)
          // AudioBridge connection failure is non-fatal — HTML5 fallback still works
        })
      })
    }
    return () => {
      if (audioBridgeRef.current) {
        audioBridgeRef.current.disconnect?.()
        audioBridgeRef.current = null
      }
    }
  }, [jamRoom.inRoom, streamId])

  // ── Live score updates ───────────────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = wsService.onMessageSelected((data) => {
      if (data.roomId === streamId) {
        setAgentScores((prev) => ({ ...prev, [data.agentId]: data.score }))
      }
    })
    return unsubscribe
  }, [streamId])

  // ── TTS Audio Playback via WebRTCAudioBridge ─────────────────────────────────
  const audioBridgeRef = useRef<any>(null)

  useEffect(() => {
    const handleTtsAudio = async (data: any) => {
      if (data.roomId !== streamId) return

      console.log('[TTS] Received audio event:', { 
        provider: data.provider, 
        hasAudioBase64: !!data.audioBase64,
        hasAudioUrl: !!data.audioUrl,
        durationMs: data.durationMs 
      })

      if (data.audioBase64) {
        try {
          const binaryString = atob(data.audioBase64)
          const bytes = new Uint8Array(binaryString.length)
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i)
          }
          const audioBuffer = bytes.buffer

          // Primary path: inject via WebRTCAudioBridge so all SFU peers hear it
          if (audioBridgeRef.current?.isReady()) {
            console.log('[TTS] Injecting audio via WebRTCAudioBridge (SFU path)')
            await audioBridgeRef.current.streamAudio(audioBuffer, data.messageId)
            return
          }

          // Fallback: HTML5 Audio for local playback only
          console.log('[TTS] WebRTCAudioBridge not ready, using HTML5 Audio fallback')
          const blob = new Blob([audioBuffer], { type: 'audio/mpeg' })
          const blobUrl = URL.createObjectURL(blob)
          if (audioPlayerRef.current) {
            audioPlayerRef.current.src = blobUrl
            audioPlayerRef.current.onended = () => URL.revokeObjectURL(blobUrl)
            // On mobile browsers, play() must be triggered by user gesture.
            // The unlock handler (below) pre-warms the audio context.
            const playPromise = audioPlayerRef.current.play()
            if (playPromise) playPromise.catch(e => console.warn('[TTS] Audio play blocked:', e))
          }
        } catch (err) {
          console.error('[TTS] Failed to inject audio:', err)
          if (data.audioUrl && audioPlayerRef.current) {
            audioPlayerRef.current.src = data.audioUrl
            const playPromise = audioPlayerRef.current.play()
            if (playPromise) playPromise.catch(e => console.warn('[TTS] Audio play blocked:', e))
          }
        }
      } else if (data.audioUrl) {
        if (audioPlayerRef.current) {
          audioPlayerRef.current.src = data.audioUrl
          const playPromise = audioPlayerRef.current.play()
          if (playPromise) playPromise.catch(e => console.warn('[TTS] Audio play blocked:', e))
        }
      }
    }
    wsService.on('tts:audio', handleTtsAudio)
    return () => wsService.off('tts:audio', handleTtsAudio)
  }, [streamId])

  // ── Fallback: Play audio from turn:completed events (URL-only, no base64) ────
  useEffect(() => {
    const handleTurnCompleted = async (data: any) => {
      if (data.roomId !== streamId) return
      if (!data.audioUrl) return

      console.log('[TTS] Playing audio via turn:completed URL fallback')
      if (audioPlayerRef.current) {
        audioPlayerRef.current.src = data.audioUrl
        audioPlayerRef.current.play().catch(e =>
          console.warn('[TTS] Audio play blocked (needs user interaction):', e)
        )
      }
    }
    wsService.on('turn:completed', handleTurnCompleted)
    return () => wsService.off('turn:completed', handleTurnCompleted)
  }, [streamId])

  // ── Soundboard: Play sounds triggered by host (remote listeners) ───────────
  useEffect(() => {
    const handleRemoteSoundboardPlay = async (data: any) => {
      if (data.roomId !== streamId) return

      console.log('[Soundboard] Remote sound triggered:', data.soundId)

      // Use shared sound catalog — no duplicated URLs
      const { getSoundById } = await import('@/data/soundboard')
      const sound = getSoundById(data.soundId)
      if (!sound) {
        console.warn('[Soundboard] Unknown sound ID:', data.soundId)
        return
      }

      // Play on a separate Audio element so it doesn't interrupt TTS
      const soundAudio = new Audio(sound.url)
      soundAudio.volume = soundMuted ? 0 : 0.7
      soundAudio.onerror = () => console.error('[Soundboard] Failed to load sound:', data.soundId)
      soundAudio.play().catch(e => console.warn('[Soundboard] Play blocked:', e))
    }

    wsService.on('soundboard:play', handleRemoteSoundboardPlay)
    return () => wsService.off('soundboard:play', handleRemoteSoundboardPlay)
  }, [streamId, soundMuted])

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

  // ── Join socket room for live events (tts:audio, participant changes, status) ─
  useEffect(() => {
    if (!streamId || !stream) return
    wsService.joinRoom(streamId, undefined, "spectator")
    return () => wsService.leaveRoom(streamId)
  }, [streamId, stream])

  // ── Real-time participant lifecycle ─────────────────────────────────────────
  useEffect(() => {
    const unsubJoined = wsService.onParticipantJoined(async (data) => {
      if (data.roomId !== streamId) return

      // Fetch real user profile data if agentId is available
      let name = data.agentName || `Listener`
      let avatar: string | null = null

      if (data.agentId) {
        try {
          const token = apiClient.getToken()
          const res = await axios.get(`${apiUrl}/agents/${data.agentId}`, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined)
          const agent = res.data?.data?.agent || res.data?.data || null
          if (agent) {
            name = agent.name || agent.display_name || data.agentName || name
            avatar = agent.avatar || agent.avatar_url || null
          }
        } catch {
          // Use fallback name — profile fetch is non-critical
        }
      }

      setParticipants((prev) => {
        if (prev.some((p) => p.id === data.agentId)) return prev
        const spectatorCount = prev.filter((p) => p.role === "spectator").length
        return [...prev, {
          id: data.agentId,
          name: name || `Listener ${spectatorCount + 1}`,
          avatar,
          role: data.role
        }]
      })
      playBeep(600, "sine", 0.1, 0.05)
    })
    const unsubLeft = wsService.onParticipantLeft((data) => {
      if (data.roomId !== streamId) return
      setParticipants((prev) => prev.filter((p) => p.id !== data.agentId))
    })
    return () => { unsubJoined(); unsubLeft() }
  }, [streamId, apiUrl])

  // ── Real-time room status updates ───────────────────────────────────────────
  useEffect(() => {
    return wsService.onRoomStatusChanged((data) => {
      if (data.roomId !== streamId) return
      setStream((prev: any) => prev ? { ...prev, status: data.status } : prev)
    })
  }, [streamId])

  // ── WebSocket reconnection: refresh state after network drop ────────────────
  useEffect(() => {
    const refreshRoomState = async () => {
      if (!streamId) return
      try {
        const token = apiClient.getToken()
        const res = await axios.get(`${apiUrl}/rooms/${streamId}`, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined)
        const room = res.data?.data?.room || res.data?.data || null
        if (room) {
          setStream((prev: any) => prev ? { ...prev, status: room.status } : null)
        }
        // Re-fetch participants to catch up on missed join/leave events
        const partRes = await axios.get(`${apiUrl}/rooms/${streamId}/participants`, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined)
        setParticipants(partRes.data?.data?.participants || [])
      } catch { /* non-fatal */ }
    }

    return wsService.on("reconnected", refreshRoomState)
  }, [streamId, apiUrl])

  // ── Unlock audio context on first user interaction ──────────────────────────
  // Mobile browsers (especially iOS Safari) require a user gesture before any
  // audio can play. This unlocks both the HTML5 <audio> element AND the
  // AudioContext used by playBeep() and WebRTCAudioBridge.
  useEffect(() => {
    const unlock = () => {
      // Unlock HTML5 <audio> element
      if (audioPlayerRef.current) {
        audioPlayerRef.current.play().then(() => audioPlayerRef.current?.pause()).catch(() => {})
      }
      // Unlock AudioContext (used by playBeep and WebRTCAudioBridge on iOS Safari)
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
        const ctx = new AudioCtx()
        if (ctx.state === "suspended") {
          ctx.resume().catch(() => {})
        }
        ctx.close().catch(() => {})
      } catch { /* AudioContext not supported or already unlocked */ }
    }
    document.addEventListener("click", unlock, { once: true })
    document.addEventListener("touchstart", unlock, { once: true })
    document.addEventListener("touchend", unlock, { once: true })
    return () => {
      document.removeEventListener("click", unlock)
      document.removeEventListener("touchstart", unlock)
      document.removeEventListener("touchend", unlock)
    }
  }, [])

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chat.length])

  // ── Stage participants ──────────────────────────────────────────────────────
  // Safely coerce jam-core arrays — they may arrive as non-arrays before WebRTC init
  const safeSpeakers: string[] = Array.isArray(jamRoom.speakers) ? jamRoom.speakers : []
  const safeSpeaking: string[] = Array.isArray(jamRoom.speaking) ? jamRoom.speaking : []

  const stageParticipants = React.useMemo<ParticipantInfo[]>(() => {
    if (participants.length > 0) {
      const order: Record<string, number> = { host: 0, co_host: 1, moderator: 2, speaker: 3 }
      return [...participants]
        .filter((p) => p.role !== "spectator")
        .sort((a, b) => (order[a.role] ?? 99) - (order[b.role] ?? 99))
    }
    return safeSpeakers.map((id: string) => ({ id, name: id.slice(0, 8), avatar: null, role: "speaker" }))
  }, [participants, safeSpeakers])

  const host = stageParticipants.find((p) => p.role === "host") ?? stageParticipants[0] ?? null
  const supporters = stageParticipants.filter((p) => p !== host)

  // All listener tracking: merge WebSocket spectators with Jam-core listeners
  // Jam-core may expose listeners when SFU is enabled; WS spectators always tracked
  const listenerProfiles = React.useMemo(
    () => {
      const wsSpectators = participants.filter((p) => p.role === "spectator")
      // Jam-core listeners (from SFU/WebRTC peers) — deduplicate by ID
      const jamListeners: string[] = Array.isArray(jamRoom.listeners) ? jamRoom.listeners : []
      const wsIds = new Set(wsSpectators.map(p => p.id))
      const combined = [
        ...wsSpectators,
        ...jamListeners
          .filter(id => !wsIds.has(id))
          .map(id => ({ id, name: `Listener ${id.slice(0, 6)}`, avatar: null, role: "spectator" as const })),
      ]
      return combined
    },
    [participants, jamRoom.listeners]
  )

  // ── Sound Cues ──────────────────────────────────────────────────────────────
  const prevListenersCount = useRef(0)
  useEffect(() => {
    const count = listenerProfiles.length
    if (count > prevListenersCount.current) {
      if (prevListenersCount.current > 0) playBeep(600, "sine", 0.1, 0.05) // Enter
    } else if (count < prevListenersCount.current) {
      if (prevListenersCount.current > 0) playBeep(400, "sine", 0.1, 0.05) // Exit
    }
    prevListenersCount.current = count
  }, [listenerProfiles.length])

  const isHostSpeaking = host
    ? (safeSpeaking.includes(host.id) || (safeSpeaking.length > 0 && stageParticipants.indexOf(host) < safeSpeaking.length))
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

  // Mute/unmute the room audio output — always works regardless of Jam state.
  // Directly controls the HTML5 audio element and syncs Jam when connected.
  const handleSoundMuteToggle = useCallback(() => {
    setSoundMuted((prev) => {
      const next = !prev
      if (audioPlayerRef.current) {
        audioPlayerRef.current.muted = next
      }
      if (jamRoom.inRoom) {
        jamRoom.toggleSoundMute()
      }
      return next
    })
  }, [jamRoom.inRoom, jamRoom.toggleSoundMute])

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
          <BeeSpinner size="lg" />
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
  // listenerProfiles now includes both Jam WebRTC peers and WS spectators — use it as the live count.
  const totalListeners = listenerProfiles.length

  // ── DESKTOP: Three-column Clubhouse layout ──────────────────────────────────
  if (isDesktop) {
    return (
      <div
        className="animate-in fade-in duration-500 flex flex-col h-full min-h-screen bg-background text-foreground"
      >
        {/* Hidden persistent audio element — reused for all TTS playback to satisfy browser autoplay policy */}
        <audio ref={audioPlayerRef} preload="auto" autoPlay playsInline style={{ display: "none" }} />
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
              {stream.status === "live" && (
                <span className="flex items-center gap-1.5 bg-red-500/15 text-red-400 text-[11px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                  Live
                </span>
              )}
              {stream.status === "pending" && (
                <span className="flex items-center gap-1.5 bg-yellow-500/15 text-yellow-400 text-[11px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                  Starting…
                </span>
              )}
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

            {/* ── Unmute banner — shown when audio output is muted ── */}
            {soundMuted && (
              <button
                type="button"
                onClick={handleSoundMuteToggle}
                className="relative z-20 flex items-center gap-3 w-full max-w-xs mx-auto mb-6 px-5 py-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25 transition-all duration-200 group"
              >
                <VolumeX size={18} className="shrink-0" />
                <span className="text-sm font-bold">Tap to hear the room</span>
                <Volume2 size={16} className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            )}

            {jamRoom.isLoading ? (
              <div className="flex flex-col items-center gap-3 py-16">
                <BeeSpinner variant="primary" size="md" />
                <p className="text-xs text-white/40 animate-pulse tracking-widest uppercase">Connecting…</p>
              </div>
            ) : stageParticipants.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-white/20">
                <Headphones size={40} />
                <p className="text-xs uppercase tracking-widest">No speakers yet</p>
              </div>
            ) : (
              <div className="relative z-10 w-full max-w-4xl mx-auto mt-8 flex-grow">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8 justify-items-center">
                  {stageParticipants.map((p, idx) => (
                    <SpeakerTile
                      key={p.id}
                      participant={p}
                      isSpeaking={
                        safeSpeaking.includes(p.id) ||
                        (safeSpeaking.length > 0 && idx < safeSpeaking.length)
                      }
                      score={agentScores[p.id]}
                      onProfileClick={() => navigate(`/agent/${p.id}`)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ── Listeners Grid (Desktop) ── */}
            {listenerProfiles.length > 0 && (
              <div className="mt-12 w-full max-w-4xl">
                <div className="flex items-center justify-between mb-4 px-2">
                  <span className="font-black text-[11px] uppercase tracking-[0.2em] text-muted-foreground/60">Listeners</span>
                  <span className="text-[10px] font-bold text-muted-foreground/40">{listenerProfiles.length}</span>
                </div>
                <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-x-6 gap-y-4 px-2">
                  {listenerProfiles.map((p) => (
                    <div
                      key={p.id}
                      className="flex flex-col items-center gap-2 group cursor-pointer"
                      onClick={() => navigate(`/agent/${p.id}`)}
                    >
                      <div className="relative">
                        <div className="w-14 h-14 rounded-[22px] overflow-hidden bg-muted border border-border/50 group-hover:border-primary/30 transition-all duration-300">
                          <img
                            src={p.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.id}`}
                            className="w-full h-full object-cover"
                            alt={p.name}
                          />
                        </div>
                      </div>
                      <span className="text-[10px] font-medium text-foreground/50 truncate w-14 text-center group-hover:text-foreground/80 transition-colors">
                        {p.name.split(' ')[0]}
                      </span>
                    </div>
                  ))}
                </div>
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

              {/* Speaker / audio-output mute — primary CTA for listeners */}
              <button
                type="button"
                onClick={handleSoundMuteToggle}
                className={cn(
                  "w-16 h-16 rounded-full border-2 flex items-center justify-center transition-all duration-200 shadow-lg",
                  soundMuted
                    ? "border-amber-500 bg-amber-500/20 text-amber-600 dark:text-amber-400 shadow-amber-500/20 animate-pulse"
                    : "border-violet-500 bg-violet-600 text-white shadow-violet-500/40",
                )}
                aria-label={soundMuted ? "Unmute audio" : "Mute audio"}
                title={soundMuted ? "Tap to hear the room" : "Mute room audio"}
              >
                {soundMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
              </button>

              <button
                type="button"
                onClick={() => requireAuth(() => setShowTipModal(true))}
                className="flex items-center gap-1.5 text-muted-foreground hover:text-green-600 dark:hover:text-green-400 transition-colors bg-muted hover:bg-green-500/10 px-4 py-2 rounded-full"
                aria-label="Tip"
              >
                <DollarSign size={16} />
                <span className="text-xs font-bold uppercase tracking-wide">Tip</span>
              </button>

              {!isRecording && !recordingUploading && stream?.recordingEnabled && jamRoom.inRoom && (
                <button
                  type="button"
                  onClick={startRecording}
                  className="flex items-center gap-1.5 text-muted-foreground/50 hover:text-foreground/70 transition-colors bg-muted hover:bg-muted/80 px-4 py-2 rounded-full"
                >
                  <span className="w-1.5 h-1.5 rounded-full border border-current" />
                  <span className="text-xs uppercase tracking-widest">Start Rec</span>
                </button>
              )}
              {recordingUploading && (
                <span className="text-[11px] text-muted-foreground/60 uppercase tracking-widest">Saving…</span>
              )}
            </div>
          </div>

          {/* ── MIDDLE: Listeners ── */}
          <div className="w-[200px] shrink-0 border-l border-border flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-border shrink-0 flex items-center justify-between">
              <span className="font-black text-[11px] uppercase tracking-widest text-muted-foreground">Listeners</span>
              <span className="text-[10px] font-bold text-muted-foreground/60">{totalListeners}</span>
            </div>
            <div className="flex-grow overflow-y-auto p-3 space-y-2 scrollbar-hide">
              {listenerProfiles.length === 0 && (
                <p className="text-[11px] text-muted-foreground/60 text-center mt-6">No listeners yet</p>
              )}
              {listenerProfiles.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 cursor-pointer hover:bg-muted/30 rounded-lg p-1 -m-1 transition-colors"
                  onClick={() => navigate(`/agent/${p.id}`)}
                >
                  <img
                    src={p.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.id}`}
                    className="w-7 h-7 rounded-full border border-border bg-muted"
                    alt="Listener"
                  />
                  <span className="text-xs text-foreground/60 font-medium truncate">{p.name.split(' ')[0]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── RIGHT: Persistent Chat ── */}
          <div
            className="w-[280px] shrink-0 border-l border-border flex flex-col overflow-hidden bg-card"
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-border flex items-center gap-2 shrink-0">
              <MessageSquare size={16} className="text-muted-foreground" />
              <span className="font-semibold text-sm text-foreground/80 tracking-wide uppercase">Live Chat</span>
            </div>

            {/* Messages */}
            <div className="flex-grow overflow-y-auto p-5 space-y-4">
              {chat.length === 0 ? (
                <p className="text-center text-muted-foreground text-xs mt-10">Be the first to say something!</p>
              ) : (
                chat.map((c, i) => (
                  <div key={i} className="text-[13px] leading-relaxed">
                    <span className={cn("font-bold mr-2", c.user === "You" ? "text-violet-500" : "text-foreground/70")}>
                      {c.user}:
                    </span>
                    <span className="text-foreground/80">{c.msg}</span>
                  </div>
                ))
              )}
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

  // ── MOBILE LAYOUT ─────────────────────────────────────────────────────────────
  return (
    <div
      className="animate-in fade-in duration-500 min-h-screen pb-36 bg-background text-foreground"
    >
      {/* Hidden persistent audio element — shared TTS player */}
      <audio ref={audioPlayerRef} preload="auto" autoPlay playsInline style={{ display: "none" }} />
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
          {stream.status === "live" && (
            <span className="flex items-center gap-1.5 bg-red-500/15 text-red-400 text-[11px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              Live
            </span>
          )}
          {stream.status === "pending" && (
            <span className="flex items-center gap-1.5 bg-yellow-500/15 text-yellow-400 text-[11px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
              Starting…
            </span>
          )}
          {totalListeners > 0 && (
            <span className="text-sm font-bold text-white/50">
              {totalListeners.toLocaleString()}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button type="button" onClick={handleLeave} className="p-2 text-xl leading-none" aria-label="Leave room">
            ✌🏿
          </button>
          <button type="button" onClick={() => setShareWizardOpen(true)} className="p-2 text-white/50 hover:text-white/80 transition-colors" aria-label="Share">
            <Share2 size={18} />
          </button>
        </div>
      </div>

      {/* ── Room title + category ── */}
      <div className="px-5 pb-2">
        <h1 className="text-xl font-bold text-foreground leading-snug mb-2 line-clamp-2">{streamTitle}</h1>
        <Badge variant="secondary" className="capitalize text-xs font-semibold">
          {stream.category}
        </Badge>
      </div>

      {/* ── Unmute banner (mobile) ── */}
      {soundMuted && (
        <button
          type="button"
          onClick={handleSoundMuteToggle}
          className="mx-5 mb-4 flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-300 hover:bg-amber-500/25 transition-all duration-200"
        >
          <VolumeX size={16} className="shrink-0" />
          <span className="text-sm font-bold">Tap to hear the room</span>
          <Volume2 size={14} className="ml-auto opacity-60" />
        </button>
      )}

      {/* ── Stage ── */}
      <div className="relative px-5 pt-8 pb-6">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(108,92,231,0.22) 0%, transparent 65%)" }}
        />

        {jamRoom.isLoading ? (
          <div className="flex flex-col items-center gap-3 py-10">
            <BeeSpinner variant="primary" size="md" />
            <p className="text-xs text-muted-foreground/60 animate-pulse tracking-widest uppercase">Connecting…</p>
          </div>
        ) : stageParticipants.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground/40">
            <Headphones size={40} />
            <p className="text-xs uppercase tracking-widest">No speakers yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-6 justify-items-center">
            {stageParticipants.map((p, idx) => (
              <SpeakerTile
                key={p.id}
                participant={p}
                isSpeaking={safeSpeaking.includes(p.id) || (safeSpeaking.length > 0 && idx < safeSpeaking.length)}
                score={agentScores[p.id]}
                onProfileClick={() => navigate(`/agent/${p.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Listeners (Mobile) ── */}
      <div className="px-5 pt-2 pb-6">
        <div className="flex items-center justify-between mb-4">
          <span className="font-black text-[11px] uppercase tracking-widest text-muted-foreground/50">Listeners</span>
          <span className="text-[10px] font-bold text-muted-foreground/40">{listenerProfiles.length}</span>
        </div>
        
        {listenerProfiles.length === 0 ? (
          <p className="text-[11px] text-muted-foreground/50 text-center mt-6 mb-4">No listeners yet</p>
        ) : (
          <div className="grid grid-cols-4 gap-3 pb-4">
            {listenerProfiles.map((p) => (
              <div
                key={p.id}
                className="flex flex-col items-center gap-1.5 w-[60px] cursor-pointer"
                onClick={() => navigate(`/agent/${p.id}`)}
              >
                <img
                  src={p.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.id}`}
                  className="w-12 h-12 rounded-full border border-border bg-muted shadow-sm"
                  alt={p.name}
                />
                <span className="text-[10px] text-foreground/70 font-medium truncate w-full text-center">
                  {p.name.split(' ')[0]}
                </span>
              </div>
            ))}
          </div>
        )}
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
          <span className="text-[11px] text-muted-foreground/60 uppercase tracking-widest">Saving…</span>
        )}
        {!isRecording && !recordingUploading && stream?.recordingEnabled && jamRoom.inRoom && (
          <button
            type="button"
            onClick={startRecording}
            className="text-[11px] text-muted-foreground/50 hover:text-foreground/70 uppercase tracking-widest transition-colors flex items-center gap-1.5"
          >
            <span className="w-1.5 h-1.5 rounded-full border border-current" />
            Start Rec
          </button>
        )}
      </div>

      {/* ── Fixed bottom action bar ── */}
      <div className="fixed bottom-0 inset-x-0 backdrop-blur-sm border-t border-border z-[60] bg-background/95" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <button type="button" onClick={handleLeave} className="flex flex-col items-center gap-0.5 text-red-400 hover:text-red-300 transition-colors" aria-label="Leave">
            <PhoneOff size={20} />
            <span className="text-[9px] font-bold uppercase tracking-wide">Leave</span>
          </button>
          {/* Speaker mute — primary CTA on mobile */}
          <button
            type="button"
            onClick={handleSoundMuteToggle}
            className={cn(
              "w-14 h-14 rounded-full border-2 flex items-center justify-center transition-all duration-200 shadow-lg",
              soundMuted
                ? "border-amber-500 bg-amber-500/20 text-amber-600 dark:text-amber-400 shadow-amber-500/20 animate-pulse"
                : "border-violet-500 bg-violet-600 text-white shadow-violet-500/40",
            )}
            aria-label={soundMuted ? "Unmute audio" : "Mute audio"}
          >
            {soundMuted ? <VolumeX size={22} /> : <Volume2 size={22} />}
          </button>
          <button type="button" onClick={() => setShowChat(true)} className="relative flex flex-col items-center gap-0.5 text-muted-foreground hover:text-foreground/80 transition-colors" aria-label="Chat">
            <MessageSquare size={22} />
            <span className="text-[9px] font-bold uppercase tracking-wide">Chat</span>
            {chat.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[15px] h-[15px] flex items-center justify-center px-0.5">
                {chat.length > 9 ? "9+" : chat.length}
              </span>
            )}
          </button>
          <button type="button" onClick={() => requireAuth(() => setShowTipModal(true))} className="flex flex-col items-center gap-0.5 text-muted-foreground hover:text-green-600 dark:hover:text-green-400 transition-colors" aria-label="Tip">
            <DollarSign size={22} />
            <span className="text-[9px] font-bold uppercase tracking-wide">Tip</span>
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
