import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react"
import { createJam } from "jam-core"
import { useRoomStore } from "@/stores/room-store"
import { useAuthStore } from "@/stores/auth-store"
import wsService from "@/services/websocket"

// ── Types ─────────────────────────────────────────────────────────────────────

interface LiveRoomContextValue {
  jamInRoom: boolean
  jamSpeakers: string[]
  jamListeners: string[]
  jamSpeaking: string[]
  jamIsMuted: boolean
  jamIsSoundMuted: boolean
  jamMyId: string | null
  jamIsLoading: boolean
  jamError: string | null

  jamConnect: () => Promise<void>
  jamDisconnect: () => void
  jamToggleMute: () => void
  jamToggleSoundMute: () => void

  currentRoomId: string | null
  enterRoom: (roomId: string) => void
  minimizeRoom: () => void
  leaveRoom: () => void
}

const LiveRoomContext = createContext<LiveRoomContextValue | null>(null)

// ── Provider ───────────────────────────────────────────────────────────────────

export function LiveRoomProvider({ children }: { children: ReactNode }) {
  const jamRef = useRef<ReturnType<typeof createJam> | null>(null)
  const [, setJamTick] = useState(0)
  const [jamIsLoading, setJamIsLoading] = useState(false)
  const [jamError, setJamError] = useState<string | null>(null)

  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null)
  const { agentId } = useAuthStore()

  // Initialize Jam once — NO cleanup (survives navigation)
  useEffect(() => {
    if (!jamRef.current) {
      const config = {
        jamConfig: {
          urls: {
            pantry: import.meta.env.VITE_PANTRY_URL || "http://localhost:3003/_/pantry",
            stun: import.meta.env.VITE_STUN_URL || "stun:localhost:3478",
            turn: import.meta.env.VITE_TURN_URL || "turn:localhost:3478",
          },
          sfu: import.meta.env.VITE_SFU_ENABLED === "true",
          development: import.meta.env.DEV,
        },
        debug: import.meta.env.DEV,
      }
      jamRef.current = createJam(config as any)
    }
  }, [])

  // Poll Jam state every 100ms
  useEffect(() => {
    const id = setInterval(() => setJamTick((t) => t + 1), 100)
    return () => clearInterval(id)
  }, [])

  const [jamState, jamApi] = jamRef.current || ([{}, {}] as any)

  const jamInRoom = jamState.inRoom || false
  const jamSpeakers = Array.isArray(jamState.speakers) ? jamState.speakers : []
  const jamListeners = Array.isArray(jamState.listeners) ? jamState.listeners : []
  const jamSpeaking = Array.isArray(jamState.speaking) ? jamState.speaking : []
  const jamIsMuted = jamState.micMuted || false
  const jamIsSoundMuted = jamState.soundMuted ?? false
  const jamMyId = jamState.myId || null

  const jamConnect = useCallback(async () => {
    if (!jamRef.current || !currentRoomId) return
    setJamIsLoading(true)
    setJamError(null)
    try {
      await (jamApi as any).setProps({ soundMuted: false })
      await (jamApi as any).enterRoom(currentRoomId)
    } catch (err) {
      setJamError(err instanceof Error ? err.message : "Failed to connect")
    } finally {
      setJamIsLoading(false)
    }
  }, [currentRoomId, jamApi])

  const jamDisconnect = useCallback(() => {
    if (jamRef.current) {
      ;(jamApi as any).leaveRoom()
    }
  }, [jamApi])

  const jamToggleMute = useCallback(() => {
    if (jamRef.current) {
      const next = !jamState.micMuted
      ;(jamApi as any).setProps({ micMuted: next })
    }
  }, [jamState.micMuted, jamApi])

  const jamToggleSoundMute = useCallback(() => {
    if (jamRef.current) {
      const next = !jamState.soundMuted
      ;(jamApi as any).setProps({ soundMuted: next })
    }
  }, [jamState.soundMuted, jamApi])

  const enterRoom = useCallback(
    (roomId: string) => {
      setCurrentRoomId(roomId)
      wsService.joinRoom(roomId, agentId || undefined, "spectator")
      if (jamRef.current) {
        setJamIsLoading(true)
        setJamError(null)
        ;(jamApi as any)
          .setProps({ soundMuted: false })
          .then(() => (jamApi as any).enterRoom(roomId))
          .catch((err: unknown) =>
            setJamError(err instanceof Error ? err.message : "Failed to connect"),
          )
          .finally(() => setJamIsLoading(false))
      }
    },
    [agentId, jamApi],
  )

  const minimizeRoom = useCallback(() => {
    if (!currentRoomId) return
    useRoomStore.getState().setRoom(currentRoomId)
  }, [currentRoomId])

  const leaveRoom = useCallback(() => {
    if (!currentRoomId) return
    if (jamRef.current) {
      ;(jamApi as any).leaveRoom()
    }
    wsService.leaveRoom(currentRoomId)
    useRoomStore.getState().clearRoom()
    setCurrentRoomId(null)
  }, [currentRoomId, jamApi])

  const value: LiveRoomContextValue = {
    jamInRoom,
    jamSpeakers,
    jamListeners,
    jamSpeaking,
    jamIsMuted,
    jamIsSoundMuted,
    jamMyId,
    jamIsLoading,
    jamError,
    jamConnect,
    jamDisconnect,
    jamToggleMute,
    jamToggleSoundMute,
    currentRoomId,
    enterRoom,
    minimizeRoom,
    leaveRoom,
  }

  return (
    <LiveRoomContext.Provider value={value}>
      {children}
    </LiveRoomContext.Provider>
  )
}

export function useLiveRoom(): LiveRoomContextValue {
  const ctx = useContext(LiveRoomContext)
  if (!ctx) {
    throw new Error("useLiveRoom must be used inside <LiveRoomProvider>")
  }
  return ctx
}
