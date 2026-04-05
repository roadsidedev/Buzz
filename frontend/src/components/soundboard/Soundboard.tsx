/**
 * Soundboard Component
 *
 * A panel of sound clips that room hosts can trigger during live sessions.
 * Categories: Lofi, Classic Jams, Sound Effects.
 * Sounds play through the HTML5 Audio API and are broadcast to all listeners
 * via the same audio pipeline as TTS.
 */

import React, { useState, useRef, useCallback, useEffect } from "react"
import { SOUND_CATEGORIES, SOUNDBOARD_CLIPS, type SoundClip } from "@/data/soundboard"
import { cn } from "@/lib/utils"
import { X, Volume2, Loader2 } from "lucide-react"

interface SoundboardProps {
  isOpen: boolean
  onClose: () => void
  onSoundPlay?: (sound: SoundClip) => void
}

export function Soundboard({ isOpen, onClose, onSoundPlay }: SoundboardProps) {
  const [activeCategory, setActiveCategory] = useState<string>("lofi")
  const [playingId, setPlayingId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  // Cache Audio instances to avoid repeated network requests
  const audioCacheRef = useRef<Map<string, HTMLAudioElement>>(new Map())

  const sounds = SOUNDBOARD_CLIPS.filter((s) => s.category === activeCategory)

  const playSound = useCallback(
    (sound: SoundClip) => {
      // Stop any currently playing sound
      if (audioRef.current) {
        audioRef.current.onended = null // Prevent stale callback (#11)
        audioRef.current.pause()
        audioRef.current.currentTime = 0
      }

      // Get cached Audio or create new one (#12)
      let audio = audioCacheRef.current.get(sound.id)
      if (!audio) {
        audio = new Audio(sound.url)
        audio.preload = "auto"
        audio.onerror = () => console.error("[Soundboard] Failed to load sound:", sound.id)
        audioCacheRef.current.set(sound.id, audio)
      } else {
        audio.currentTime = 0
      }

      audioRef.current = audio
      setPlayingId(sound.id)

      audio.onended = () => {
        setPlayingId(null)
        // Don't null audioRef here — it might still be the current ref
        // Only null it if it's still the same instance
        if (audioRef.current === audio) {
          audioRef.current = null
        }
      }

      audio.play().catch((e) => console.warn("[Soundboard] Play blocked:", e))
      onSoundPlay?.(sound)
    },
    [onSoundPlay]
  )

  const stopAll = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.onended = null // Prevent stale callback (#11)
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current = null
    }
    setPlayingId(null)
  }, [])

  // Cleanup: stop audio on unmount (#6)
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.onended = null
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  if (!isOpen) return null

  const playingSound = playingId ? SOUNDBOARD_CLIPS.find((s) => s.id === playingId) : null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Volume2 size={18} className="text-violet-400" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">Soundboard</h2>
          </div>
          <div className="flex items-center gap-2">
            {playingId && playingSound && (
              <button
                onClick={stopAll}
                className="text-[10px] font-bold uppercase tracking-wider text-red-400 hover:text-red-300 px-2 py-1 rounded-full bg-red-500/10 hover:bg-red-500/20 transition-colors"
                aria-label={`Stop playing ${playingSound.name}`}
              >
                Stop: {playingSound.name}
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-muted transition-colors text-muted-foreground"
              aria-label="Close soundboard"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-1 px-4 pt-3 border-b border-border/50">
          {SOUND_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold uppercase tracking-wider rounded-t-lg transition-all",
                activeCategory === cat.id
                  ? "bg-violet-500/15 text-violet-400 border-b-2 border-violet-400"
                  : "text-muted-foreground/60 hover:text-foreground/80 hover:bg-muted/50"
              )}
              aria-label={`Show ${cat.label} sounds`}
            >
              <span>{cat.emoji}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Sound Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {sounds.map((sound) => {
              const isPlaying = playingId === sound.id
              return (
                <button
                  key={sound.id}
                  onClick={() => (isPlaying ? stopAll() : playSound(sound))}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-xl border transition-all duration-200",
                    isPlaying
                      ? "bg-violet-500/20 border-violet-400/50 shadow-lg shadow-violet-500/10 scale-[1.02]"
                      : "bg-muted/30 border-border/50 hover:bg-muted/60 hover:border-border"
                  )}
                  aria-label={`Play ${sound.name} sound`}
                  aria-pressed={isPlaying}
                >
                  <span className="text-2xl">{sound.emoji}</span>
                  <span className="text-[11px] font-semibold text-foreground/80 text-center leading-tight">
                    {sound.name}
                  </span>
                  <span className="text-[9px] text-muted-foreground/50 font-mono">
                    {isPlaying ? (
                      <span className="flex items-center gap-1 text-violet-400">
                        <Loader2 size={10} className="animate-spin" /> Playing
                      </span>
                    ) : (
                      `${sound.duration}s`
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border/50 text-center">
          <p className="text-[10px] text-muted-foreground/40">
            Sounds play for all room listeners • Tap a sound to play • Tap again to stop
          </p>
        </div>
      </div>
    </div>
  )
}
