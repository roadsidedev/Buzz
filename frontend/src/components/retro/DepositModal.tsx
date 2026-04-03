/**
 * DepositModal - USDC Deposit Dialog
 *
 * Updated to use shadcn/ui components for consistent design.
 * 
 * Features:
 * - Shows user's wallet address for USDC deposit on Base
 * - Preset deposit amounts: $10, $25, $50, $100
 * - Shows new balance after deposit
 */

import React, { useState, useCallback } from "react";
import {
  RefreshCw,
  CheckCircle,
  Wallet,
  Copy,
  ExternalLink,
  Info,
} from "lucide-react";
import { useWalletStore } from "@/stores/wallet-store";
import { useAuthStore } from "@/stores/auth-store";
import { apiClient } from "@/services/api";
import { BeeSpinner } from "@/components/discovery/loading-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";

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
  const { usdcBalance, setBalance } = useWalletStore();
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
        const result: any = await apiClient.post('/wallet/deposit', { amount });
        setBalance(parseFloat(result.data.newBalance));
        setSuccess(true);

        setTimeout(() => {
          setSuccess(false);
          setSelectedAmount(50);
          onClose();
        }, 2000);
      } catch (error: any) {
        console.error("Deposit failed", error);
        alert(error.message || "Deposit failed. Please try again.");
      } finally {
        setIsLoading(false);
      }
    },
    [setBalance, onClose],
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            Deposit USDC
          </DialogTitle>
          <DialogDescription>
            Add funds to your wallet to tip agents and unlock features.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Current Balance */}
          <div className="flex items-center justify-between bg-muted/50 p-3 rounded-lg border">
            <span className="text-sm font-medium text-muted-foreground">Current Balance</span>
            <span className="text-lg font-bold text-foreground">${usdcBalance.toFixed(2)} USDC</span>
          </div>

          {/* Success State */}
          {success ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-3 animate-in fade-in zoom-in duration-300">
              <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
              <div className="text-center">
                <p className="font-bold text-lg text-foreground">Deposit Successful!</p>
                <p className="text-sm text-muted-foreground">Your balance has been updated.</p>
              </div>
            </div>
          ) : (
            <>
              {/* Wallet Info */}
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your Base Wallet</span>
                    <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20">BASE NETWORK</Badge>
                  </div>
                  
                  <div className="bg-muted p-2 rounded font-mono text-xs break-all border text-center">
                    {walletAddress || "Connecting..."}
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      className="flex-1 gap-1.5 h-8 text-xs"
                      onClick={handleCopyAddress}
                    >
                      {copied ? <CheckCircle size={14} className="text-green-500" /> : <Copy size={14} />}
                      {copied ? "Copied!" : "Copy Address"}
                    </Button>
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      className="flex-1 gap-1.5 h-8 text-xs"
                      asChild
                    >
                      <a href={`${BASE_SCAN_URL}/address/${walletAddress || ""}`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink size={14} />
                        View on Scan
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Instructions */}
              <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 flex gap-3">
                <Info size={18} className="text-blue-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">How to deposit USDC</p>
                  <ol className="text-[11px] text-blue-600/80 dark:text-blue-400/80 space-y-0.5 list-decimal ml-4">
                    <li>Send USDC (Base) to your wallet address.</li>
                    <li>Wait for confirmation (~5-10 seconds).</li>
                    <li>Balance updates automatically.</li>
                  </ol>
                </div>
              </div>

              <Separator />

              {/* Quick Deposit */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quick Deposit (Demo)</p>
                <div className="grid grid-cols-4 gap-2">
                  {PRESET_DEPOSITS.map((amount) => (
                    <Button
                      key={amount}
                      variant={selectedAmount === amount ? "default" : "outline"}
                      size="sm"
                      className="font-bold h-9"
                      onClick={() => setSelectedAmount(amount)}
                      disabled={isLoading}
                    >
                      ${amount}
                    </Button>
                  ))}
                </div>

                <Button 
                  className="w-full h-11 font-bold text-sm uppercase mt-2 shadow-lg shadow-primary/20"
                  disabled={!selectedAmount || isLoading}
                  onClick={() => selectedAmount && handleDeposit(selectedAmount)}
                >
                  {isLoading ? (
                    <BeeSpinner size="sm" variant="primary" className="mr-2" />
                  ) : (
                    <Wallet size={16} className="mr-2" />
                  )}
                  {isLoading ? "Processing..." : `Deposit $${selectedAmount} USDC`}
                </Button>
                
                <p className="text-[10px] text-center text-muted-foreground italic">
                  Note: Demo mode adds balance to the backend database directly.
                </p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DepositModal;
