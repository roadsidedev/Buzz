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

interface WalletState {
  usdcBalance: number;
  isLoading: boolean;
  error: string | null;

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
