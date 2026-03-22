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
  savedItems: Array<{ id: string; type: string }>;

  fetchInteractions: () => Promise<void>;
  toggleLike: (itemId: string, itemType?: string) => Promise<void>;
  toggleSave: (itemId: string, itemType?: string) => Promise<void>;
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
      savedItems: [],

      fetchInteractions: async () => {
        try {
          const response: any = await apiClient.get('/interactions/mine', { silent: true });
          const { likes, saves } = response.data;
          
          const likesMap: Record<string, boolean> = {};
          likes.forEach((id: string) => likesMap[id] = true);
          
          const savesMap: Record<string, boolean> = {};
          saves.forEach((s: any) => savesMap[s.id] = true);
          
          set({ 
            likes: likesMap, 
            saves: savesMap,
            savedItems: saves
          });
        } catch (error) {
          console.error("Failed to fetch interactions:", error);
        }
      },

      toggleLike: async (itemId: string, itemType: string = "room") => {
        const currentState = get().likes[itemId] || false;
        const newState = !currentState;

        set((state) => ({
          likes: { ...state.likes, [itemId]: newState },
        }));

        try {
          if (newState) {
            await apiClient.post(`/interactions/like`, {
              itemId,
              itemType,
            });
          } else {
            await apiClient.post(`/interactions/unlike`, {
              itemId,
            });
          }
        } catch (error) {
          set((state) => ({
            likes: { ...state.likes, [itemId]: currentState },
          }));
          console.error("Failed to toggle like:", error);
        }
      },

      toggleSave: async (itemId: string, itemType: string = "room") => {
        const currentState = get().saves[itemId] || false;
        const newState = !currentState;

        set((state) => ({
          saves: { ...state.saves, [itemId]: newState },
          savedItems: newState 
            ? [...get().savedItems, { id: itemId, type: itemType }]
            : get().savedItems.filter(i => i.id !== itemId)
        }));

        try {
          if (newState) {
            await apiClient.post(`/interactions/save`, { itemId, itemType });
          } else {
            await apiClient.post(`/interactions/unsave`, { itemId });
          }
        } catch (error) {
          set((state) => ({
            saves: { ...state.saves, [itemId]: currentState },
            savedItems: currentState
              ? (get().savedItems.some(i => i.id === itemId) ? get().savedItems : [...get().savedItems, { id: itemId, type: itemType }])
              : get().savedItems.filter(i => i.id !== itemId)
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
        savedItems: state.savedItems,
      }),
    },
  ),
);

export default useSocialStore;
