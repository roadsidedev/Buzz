import React, { useState, useEffect, useRef, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import {
  Heart, MessageSquare, Share2, DollarSign, Bookmark,
  Copy, ChevronDown, Mic, MicOff, Headphones, ArrowLeft,
  MoreHorizontal, UserPlus,
} from "lucide-react"
import axios from "axios"
import { Card, CardContent } from "@/components/ui/card"
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

// ── SpeakerTile ───────────────────────────────────────────────────────────────

function SpeakerTile({
  participant,
  isSpeaking,
}: {
  participant: ParticipantInfo
  isSpeaking: boolean
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      {/* Avatar with speaking ring */}
      <div
        className={cn(
          "relative w-[68px] h-[68px] rounded-full transition-all duration-300",
          isSpeaking &&
            "ring-2 ring-green-500 ring-offset-2 ring-offset-background shadow-lg shadow-green-500/20",
        )}
      >
        <img
          src={
            participant.avatar ||
            `https://api.dicebear.com/7.x/avataaars/svg?seed=${participant.id}`
          }
          className="w-full h-full rounded-full object-cover bg-muted"
          alt={participant.name}
        />
      </div>

      {/* Live waveform or muted-mic indicator */}
      <div className="h-5 flex items-center justify-center">
        {isSpeaking ? (
          <span className="flex items-end gap-px">
            <span
              className="block w-[3px] h-3 bg-green-500 rounded-sm animate-bounce"
              style={{ animationDuration: "0.6s" }}
            />
            <span
              className="block w-[3px] h-4 bg-green-500 rounded-sm animate-bounce"
              style={{ animationDuration: "0.5s", animationDelay: "0.15s" }}
            />
            <span
              className="block w-[3px] h-3 bg-green-500 rounded-sm animate-bounce"
              style={{ animationDuration: "0.7s", animationDelay: "0.3s" }}
            />
          </span>
        ) : (
          <MicOff size={11} className="text-muted-foreground/50" strokeWidth={1.5} />
        )}
      </div>

      {/* Name */}
      <p className="text-[11px] font-semibold text-foreground text-center leading-tight w-16 truncate">
        {participant.name}
      </p>

      {/* Role badge */}
      <p
        className={cn(
          "text-[10px] font-medium",
          participant.role === "host"
            ? "text-primary"
            : participant.role === "co_host"
              ? "text-violet-400"
              : "text-muted-foreground",
        )}
      >
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
  const { toggleLike, toggleSave, isLiked, isSaved } = useSocialStore()

  const [stream, setStream] = useState<any>(null)
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null)
  const [streamLoading, setStreamLoading] = useState(true)
  const [participants, setParticipants] = useState<ParticipantInfo[]>([])
  const [chat, setChat] = useState<
    { user: string; msg: string; isAgent: boolean; isPriority: boolean }[]
  >([])
  const [message, setMessage] = useState("")
  const [qnaCredits, setQnaCredits] = useState(0)
  const [usePriority, setUsePriority] = useState(false)
  const [shareWizardOpen, setShareWizardOpen] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [showTipModal, setShowTipModal] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingUploading, setRecordingUploading] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const recordingStreamRef = useRef<MediaStream | null>(null)
  const recordingStartRef = useRef<Date | null>(null)

  const jamRoom = useJamRoom({
    roomId: streamId,
    pantryUrl: import.meta.env.VITE_PANTRY_URL,
    autoJoin: !streamLoading && !!stream,
  })

  // ── Fetch room ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!streamId) {
      setStreamLoading(false)
      return
    }
    const token = apiClient.getToken()
    axios
      .get(
        `${apiUrl}/rooms/${streamId}`,
        token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
      )
      .then((res) => {
        const room = res.data?.data?.room || res.data?.data || null
        if (room) {
          setStream({
            id: room.id,
            title: room.title || room.objective || "Audio Room",
            description: room.objective || "",
            category: room.type || "podcast",
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

  // ── Fetch participants with roles ──────────────────────────────────────────
  useEffect(() => {
    if (!streamId || !stream) return
    const token = apiClient.getToken()
    axios
      .get(
        `${apiUrl}/rooms/${streamId}/participants`,
        token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
      )
      .then((res) => {
        const pts: ParticipantInfo[] = res.data?.data?.participants || []
        setParticipants(pts)
      })
      .catch(() => {})
  }, [streamId, stream, apiUrl])

  // ── Derive stage participants (host → co-host → moderator → speaker) ───────
  const stageParticipants = React.useMemo<ParticipantInfo[]>(() => {
    if (participants.length > 0) {
      const order: Record<string, number> = {
        host: 0,
        co_host: 1,
        moderator: 2,
        speaker: 3,
      }
      return [...participants]
        .filter((p) => p.role !== "spectator")
        .sort((a, b) => (order[a.role] ?? 99) - (order[b.role] ?? 99))
    }
    // Fall back to live Jam speaker list (no name/role info)
    return jamRoom.speakers.map((id: string) => ({
      id,
      name: id.slice(0, 8),
      avatar: null,
      role: "speaker",
    }))
  }, [participants, jamRoom.speakers])

  const requireAuth = (fn: () => void) => {
    if (!authenticated) {
      login()
    } else {
      fn()
    }
  }

  // ── Recording ──────────────────────────────────────────────────────────────
  const uploadRecording = useCallback(
    async (blob: Blob) => {
      const token = apiClient.getToken()
      if (!token) return
      setRecordingUploading(true)
      try {
        const form = new FormData()
        form.append("audio", blob, "recording.webm")
        if (recordingStartRef.current)
          form.append("startedAt", recordingStartRef.current.toISOString())
        form.append("endedAt", new Date().toISOString())
        await axios.post(`${apiUrl}/rooms/${streamId}/recording`, form, {
          headers: { Authorization: `Bearer ${token}` },
        })
      } catch {
        // best-effort
      } finally {
        setRecordingUploading(false)
      }
    },
    [apiUrl, streamId],
  )

  const stopRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop()
    }
    recordingStreamRef.current?.getTracks().forEach((t) => t.stop())
    recordingStreamRef.current = null
    setIsRecording(false)
  }, [])

  const startRecording = useCallback(async () => {
    if (!stream?.recordingEnabled || isRecording) return
    try {
      const captureStream = await navigator.mediaDevices.getDisplayMedia({
        video: false,
        audio: true,
      } as DisplayMediaStreamOptions)
      recordingStreamRef.current = captureStream
      chunksRef.current = []
      recordingStartRef.current = new Date()
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/ogg"
      const recorder = new MediaRecorder(captureStream, { mimeType })
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType })
        uploadRecording(blob)
      }
      captureStream.getTracks().forEach((track) => {
        track.onended = () => stopRecording()
      })
      recorder.start(5000)
      mediaRecorderRef.current = recorder
      setIsRecording(true)
    } catch {
      // User cancelled or permission denied
    }
  }, [stream?.recordingEnabled, isRecording, uploadRecording, stopRecording])

  useEffect(() => {
    if (jamRoom.inRoom && stream?.recordingEnabled && !isRecording) {
      startRecording()
    }
  }, [jamRoom.inRoom, stream?.recordingEnabled, isRecording, startRecording])

  useEffect(() => {
    return () => {
      stopRecording()
    }
  }, [stopRecording])

  const handleLeave = useCallback(() => {
    stopRecording()
    jamRoom.disconnect()
    navigate(-1)
  }, [stopRecording, jamRoom, navigate])

  // ── Chat ───────────────────────────────────────────────────────────────────
  const sendMsg = (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim()) return
    if (!authenticated) {
      login()
      return
    }
    if (usePriority && qnaCredits > 0) {
      setChat([
        ...chat,
        { user: "You", msg: message, isAgent: false, isPriority: true },
      ])
      setQnaCredits((prev) => prev - 1)
      setUsePriority(false)
    } else {
      setChat([
        ...chat,
        { user: "You", msg: message, isAgent: false, isPriority: false },
      ])
    }
    setMessage("")
  }

  const streamTitle = stream?.title || "Audio Room"

  // ── Loading ────────────────────────────────────────────────────────────────
  if (streamLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground font-medium text-sm">
            Loading room…
          </p>
        </div>
      </div>
    )
  }

  // ── Not found ──────────────────────────────────────────────────────────────
  if (!stream) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center flex flex-col items-center gap-4">
          <Headphones size={48} className="text-muted-foreground/40" />
          <p className="text-muted-foreground font-semibold">
            Room not found or has ended.
          </p>
          <Button variant="secondary" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Go Back
          </Button>
        </div>
      </div>
    )
  }

  // ── Replay UI (ended room with recording) ──────────────────────────────────
  const isReplay =
    stream?.status === "completed" || stream?.status === "failed"

  if (isReplay && stream?.recordingUrl) {
    return (
      <div className="animate-in fade-in duration-500 pb-24 max-w-2xl mx-auto px-4 pt-4">
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="text-muted-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <div className="flex items-center gap-2">
            <Headphones size={16} className="text-primary" />
            <span className="text-sm font-bold text-primary uppercase tracking-wider">
              Replay
            </span>
          </div>
          <Badge variant="secondary" className="text-xs uppercase tracking-wider">
            Ended
          </Badge>
        </div>

        <Card className="mb-6 border-2">
          <CardContent className="p-4 flex items-center gap-4">
            <img
              src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${stream.hostAgentId}`}
              alt={stream.hostAgentName}
              className="w-12 h-12 rounded-full border-2 border-primary/30 bg-muted shrink-0"
            />
            <div className="min-w-0">
              <p className="font-bold text-foreground truncate">
                {stream.hostAgentName}
              </p>
              <p className="text-sm text-muted-foreground line-clamp-2 leading-snug mt-0.5">
                {stream.title}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6 border-2">
          <CardContent className="p-6 flex flex-col items-center gap-4">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Recording
            </p>
            <audio
              ref={audioPlayerRef}
              src={stream.recordingUrl}
              controls
              className="w-full"
              style={{ colorScheme: "normal" }}
            />
            <p className="text-xs text-muted-foreground text-center">
              This space has ended. Listen to the full recording above.
            </p>
          </CardContent>
        </Card>

        <div className="fixed bottom-0 inset-x-0 bg-background/95 backdrop-blur-sm border-t px-4 py-3 flex items-center justify-between max-w-2xl mx-auto">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className={cn("rounded-full h-9 w-9", isLiked(streamId) && "text-red-500")}
              onClick={() => requireAuth(() => toggleLike(streamId, "room"))}
            >
              <Heart size={18} fill={isLiked(streamId) ? "currentColor" : "none"} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full h-9 w-9 text-green-600"
              onClick={() => requireAuth(() => setShowTipModal(true))}
            >
              <DollarSign size={18} />
            </Button>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className={cn("rounded-full h-9 w-9", isSaved(streamId) && "text-yellow-500")}
              onClick={() => requireAuth(() => toggleSave(streamId, "room"))}
            >
              <Bookmark size={18} fill={isSaved(streamId) ? "currentColor" : "none"} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full h-9 w-9"
              onClick={() => setShareWizardOpen(true)}
            >
              <Share2 size={18} />
            </Button>
          </div>
        </div>

        <Dialog open={shareWizardOpen} onOpenChange={setShareWizardOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader className="pb-4">
              <DialogTitle className="text-xl font-bold tracking-tight">
                Share Replay
              </DialogTitle>
              <DialogDescription>
                Share this recording with others.
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-2">
              <input
                value={`${window.location.origin}/room/${streamId}/live`}
                readOnly
                className="flex-1 bg-muted/50 font-mono text-xs px-3 py-2 rounded border"
              />
              <Button
                size="icon"
                variant="secondary"
                className="shrink-0 w-10"
                onClick={() => {
                  navigator.clipboard.writeText(
                    `${window.location.origin}/room/${streamId}/live`,
                  )
                  setShareWizardOpen(false)
                }}
              >
                <Copy size={14} />
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {stream && (
          <TipModal
            isOpen={showTipModal}
            onClose={() => setShowTipModal(false)}
            agentId={stream.hostAgentId}
            agentName={stream.hostAgentName}
          />
        )}
      </div>
    )
  }

  // Ended with no recording
  if (isReplay && !stream?.recordingUrl) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center flex flex-col items-center gap-4">
          <Headphones size={48} className="text-muted-foreground/40" />
          <p className="text-muted-foreground font-semibold">
            This space has ended.
          </p>
          <p className="text-sm text-muted-foreground">
            No recording was saved for this room.
          </p>
          <Button variant="secondary" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Go Back
          </Button>
        </div>
      </div>
    )
  }

  // ── LIVE ROOM UI ───────────────────────────────────────────────────────────
  return (
    <div className="animate-in fade-in duration-500 min-h-screen bg-background pb-24">

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-1 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Minimize"
        >
          <ChevronDown size={24} />
        </button>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShareWizardOpen(true)}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Share"
          >
            <Share2 size={19} />
          </button>
          <button
            type="button"
            className="p-2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="More options"
          >
            <MoreHorizontal size={19} />
          </button>
          <button
            type="button"
            onClick={handleLeave}
            className="ml-1 px-3 py-1.5 text-red-500 font-bold text-sm hover:text-red-400 transition-colors rounded-full border border-red-500/30 hover:border-red-400/50"
          >
            Leave
          </button>
        </div>
      </div>

      {/* ── REC indicator ── */}
      <div className="px-5 pb-1 min-h-[22px] flex items-center gap-3">
        {isRecording && (
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[11px] font-black text-red-500 uppercase tracking-widest">
              REC
            </span>
          </span>
        )}
        {recordingUploading && (
          <span className="text-[11px] text-muted-foreground uppercase tracking-widest">
            Saving…
          </span>
        )}
        {!isRecording && !recordingUploading && stream?.recordingEnabled && jamRoom.inRoom && (
          <button
            type="button"
            onClick={startRecording}
            className="text-[11px] text-muted-foreground/60 hover:text-muted-foreground uppercase tracking-widest transition-colors flex items-center gap-1.5"
          >
            <span className="w-1.5 h-1.5 rounded-full border border-current" />
            Start Rec
          </button>
        )}
      </div>

      {/* ── Room title + category ── */}
      <div className="px-5 py-2">
        <h1 className="text-[22px] font-bold text-foreground leading-snug mb-1.5">
          {streamTitle}
        </h1>
        <p className="text-sm text-muted-foreground capitalize">
          {stream.category}
        </p>
      </div>

      {/* ── Speaker stage ── */}
      <div className="px-5 mt-4">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-4">
          Speakers
        </p>

        {jamRoom.isLoading ? (
          <div className="flex flex-col items-center gap-2 py-8">
            <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            <p className="text-xs text-muted-foreground animate-pulse tracking-widest uppercase">
              Connecting…
            </p>
          </div>
        ) : stageParticipants.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground/40">
            <Headphones size={36} />
            <p className="text-xs uppercase tracking-widest">No speakers yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-x-2 gap-y-5">
            {stageParticipants.map((participant, index) => (
              <SpeakerTile
                key={participant.id}
                participant={participant}
                isSpeaking={
                  jamRoom.speaking.length > 0 &&
                  index < jamRoom.speaking.length
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Listeners section ── */}
      {jamRoom.inRoom && (
        <div className="px-5 mt-8">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
            {jamRoom.listeners.length > 0
              ? `${jamRoom.listeners.length} Listening`
              : "No listeners yet"}
          </p>
          {jamRoom.listeners.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {jamRoom.listeners.slice(0, 20).map((listenerId: string) => (
                <img
                  key={listenerId}
                  src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${listenerId}`}
                  className="w-9 h-9 rounded-full border border-border bg-muted"
                  alt="Listener"
                />
              ))}
              {jamRoom.listeners.length > 20 && (
                <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center border border-border">
                  <span className="text-[9px] text-muted-foreground font-semibold">
                    +{jamRoom.listeners.length - 20}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Fixed bottom action bar ── */}
      <div className="fixed bottom-0 inset-x-0 bg-background/95 backdrop-blur-sm border-t">
        <div className="max-w-2xl mx-auto px-6 py-3 flex items-center justify-between">

          {/* Mic / mute toggle */}
          <button
            type="button"
            onClick={jamRoom.inRoom ? jamRoom.toggleMute : undefined}
            className={cn(
              "w-14 h-14 rounded-full border-2 flex items-center justify-center transition-all duration-200",
              !jamRoom.inRoom
                ? "border-border text-muted-foreground/40 cursor-default"
                : jamRoom.isMuted
                  ? "border-border bg-muted/70 text-muted-foreground"
                  : "border-primary/60 bg-primary/10 text-primary shadow-sm",
            )}
            aria-label={jamRoom.isMuted ? "Unmute" : "Mute"}
          >
            {jamRoom.isMuted || !jamRoom.inRoom ? (
              <MicOff size={22} />
            ) : (
              <Mic size={22} />
            )}
          </button>

          {/* Invite */}
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => requireAuth(() => {})}
            aria-label="Invite speakers"
          >
            <UserPlus size={22} />
          </button>

          {/* Like */}
          <button
            type="button"
            className={cn(
              "transition-colors",
              isLiked(streamId) ? "text-red-500" : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => requireAuth(() => toggleLike(streamId, "room"))}
            aria-label="Like"
          >
            <Heart size={22} fill={isLiked(streamId) ? "currentColor" : "none"} />
          </button>

          {/* Save */}
          <button
            type="button"
            className={cn(
              "transition-colors",
              isSaved(streamId) ? "text-yellow-500" : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => requireAuth(() => toggleSave(streamId, "room"))}
            aria-label="Save"
          >
            <Bookmark size={22} fill={isSaved(streamId) ? "currentColor" : "none"} />
          </button>

          {/* Chat bubble */}
          <button
            type="button"
            className="relative"
            onClick={() => setShowChat(true)}
            aria-label="Open chat"
          >
            <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shadow-sm shadow-primary/30">
              <MessageSquare size={20} className="text-primary-foreground" />
            </div>
            {chat.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
                {chat.length > 9 ? "9+" : chat.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Chat bottom sheet ── */}
      {showChat && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
            onClick={() => setShowChat(false)}
            aria-hidden="true"
          />
          <div
            className="fixed inset-x-0 bottom-0 z-50 flex flex-col h-[65vh] animate-in slide-in-from-bottom duration-300 rounded-t-2xl overflow-hidden border-t bg-background/98 backdrop-blur-sm shadow-2xl"
            role="dialog"
            aria-label="Live Chat"
          >
            <div className="flex justify-center pt-3 pb-1 bg-muted shrink-0">
              <div className="w-10 h-1.5 rounded-full bg-border" />
            </div>
            <div className="px-4 py-3 border-b bg-muted/30 shrink-0">
              <h3 className="font-semibold tracking-tight text-sm flex justify-between items-center text-foreground">
                <span className="flex items-center gap-2">
                  <MessageSquare size={16} className="text-muted-foreground" />
                  Live Chat
                </span>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowChat(false)}
                >
                  <ChevronDown size={18} />
                </button>
              </h3>
            </div>
            <div className="flex-grow p-4 overflow-y-auto space-y-4 text-sm font-medium">
              {chat.length === 0 ? (
                <p className="text-center text-muted-foreground font-medium pt-8">
                  Be the first to say something!
                </p>
              ) : (
                chat.map((c, i) => (
                  <div
                    key={i}
                    className={cn(
                      "animate-in slide-in-from-bottom-2 duration-300 p-2.5 rounded-lg",
                      c.isPriority
                        ? "bg-primary/10 border-l-4 border-primary"
                        : "hover:bg-muted/50 transition-colors",
                    )}
                  >
                    <span
                      className={cn(
                        "font-semibold mr-2",
                        c.user === "You" ? "text-primary" : "text-foreground",
                      )}
                    >
                      {c.user}:
                    </span>
                    <span className="text-muted-foreground leading-snug">
                      {c.msg}
                    </span>
                  </div>
                ))
              )}
            </div>
            <div className="p-3 border-t bg-background shrink-0">
              {qnaCredits > 0 && (
                <div className="mb-3 flex items-center justify-between bg-primary/10 rounded-md px-3 py-2 border border-primary/20">
                  <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                    Priority Q's: {qnaCredits}
                  </span>
                  <label className="text-xs font-medium flex items-center cursor-pointer select-none text-foreground">
                    <input
                      type="checkbox"
                      checked={usePriority}
                      onChange={(e) => setUsePriority(e.target.checked)}
                      className="mr-2 rounded border-primary text-primary focus:ring-primary"
                    />
                    Use Priority
                  </label>
                </div>
              )}
              <form onSubmit={sendMsg} className="flex gap-2">
                <Input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={
                    authenticated ? "Send a message..." : "Login to chat..."
                  }
                  className="flex-grow"
                  autoFocus
                />
                <Button type="submit" size="icon" className="shrink-0 shadow-sm">
                  <MessageSquare size={16} />
                </Button>
              </form>
            </div>
          </div>
        </>
      )}

      {/* ── Share dialog ── */}
      <Dialog open={shareWizardOpen} onOpenChange={setShareWizardOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-xl font-bold tracking-tight">
              Share Room
            </DialogTitle>
            <DialogDescription>
              Spread the word across your networks.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input
              value={`${window.location.origin}/room/${streamId}/live`}
              readOnly
              className="bg-muted/50 font-mono text-xs"
            />
            <Button
              size="icon"
              variant="secondary"
              className="shrink-0 w-10"
              onClick={() => {
                navigator.clipboard.writeText(
                  `${window.location.origin}/room/${streamId}/live`,
                )
                setShareWizardOpen(false)
              }}
            >
              <Copy size={14} />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Tip Modal ── */}
      {stream && (
        <TipModal
          isOpen={showTipModal}
          onClose={() => setShowTipModal(false)}
          agentId={stream.hostAgentId}
          agentName={stream.hostAgentName}
        />
      )}
    </div>
  )
}

export default RoomLivePage
