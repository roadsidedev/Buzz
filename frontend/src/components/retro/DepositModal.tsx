/**
 * DepositModal - Simple USDC Deposit Dialog
 *
 * Features:
 * - Preset deposit amounts: $10, $25, $50, $100
 * - Shows new balance after deposit
 */

import React, { useState, useCallback } from "react";
import { X, ArrowClockwise, CheckCircle, Wallet } from "phosphor-react";
import { useWalletStore } from "@/stores/wallet-store";
import { useAuthStore } from "@/stores/auth-store";

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_DEPOSITS = [10, 25, 50, 100];

export const DepositModal: React.FC<DepositModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { usdcBalance, addBalance } = useWalletStore();
  const { walletAddress } = useAuthStore();

  const [selectedAmount, setSelectedAmount] = useState<number | null>(50);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const truncatedAddress = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : "Not connected";

  const handleDeposit = useCallback(
    async (amount: number) => {
      setIsLoading(true);

      // Simulate deposit (in production, this would be a blockchain transaction)
      setTimeout(() => {
        addBalance(amount);
        setSuccess(true);
        setIsLoading(false);

        setTimeout(() => {
          setSuccess(false);
          setSelectedAmount(50);
        }, 1500);
      }, 1000);
    },
    [addBalance],
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-sm bg-white border-[3px] border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        {/* Header */}
        <div className="bg-[#4ECDC4] px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-black text-sm uppercase">Deposit USDC</span>
          </div>
          <button onClick={onClose} className="hover:bg-white/30 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Current Balance */}
          <div className="bg-[#E0E0E0] border-2 border-black p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase">
                Current Balance
              </span>
              <span className="text-lg font-black">
                ${usdcBalance.toFixed(2)} USDC
              </span>
            </div>
          </div>

          {/* Wallet Address */}
          <div className="bg-black border-2 border-black p-3">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-[#4ECDC4]" />
              <span className="text-xs font-black uppercase text-[#4ECDC4]">
                Wallet
              </span>
            </div>
            <p className="text-xs font-mono text-white mt-1 truncate">
              {truncatedAddress}
            </p>
          </div>

          {success ? (
            <div className="text-center py-6">
              <CheckCircle
                className="w-12 h-12 text-green-500 mx-auto mb-2"
                weight="fill"
              />
              <p className="font-black text-lg">DEPOSIT SUCCESS!</p>
              <p className="text-sm text-gray-500">
                Your balance has been updated
              </p>
            </div>
          ) : (
            <>
              {/* Preset Amounts */}
              <div>
                <p className="text-xs font-black uppercase mb-2">
                  Select Amount
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {PRESET_DEPOSITS.map((amount) => (
                    <button
                      key={amount}
                      onClick={() => setSelectedAmount(amount)}
                      disabled={isLoading}
                      className={`py-2 border-[2px] border-black font-black text-sm transition-all ${
                        selectedAmount === amount
                          ? "bg-[#FFE66D] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                          : "bg-white hover:bg-gray-100"
                      }`}
                    >
                      ${amount}
                    </button>
                  ))}
                </div>
              </div>

              {/* Deposit Button */}
              <button
                onClick={() => selectedAmount && handleDeposit(selectedAmount)}
                disabled={!selectedAmount || isLoading}
                className={`w-full py-3 border-[2px] border-black font-black text-sm uppercase flex items-center justify-center gap-2 ${
                  selectedAmount
                    ? "bg-[#4ECDC4] hover:bg-[#3DBDB4]"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                }`}
              >
                {isLoading ? (
                  <>
                    <ArrowClockwise className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>Deposit ${selectedAmount} USDC</>
                )}
              </button>

              <p className="text-[10px] text-center text-gray-500">
                Demo mode - no real blockchain transaction
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DepositModal;
