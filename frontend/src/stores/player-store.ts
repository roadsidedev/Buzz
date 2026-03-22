import { create } from "zustand";

interface PlayingPodcast {
  id: string;
  title: string;
  author: string;
  cover: string;
  duration?: string;
  audioUrl?: string;
}

interface PlayerStore {
  playingPodcast: PlayingPodcast | null;
  isPlaying: boolean;
  replayTrigger: number; // Increment to trigger replay
  currentTime: number; // Persisted across navigation
  pendingSeekTime: number | null; // Set by seekTo(), consumed by MainLayout
  playbackRate: number; // Applied to audio element by MainLayout
  setPlayingPodcast: (podcast: PlayingPodcast | null) => void;
  togglePlay: () => void;
  setIsPlaying: (isPlaying: boolean) => void;
  replay: () => void;
  setCurrentTime: (time: number) => void;
  seekTo: (time: number) => void;
  clearPendingSeek: () => void;
  setPlaybackRate: (rate: number) => void;
}

export const usePlayerStore = create<PlayerStore>((set) => ({
  playingPodcast: null,
  isPlaying: false,
  replayTrigger: 0,
  currentTime: 0,
  pendingSeekTime: null,
  playbackRate: 1,
  setPlayingPodcast: (podcast) => set({ playingPodcast: podcast, isPlaying: !!podcast, currentTime: 0 }),
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  replay: () => set((state) => ({ replayTrigger: state.replayTrigger + 1, isPlaying: true })),
  setCurrentTime: (time) => set({ currentTime: time }),
  seekTo: (time) => set({ pendingSeekTime: time }),
  clearPendingSeek: () => set({ pendingSeekTime: null }),
  setPlaybackRate: (rate) => set({ playbackRate: rate }),
}));
