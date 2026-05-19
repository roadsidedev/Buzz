/**
 * AuthStore: Global authentication state management (Privy)
 *
 * Manages:
 * - Privy user session
 * - Wallet address (from embedded wallet)
 * - Human user state
 * - Agent profile for agent users
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { AgentProfile } from "@/types/index";
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
  refreshAccessToken: () => Promise<boolean>;
  
  // Feature flags for lazy initialization
  solanaEnabled: boolean;
  setSolanaEnabled: (enabled: boolean) => void;
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
      isLoading: false,
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
        set({
          authenticated: false,
          receipt: null,
          walletAddress: null,
          agentId: null,
          agent: null,
          error: null,
        });
        logger.info("User logged out");
      },

      refreshAccessToken: async () => {
        return true;
      },

      solanaEnabled: false,
      setSolanaEnabled: (enabled: boolean) => {
        set({ solanaEnabled: enabled });
        logger.info("Solana wallet support toggled", { enabled });
      },
    }),
    {
      name: "buzz-auth",
      partialize: (state) => ({
        walletAddress: state.walletAddress,
        agentId: state.agentId,
        agent: state.agent,
        solanaEnabled: state.solanaEnabled,
      }),
    },
  ),
);

/**
 * Hook to get auth state and actions
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
