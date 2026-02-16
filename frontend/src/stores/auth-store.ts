/**
 * AuthStore: Global authentication state management (SIWA + Privy)
 * 
 * Manages:
 * - SIWA receipt storage and validation
 * - Wallet address and agent ID
 * - Authentication state
 * - Agent profile information
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { AgentProfile } from "@/types/auth";
import { logger } from "@/utils/logger";

/**
 * AuthStore: Global auth state
 */
interface AuthStore {
  // State
  authenticated: boolean;
  receipt: string | null;
  walletAddress: string | null;
  agentId: string | null;
  agent: AgentProfile | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setAuthenticated: (authenticated: boolean) => void;
  setReceipt: (receipt: string | null) => void;
  setWalletAddress: (address: string | null) => void;
  setAgentId: (id: string | null) => void;
  setAgent: (agent: AgentProfile | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  logout: () => void;
  initialize: () => Promise<void>;
}

/**
 * Create Zustand store with persistence
 * 
 * Persists to localStorage with key "clawzz-siwa-auth"
 */
export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      // ========================================
      // Initial State
      // ========================================
      authenticated: false,
      receipt: null,
      walletAddress: null,
      agentId: null,
      agent: null,
      isLoading: true,
      error: null,

      // ========================================
      // Actions
      // ========================================

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

      /**
       * Logout: Clear all auth state
       */
      logout: async () => {
        try {
          // Call logout endpoint to revoke receipt
          const receipt = useAuthStore.getState().receipt;
          if (receipt) {
            // Post to /auth/logout
            await fetch("/api/v1/auth/logout", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${receipt}`,
              },
            });
          }
        } catch (err) {
          logger.error("Logout error", { error: err });
        } finally {
          // Clear all state regardless
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

      /**
       * Initialize: Validate stored receipt on app load
       */
      initialize: async () => {
        set({ isLoading: true });
        const receipt = useAuthStore.getState().receipt;

        if (!receipt) {
          set({ isLoading: false, authenticated: false });
          return;
        }

        try {
          // Verify receipt with server
          const response = await fetch("/api/v1/auth/profile", {
            headers: {
              "Authorization": `Bearer ${receipt}`,
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
    }),
    {
      name: "clawzz-siwa-auth", // localStorage key
      partialize: (state) => ({
        // Only persist these fields
        receipt: state.receipt,
        walletAddress: state.walletAddress,
        agentId: state.agentId,
        agent: state.agent,
      }),
    }
  )
);

/**
 * Hook to initialize auth on app load
 * 
 * Call this once in App.tsx useEffect to validate receipt
 * and recover session from localStorage.
 * 
 * Usage:
 * ```tsx
 * function App() {
 *   useInitializeAuth();
 *   return <AppRouter />;
 * }
 * ```
 */
export const useInitializeAuth = () => {
  const initialize = useAuthStore((state) => state.initialize);

  React.useEffect(() => {
    initialize();
  }, [initialize]);
};

import React from "react";
