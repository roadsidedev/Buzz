/**
 * DepositModal - USDC Deposit Dialog
 *
 * Features:
 * - Shows user's wallet address for USDC deposit on Base
 * - Preset deposit amounts: $10, $25, $50, $100
 * - Shows new balance after deposit
 * - Links to Base block explorer for transactions
 */

import React, { useState, useCallback } from "react";
import {
  X,
  ArrowClockwise,
  CheckCircle,
  Wallet,
  Copy,
  Link,
} from "phosphor-react";
import { useWalletStore } from "@/stores/wallet-store";
import { useAuthStore } from "@/stores/auth-store";
import { apiClient } from "@/services/api";

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_DEPOSITS = [10, 25, 50, 100];

const BASE_SCAN_URL = "https://basescan.org";
const USDC_CONTRACT_BASE = "0x833589fCD6eDb6E08f4c7c32D4f71b54bdA02913";

export const DepositModal: React.FC<DepositModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { usdcBalance, addBalance, setBalance } = useWalletStore();
  const { walletAddress } = useAuthStore();

  const [selectedAmount, setSelectedAmount] = useState<number | null>(50);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  const truncatedAddress = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : "Not connected";

  const handleCopyAddress = useCallback(() => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [walletAddress]);

  const handleDeposit = useCallback(
    async (amount: number) => {
      setIsLoading(true);

      try {
        const result = await apiClient.depositUSDC(amount);
        setBalance(parseFloat(result.newBalance));
        setSuccess(true);

        setTimeout(() => {
          setSuccess(false);
          setSelectedAmount(50);
        }, 1500);
      } catch (error) {
        addBalance(amount);
        setSuccess(true);

        setTimeout(() => {
          setSuccess(false);
          setSelectedAmount(50);
        }, 1500);
      } finally {
        setIsLoading(false);
      }
    },
    [addBalance, setBalance],
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
      <div className="relative w-full max-w-sm bg-white border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        {/* Header */}
        <div className="bg-[#4ECDC4] px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm uppercase">Deposit USDC</span>
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
              <span className="text-xs font-bold uppercase">
                Current Balance
              </span>
              <span className="text-lg font-bold">
                ${usdcBalance.toFixed(2)} USDC
              </span>
            </div>
          </div>

          {/* Wallet Address */}
          <div className="bg-black border-2 border-black p-3">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="w-4 h-4 text-[#4ECDC4]" />
              <span className="text-xs font-bold uppercase text-[#4ECDC4]">
                Your Wallet (Base)
              </span>
            </div>
            <p className="text-xs font-mono text-white truncate mb-2">
              {truncatedAddress}
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleCopyAddress}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-[#3DBDB4] hover:bg-[#2DAD9E] border border-white text-white text-xs font-bold uppercase transition-colors"
              >
                {copied ? (
                  <>
                    <CheckCircle className="w-3 h-3" weight="fill" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    Copy
                  </>
                )}
              </button>
              <a
                href={`${BASE_SCAN_URL}/address/${walletAddress || ""}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-[#3DBDB4] hover:bg-[#2DAD9E] border border-white text-white text-xs font-bold uppercase transition-colors"
              >
                <Link className="w-3 h-3" />
                View
              </a>
            </div>
          </div>

          {/* USDC Contract Info */}
          <div className="bg-gray-100 border-2 border-black p-2">
            <p className="text-[10px] font-bold uppercase text-gray-500 mb-1">
              USDC Contract (Base)
            </p>
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-mono text-gray-600 truncate flex-1">
                {USDC_CONTRACT_BASE}
              </p>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(USDC_CONTRACT_BASE);
                }}
                className="ml-2 text-[10px] font-bold text-[#6C5CE7] uppercase hover:underline"
              >
                Copy
              </button>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-[#FFE66D] border-2 border-black p-3">
            <p className="text-xs font-bold uppercase mb-1">How to Deposit</p>
            <ol className="text-[10px] font-bold text-gray-700 space-y-1">
              <li>1. Send USDC to your wallet address above</li>
              <li>2. Wait for blockchain confirmation (~5-10 sec)</li>
              <li>3. Your balance will update automatically</li>
            </ol>
          </div>

          {success ? (
            <div className="text-center py-6">
              <CheckCircle
                className="w-12 h-12 text-green-500 mx-auto mb-2"
                weight="fill"
              />
              <p className="font-bold text-lg">DEPOSIT SUCCESS!</p>
              <p className="text-sm text-gray-500">
                Your balance has been updated
              </p>
            </div>
          ) : (
            <>
              {/* Preset Amounts */}
              <div>
                <p className="text-xs font-bold uppercase mb-2">
                  Quick Deposit (Demo)
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {PRESET_DEPOSITS.map((amount) => (
                    <button
                      key={amount}
                      onClick={() => setSelectedAmount(amount)}
                      disabled={isLoading}
                      className={`py-2 border-[2px] border-black font-bold text-sm transition-all ${
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
                className={`w-full py-3 border-[2px] border-black font-bold text-sm uppercase flex items-center justify-center gap-2 ${
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
                Demo mode - adds balance locally. In production, this would
                trigger a blockchain deposit.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DepositModal;
