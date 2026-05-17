import React, { useRef, useEffect } from "react"
import Hls from "hls.js"

interface HlsPlayerProps {
  src: string
  poster?: string
  className?: string
  autoPlay?: boolean
  muted?: boolean
}

const HlsPlayer: React.FC<HlsPlayerProps> = ({
  src,
  poster,
  className = "",
  autoPlay = true,
  muted = true,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video || !src) return

    let hls: Hls | null = null

    if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        fragLoadingTimeOut: 20000,
        manifestLoadingTimeOut: 20000,
        levelLoadingTimeOut: 20000,
      })
      hls.loadSource(src)
      hls.attachMedia(video)
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Native HLS support (Safari)
      video.src = src
    }

    return () => {
      if (hls) {
        hls.destroy()
      }
    }
  }, [src])

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
