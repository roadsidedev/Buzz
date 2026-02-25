/**
 * TipModal - USDC Tip Dialog with Preset Amounts and Confirmation
 *
 * Features:
 * - Preset tip amounts: $1, $5, $10, $25
 * - Custom amount input
 * - Balance check before tipping
 * - User confirmation step to prevent accidental tips
 * - Success/error states
 */

import React, { useState, useCallback } from "react";
import { X, Coin, CheckCircle, ArrowClockwise, Warning } from "phosphor-react";
import { useWalletStore } from "@/stores/wallet-store";
import { apiClient } from "@/services/api";

interface TipModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  agentName: string;
}

const PRESET_AMOUNTS = [1, 5, 10, 25];

export const TipModal: React.FC<TipModalProps> = ({
  isOpen,
  onClose,
  agentId,
  agentName,
}) => {
  const { usdcBalance, deductBalance, addBalance, setBalance } =
    useWalletStore();

  const [selectedAmount, setSelectedAmount] = useState<number | null>(5);
  const [customAmount, setCustomAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const tipAmount =
    selectedAmount || (customAmount ? parseFloat(customAmount) : 0);
  const canTip = tipAmount > 0 && tipAmount <= usdcBalance;

  const handlePresetClick = (amount: number) => {
    setSelectedAmount(amount);
    setCustomAmount("");
    setError(null);
  };

  const handleCustomAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === "" || /^\d+(\.\d{0,2})?$/.test(value)) {
      setCustomAmount(value);
      setSelectedAmount(null);
      setError(null);
    }
  };

  const handleConfirmTip = useCallback(async () => {
    if (!canTip) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await apiClient.tipAgent(agentId, tipAmount);
      setBalance(parseFloat(result.newBalance));
      setSuccess(true);

      setTimeout(() => {
        onClose();
        setSuccess(false);
        setSelectedAmount(5);
        setCustomAmount("");
        setShowConfirmation(false);
      }, 2000);
    } catch (err) {
      const deducted = deductBalance(tipAmount);
      if (deducted) {
        setSuccess(true);
        setTimeout(() => {
          onClose();
          setSuccess(false);
          setSelectedAmount(5);
          setCustomAmount("");
          setShowConfirmation(false);
        }, 2000);
      } else {
        setError("Insufficient balance. Please deposit USDC.");
        setShowConfirmation(false);
      }
    } finally {
      setIsLoading(false);
    }
  }, [agentId, tipAmount, canTip, deductBalance, setBalance, onClose]);

  const handleTipClick = () => {
    if (canTip) {
      setShowConfirmation(true);
    }
  };

  const handleCancelConfirmation = () => {
    setShowConfirmation(false);
  };

  const handleDeposit = useCallback(async () => {
    setIsLoading(true);
    try {
      addBalance(50);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 1500);
    } finally {
      setIsLoading(false);
    }
  }, [addBalance]);

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
        <div className="bg-black text-white px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coin className="w-5 h-5 text-[#FFE66D]" weight="fill" />
            <span className="font-black text-sm uppercase">
              Tip @{agentName}
            </span>
          </div>
          <button onClick={onClose} className="hover:bg-gray-700 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Balance Display */}
          <div className="bg-[#E0E0E0] border-2 border-black p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase">Your Balance</span>
              <span className="text-lg font-black">
                ${usdcBalance.toFixed(2)} USDC
              </span>
            </div>
          </div>

          {/* Confirmation Step */}
          {showConfirmation ? (
            <div className="bg-[#FFE66D] border-2 border-black p-4 text-center">
              <Warning
                className="w-12 h-12 text-orange-500 mx-auto mb-2"
                weight="fill"
              />
              <p className="font-black text-lg mb-2">CONFIRM TIP</p>
              <p className="text-sm font-bold text-gray-700 mb-4">
                You are about to send{" "}
                <span className="text-[#6C5CE7]">
                  ${tipAmount.toFixed(2)} USDC
                </span>{" "}
                to @{agentName}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleCancelConfirmation}
                  disabled={isLoading}
                  className="flex-1 py-2 border-2 border-black bg-white font-black text-xs uppercase hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmTip}
                  disabled={isLoading}
                  className="flex-1 py-2 border-2 border-black bg-[#4ECDC4] font-black text-xs uppercase flex items-center justify-center gap-1 hover:bg-[#3DBDB4]"
                >
                  {isLoading ? (
                    <ArrowClockwise className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" weight="fill" />
                      Confirm
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : success ? (
            <div className="text-center py-6">
              <CheckCircle
                className="w-12 h-12 text-green-500 mx-auto mb-2"
                weight="fill"
              />
              <p className="font-black text-lg">TIP SENT!</p>
              <p className="text-sm text-gray-500">
                ${tipAmount.toFixed(2)} USDC
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
                  {PRESET_AMOUNTS.map((amount) => (
                    <button
                      key={amount}
                      onClick={() => handlePresetClick(amount)}
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

              {/* Custom Amount */}
              <div>
                <p className="text-xs font-black uppercase mb-2">Or Custom</p>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-lg">
                    $
                  </span>
                  <input
                    type="text"
                    value={customAmount}
                    onChange={handleCustomAmountChange}
                    placeholder="0.00"
                    className="w-full pl-8 pr-3 py-2 border-[2px] border-black font-black text-lg focus:outline-none focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                  />
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-100 border-2 border-red-500 px-3 py-2">
                  <p className="text-xs font-bold text-red-700">{error}</p>
                </div>
              )}

              {/* Insufficient Balance Warning */}
              {!canTip && tipAmount > 0 && (
                <div className="bg-red-100 border-2 border-red-500 px-3 py-2">
                  <p className="text-xs font-bold text-red-700">
                    Insufficient balance. Deposit more USDC to tip.
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={handleDeposit}
                  disabled={isLoading}
                  className="flex-1 py-2 border-[2px] border-black bg-white font-black text-xs uppercase hover:bg-[#E0E0E0] flex items-center justify-center gap-1"
                >
                  <ArrowClockwise className="w-4 h-4" />
                  Deposit
                </button>
                <button
                  onClick={handleTipClick}
                  disabled={!canTip || isLoading}
                  className={`flex-1 py-2 border-[2px] border-black font-black text-xs uppercase flex items-center justify-center gap-1 ${
                    canTip
                      ? "bg-[#FFE66D] hover:bg-[#FFD93D]"
                      : "bg-gray-300 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  {isLoading ? (
                    <ArrowClockwise className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Coin className="w-4 h-4" weight="fill" />
                      Send ${tipAmount.toFixed(2)}
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TipModal;
