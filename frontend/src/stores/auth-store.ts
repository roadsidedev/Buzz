/**
 * AuthStore: Global authentication state management (SIWA)
 *
 * Manages:
 * - SIWA receipt storage and validation
 * - Wallet address and agent ID
 * - Authentication state
 * - Agent profile information
 *
 * Note: SIWA authentication flow is handled by AuthModal component.
 * This store manages session state and persistence.
 */

import { useEffect } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { AgentProfile } from "@/types/auth";
import { logger } from "@/utils/logger";

/**
 * AuthStore: Global auth state
 */
interface AuthStore {
  authenticated: boolean;
  receipt: string | null;
  walletAddress: string | null;
  agentId: string | null;
  agent: AgentProfile | null;
  isLoading: boolean;
  error: string | null;

  setAuthenticated: (authenticated: boolean) => void;
  setReceipt: (receipt: string | null) => void;
  setWalletAddress: (address: string | null) => void;
  setAgentId: (id: string | null) => void;
  setAgent: (agent: AgentProfile | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
  refreshAccessToken: () => Promise<boolean>;
}

/**
 * Create Zustand store with persistence
 */
export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      authenticated: false,
      receipt: null,
      walletAddress: null,
      agentId: null,
      agent: null,
      isLoading: true,
      error: null,

      setAuthenticated: (authenticated: boolean) => {
        set({ authenticated });
      },

      setReceipt: (receipt: string | null) => {
        set({ receipt });
      },

      setWalletAddress: (address: string | null) => {
        set({ walletAddress: address });
      },

      setAgentId: (id: string | null) => {
        set({ agentId: id });
      },

      setAgent: (agent: AgentProfile | null) => {
        set({ agent });
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      setError: (error: string | null) => {
        set({ error });
      },

      logout: async () => {
        try {
          const receipt = useAuthStore.getState().receipt;
          if (receipt) {
            await fetch("/api/v1/auth/logout", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${receipt}`,
              },
            });
          }
        } catch (err) {
          logger.error("Logout error", { error: err });
        } finally {
          set({
            authenticated: false,
            receipt: null,
            walletAddress: null,
            agentId: null,
            agent: null,
            error: null,
          });
        }
      },

      initialize: async () => {
        set({ isLoading: true });
        const receipt = useAuthStore.getState().receipt;

        if (!receipt) {
          set({ isLoading: false, authenticated: false });
          return;
        }

        try {
          const response = await fetch("/api/v1/auth/profile", {
            headers: {
              Authorization: `Bearer ${receipt}`,
            },
          });

          if (!response.ok) {
            throw new Error("Receipt validation failed");
          }

          const data = await response.json();
          const { agent } = data.data;

          set({
            authenticated: true,
            agent,
            walletAddress: agent.walletAddress,
            agentId: agent.id,
            isLoading: false,
          });

          logger.info("Auth initialized from stored receipt", {
            agentId: agent.id,
          });
        } catch (err) {
          logger.warn("Stored receipt invalid, clearing", { error: err });
          set({
            authenticated: false,
            receipt: null,
            walletAddress: null,
            agentId: null,
            agent: null,
            isLoading: false,
          });
        }
      },

      refreshAccessToken: async () => {
        return true;
      },
    }),
    {
      name: "clawzz-siwa-auth",
      partialize: (state) => ({
        receipt: state.receipt,
        walletAddress: state.walletAddress,
        agentId: state.agentId,
        agent: state.agent,
      }),
    },
  ),
);

/**
 * Hook to get auth state and actions
 *
 * SIWA authentication is handled by AuthModal component.
 * This hook provides read-only state access and logout.
 */
export const useAuth = () => {
  const store = useAuthStore();

  return {
    isAuthenticated: store.authenticated,
    user: store.agent,
    walletAddress: store.walletAddress,
    isLoading: store.isLoading,
    error: store.error,

    clearError: () => {
      store.setError(null);
    },

    logout: store.logout,
  };
};

/**
 * Hook to initialize auth on app load
 */
export const useInitializeAuth = () => {
  const initialize = useAuthStore((state) => state.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);
};
