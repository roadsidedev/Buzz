import React, { useRef, useEffect, useState } from "react"
import Hls from "hls.js"

interface HlsPlayerProps {
  src: string
  poster?: string
  className?: string
  autoPlay?: boolean
  muted?: boolean
  onReconnect?: () => void
}

const HlsPlayer: React.FC<HlsPlayerProps> = ({
  src,
  poster,
  className = "",
  autoPlay = true,
  muted = true,
  onReconnect,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isReconnecting, setIsReconnecting] = useState(false)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onReconnectRef = useRef(onReconnect)
  onReconnectRef.current = onReconnect

  const MAX_RECONNECT_ATTEMPTS = 5
  const RECONNECT_DELAY_MS = 3000

  const attemptReconnectRef = useRef<() => void>(() => {})

  const initPlayer = () => {
    const video = videoRef.current
    if (!video || !src) return

    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }

    setError(null)

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        fragLoadingTimeOut: 20000,
        manifestLoadingTimeOut: 20000,
        levelLoadingTimeOut: 20000,
        maxBufferLength: 30,
        maxMaxBufferLength: 600,
        startLevel: -1,
      })

      hlsRef.current = hls

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {})
      })

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.error("[HlsPlayer] Network error:", data.details)
              setError("Stream unavailable")
              hls.startLoad()
              break
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.error("[HlsPlayer] Media error:", data.details)
              hls.recoverMediaError()
              break
            default:
              console.error("[HlsPlayer] Fatal error:", data.details)
              setError("Stream error")
              hls.destroy()
              attemptReconnectRef.current()
              break
          }
        }
      })

      hls.loadSource(src)
      hls.attachMedia(video)
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src
      video.addEventListener("error", () => {
        setError("Stream unavailable")
        attemptReconnectRef.current()
      })
    } else {
      setError("HLS not supported in this browser")
    }
  }

  attemptReconnectRef.current = () => {
    if (!src && !onReconnectRef.current) return

    setIsReconnecting(true)
    setError(null)

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }

    reconnectTimeoutRef.current = setTimeout(() => {
      setIsReconnecting(false)
      if (onReconnectRef.current) {
        onReconnectRef.current()
      } else {
        initPlayer()
      }
    }, RECONNECT_DELAY_MS)
  }

  useEffect(() => {
    initPlayer()

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
    }
  }, [])

  // Show static image fallback when stream is unavailable
  if (error && !isReconnecting) {
    return (
      <div className={`relative bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col items-center justify-center ${className}`}>
        {/* Static noise pattern overlay */}
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }} />
        
        {/* Center content */}
        <div className="relative z-10 flex flex-col items-center gap-4 px-6">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-white/80 font-semibold text-lg">Stream Offline</p>
            <p className="text-white/50 text-sm mt-1">{error}</p>
          </div>
          <button
            onClick={() => attemptReconnectRef.current()}
            className="mt-2 px-6 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-full transition-colors text-sm"
          >
            Reconnect
          </button>
        </div>
      </div>
    )
  }

  // Show reconnecting state
  if (isReconnecting) {
    return (
      <div className={`relative bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col items-center justify-center ${className}`}>
        {/* Animated pulse ring */}
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-2 border-violet-500/30 flex items-center justify-center">
              <div className="w-10 h-10 rounded-full border-2 border-violet-500/60 animate-ping" />
            </div>
            <div className="absolute inset-0 w-16 h-16 rounded-full border-2 border-violet-500/20 animate-pulse" />
          </div>
          <div className="text-center">
            <p className="text-white/80 font-semibold text-lg">Stream Reconnecting...</p>
            <p className="text-white/50 text-sm mt-1">Attempting to restore connection</p>
          </div>
          {/* Progress dots animation */}
          <div className="flex gap-2 mt-2">
            <div className="w-2 h-2 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: "0ms" }} />
            <div className="w-2 h-2 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: "150ms" }} />
            <div className="w-2 h-2 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <video
      ref={videoRef}
      className={className}
      poster={poster}
      autoPlay={autoPlay}
      muted={muted}
      playsInline
      loop
      controls={false}
    />
  )
}

export default HlsPlayer
