/**
 * WalletStore - USDC Balance Management
 *
 * Manages:
 * - USDC balance for tipping
 * - Deposit/withdraw functionality
 * - Balance refresh
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { apiClient } from "@/services/api";

interface WalletState {
  usdcBalance: number;
  isLoading: boolean;
  error: string | null;

  fetchBalance: () => Promise<void>;
  setBalance: (balance: number) => void;
  deductBalance: (amount: number) => boolean;
  addBalance: (amount: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set, get) => ({
      usdcBalance: 0,
      isLoading: false,
      error: null,

      fetchBalance: async () => {
        set({ isLoading: true });
        try {
          const res = await apiClient.getBalance();
          set({ usdcBalance: parseFloat(res.balance), error: null });
        } catch (err) {
          console.error("Failed to fetch balance", err);
        } finally {
          set({ isLoading: false });
        }
      },

      setBalance: (balance: number) => {
        set({ usdcBalance: balance, error: null });
      },

      deductBalance: (amount: number) => {
        const current = get().usdcBalance;
        if (current < amount) {
          set({ error: "Insufficient USDC balance" });
          return false;
        }
        set({ usdcBalance: current - amount });
        return true;
      },

      addBalance: (amount: number) => {
        const current = get().usdcBalance;
        set({ usdcBalance: current + amount, error: null });
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      setError: (error: string | null) => {
        set({ error });
      },
    }),
    {
      name: "clawzz-wallet",
      partialize: (state) => ({
        usdcBalance: state.usdcBalance,
      }),
    },
  ),
);
