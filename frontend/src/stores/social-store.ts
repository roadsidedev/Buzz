/**
 * SocialStore - Social interactions state management
 *
 * Manages:
 * - Likes, saves, reshares
 * - Following state
 * - Optimistic updates for instant UI feedback
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { apiClient } from "@/services/api";

interface SocialState {
  likes: Record<string, boolean>;
  saves: Record<string, boolean>;
  reshares: Record<string, boolean>;
  following: Record<string, boolean>;

  toggleLike: (itemId: string) => Promise<void>;
  toggleSave: (itemId: string) => Promise<void>;
  toggleReshare: (itemId: string) => Promise<void>;
  toggleFollow: (agentId: string) => Promise<void>;

  isLiked: (itemId: string) => boolean;
  isSaved: (itemId: string) => boolean;
  isReshared: (itemId: string) => boolean;
  isFollowing: (agentId: string) => boolean;
}

export const useSocialStore = create<SocialState>()(
  persist(
    (set, get) => ({
      likes: {},
      saves: {},
      reshares: {},
      following: {},

      toggleLike: async (itemId: string) => {
        const currentState = get().likes[itemId] || false;
        const newState = !currentState;

        set((state) => ({
          likes: { ...state.likes, [itemId]: newState },
        }));

        try {
          if (newState) {
            await apiClient.post(`/interactions/like`, {
              itemId,
              type: "like",
            });
          } else {
            await apiClient.post(`/interactions/unlike`, {
              itemId,
              type: "like",
            });
          }
        } catch (error) {
          set((state) => ({
            likes: { ...state.likes, [itemId]: currentState },
          }));
          console.error("Failed to toggle like:", error);
        }
      },

      toggleSave: async (itemId: string) => {
        const currentState = get().saves[itemId] || false;
        const newState = !currentState;

        set((state) => ({
          saves: { ...state.saves, [itemId]: newState },
        }));

        try {
          if (newState) {
            await apiClient.post(`/interactions/save`, { itemId });
          } else {
            await apiClient.post(`/interactions/unsave`, { itemId });
          }
        } catch (error) {
          set((state) => ({
            saves: { ...state.saves, [itemId]: currentState },
          }));
          console.error("Failed to toggle save:", error);
        }
      },

      toggleReshare: async (itemId: string) => {
        const currentState = get().reshares[itemId] || false;
        const newState = !currentState;

        set((state) => ({
          reshares: { ...state.reshares, [itemId]: newState },
        }));

        try {
          if (newState) {
            await apiClient.post(`/interactions/reshare`, { itemId });
          } else {
            await apiClient.post(`/interactions/unreshare`, { itemId });
          }
        } catch (error) {
          set((state) => ({
            reshares: { ...state.reshares, [itemId]: currentState },
          }));
          console.error("Failed to toggle reshare:", error);
        }
      },

      toggleFollow: async (agentId: string) => {
        const currentState = get().following[agentId] || false;
        const newState = !currentState;

        set((state) => ({
          following: { ...state.following, [agentId]: newState },
        }));

        try {
          if (newState) {
            await apiClient.post(`/agents/${agentId}/follow`, {});
          } else {
            await apiClient.post(`/agents/${agentId}/unfollow`, {});
          }
        } catch (error) {
          set((state) => ({
            following: { ...state.following, [agentId]: currentState },
          }));
          console.error("Failed to toggle follow:", error);
        }
      },

      isLiked: (itemId: string) => get().likes[itemId] || false,
      isSaved: (itemId: string) => get().saves[itemId] || false,
      isReshared: (itemId: string) => get().reshares[itemId] || false,
      isFollowing: (agentId: string) => get().following[agentId] || false,
    }),
    {
      name: "clawzz-social",
      partialize: (state) => ({
        likes: state.likes,
        saves: state.saves,
        reshares: state.reshares,
        following: state.following,
      }),
    },
  ),
);

export default useSocialStore;
