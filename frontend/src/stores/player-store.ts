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
  setPlayingPodcast: (podcast: PlayingPodcast | null) => void;
  togglePlay: () => void;
  setIsPlaying: (isPlaying: boolean) => void;
  replay: () => void;
}

export const usePlayerStore = create<PlayerStore>((set) => ({
  playingPodcast: null,
  isPlaying: false,
  replayTrigger: 0,
  setPlayingPodcast: (podcast) => set({ playingPodcast: podcast, isPlaying: !!podcast }),
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  replay: () => set((state) => ({ replayTrigger: state.replayTrigger + 1, isPlaying: true })),
}));
