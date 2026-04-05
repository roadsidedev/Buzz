/**
 * Soundboard Data
 *
 * Curated sound clips for live room hosts to use as audio fillers.
 * Categories: lofi, classic jams, sound effects.
 *
 * Each sound has:
 * - id: unique identifier
 * - name: display name
 * - category: lofi | classic | sfx
 * - url: public URL to the audio file (MP3)
 * - duration: approximate duration in seconds
 * - emoji: visual indicator
 */

export interface SoundClip {
  id: string
  name: string
  category: "lofi" | "classic" | "sfx"
  url: string
  duration: number
  emoji: string
}

export const SOUND_CATEGORIES = [
  { id: "lofi", label: "Lofi", emoji: "🎵" },
  { id: "classic", label: "Classic Jams", emoji: "🎶" },
  { id: "sfx", label: "Sound FX", emoji: "🔊" },
] as const

export const SOUNDBOARD_CLIPS: SoundClip[] = [
  // ── Lofi Beats ──────────────────────────────────────────────────────────
  {
    id: "lofi-chill-1",
    name: "Chill Lofi",
    category: "lofi",
    url: "https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3",
    duration: 60,
    emoji: "☕",
  },
  {
    id: "lofi-rain-1",
    name: "Rainy Lofi",
    category: "lofi",
    url: "https://cdn.pixabay.com/audio/2022/03/24/audio_078e0b0763.mp3",
    duration: 45,
    emoji: "🌧️",
  },
  {
    id: "lofi-night-1",
    name: "Night Drive",
    category: "lofi",
    url: "https://cdn.pixabay.com/audio/2022/01/18/audio_d0a13f69d2.mp3",
    duration: 50,
    emoji: "🌙",
  },
  {
    id: "lofi-study-1",
    name: "Study Session",
    category: "lofi",
    url: "https://cdn.pixabay.com/audio/2022/04/27/audio_67bcf729cf.mp3",
    duration: 55,
    emoji: "📚",
  },

  // ── Classic Jams ────────────────────────────────────────────────────────
  {
    id: "classic-funk-1",
    name: "Funky Groove",
    category: "classic",
    url: "https://cdn.pixabay.com/audio/2022/03/15/audio_c9d6b5e6f1.mp3",
    duration: 30,
    emoji: "🕺",
  },
  {
    id: "classic-jazz-1",
    name: "Jazz Lounge",
    category: "classic",
    url: "https://cdn.pixabay.com/audio/2022/01/21/audio_31b4b3c8b0.mp3",
    duration: 40,
    emoji: "🎷",
  },
  {
    id: "classic-soul-1",
    name: "Soul Vibe",
    category: "classic",
    url: "https://cdn.pixabay.com/audio/2022/11/22/audio_febc508520.mp3",
    duration: 35,
    emoji: "✨",
  },
  {
    id: "classic-disco-1",
    name: "Disco Fever",
    category: "classic",
    url: "https://cdn.pixabay.com/audio/2022/10/25/audio_9326f18c68.mp3",
    duration: 25,
    emoji: "🪩",
  },

  // ── Sound Effects ───────────────────────────────────────────────────────
  {
    id: "sfx-clap-1",
    name: "Applause",
    category: "sfx",
    url: "https://cdn.pixabay.com/audio/2022/03/15/audio_c79f28e2d0.mp3",
    duration: 5,
    emoji: "👏",
  },
  {
    id: "sfx-boo-1",
    name: "Boo!",
    category: "sfx",
    url: "https://cdn.pixabay.com/audio/2022/03/19/audio_31543f3d44.mp3",
    duration: 3,
    emoji: "👎",
  },
  {
    id: "sfx-laugh-1",
    name: "Laughter",
    category: "sfx",
    url: "https://cdn.pixabay.com/audio/2022/03/15/audio_52995c6e2a.mp3",
    duration: 4,
    emoji: "😂",
  },
  {
    id: "sfx-drumroll-1",
    name: "Drum Roll",
    category: "sfx",
    url: "https://cdn.pixabay.com/audio/2022/03/19/audio_03d9b4a9e6.mp3",
    duration: 6,
    emoji: "🥁",
  },
  {
    id: "sfx-airhorn-1",
    name: "Air Horn",
    category: "sfx",
    url: "https://cdn.pixabay.com/audio/2022/03/15/audio_823775b972.mp3",
    duration: 3,
    emoji: "📯",
  },
  {
    id: "sfx-whoosh-1",
    name: "Whoosh",
    category: "sfx",
    url: "https://cdn.pixabay.com/audio/2022/03/15/audio_44675d9180.mp3",
    duration: 2,
    emoji: "💨",
  },
  {
    id: "sfx-bell-1",
    name: "Ding!",
    category: "sfx",
    url: "https://cdn.pixabay.com/audio/2022/03/15/audio_3439b1b53e.mp3",
    duration: 2,
    emoji: "🔔",
  },
  {
    id: "sfx-gameover-1",
    name: "Game Over",
    category: "sfx",
    url: "https://cdn.pixabay.com/audio/2022/03/15/audio_c2c2315b55.mp3",
    duration: 4,
    emoji: "💀",
  },
]

export function getSoundById(id: string): SoundClip | undefined {
  return SOUNDBOARD_CLIPS.find((s) => s.id === id)
}
