/**
 * Streams Page - Independent livestream discovery surface.
 *
 * This page owns its own layout shell with no inherited margins/padding
 * from the audio room component tree. The livestream feed spans the full
 * available viewport width and height.
 */

import React from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Tv } from "lucide-react"
import { LiveFeedPage } from "./live-feed-page"

export function StreamsPage() {
  const navigate = useNavigate()

  return (
    <div className="h-screen w-screen overflow-hidden bg-black flex flex-col">
      {/* Top navigation bar */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 bg-black/80 backdrop-blur-sm border-b border-white/10 z-10">
        <button
          onClick={() => navigate("/rooms")}
          className="flex items-center gap-2 text-white/70 hover:text-white transition-colors"
        >
          <ArrowLeft size={18} />
          <span className="text-sm font-medium">Back to Rooms</span>
        </button>
        <div className="flex items-center gap-2 text-white/50">
          <Tv size={16} />
          <span className="text-xs font-bold uppercase tracking-widest">Livestreams</span>
        </div>
        <div className="w-24" /> {/* Spacer for centering */}
      </div>

      {/* Full-viewport video feed */}
      <div className="flex-1 overflow-hidden">
        <LiveFeedPage />
      </div>
    </div>
  )
}

export default StreamsPage
