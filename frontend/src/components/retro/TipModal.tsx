/**
 * TipModal - USDC Tip Dialog
 *
 * Refactored to use shadcn/ui components for consistency.
 */

import React, { useState, useCallback } from "react";
import { 
  X, 
  CircleDollarSign, 
  CheckCircle, 
  ArrowClockwise, 
  AlertTriangle,
  Wallet
} from "lucide-react";
import { useWalletStore } from "@/stores/wallet-store";
import { apiClient } from "@/services/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";

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
  const { usdcBalance, setBalance, addBalance } = useWalletStore();

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
      const result: any = await apiClient.post('/wallet/tip', { recipientId: agentId, amount: tipAmount });
      setBalance(parseFloat(result.data.newBalance));
      setSuccess(true);

      setTimeout(() => {
        onClose();
        setSuccess(false);
        setSelectedAmount(5);
        setCustomAmount("");
        setShowConfirmation(false);
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Failed to process tip. Please try again.");
      setShowConfirmation(false);
    } finally {
      setIsLoading(false);
    }
  }, [agentId, tipAmount, canTip, setBalance, onClose]);

  const handleTipClick = () => {
    if (canTip) {
      setShowConfirmation(true);
    }
  };

  const handleCancelConfirmation = () => {
    setShowConfirmation(false);
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <CircleDollarSign className="w-5 h-5 text-primary" />
            Tip @{agentName}
          </DialogTitle>
          <DialogDescription>
            Support this agent with a USDC tip.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Balance Display */}
          <div className="flex items-center justify-between bg-muted/50 p-3 rounded-lg border">
            <span className="text-sm font-medium text-muted-foreground">Your Balance</span>
            <span className="text-lg font-bold text-foreground">${usdcBalance.toFixed(2)} USDC</span>
          </div>

          {/* Success State */}
          {success ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-3 animate-in fade-in zoom-in duration-300">
              <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
              <div className="text-center">
                <p className="font-bold text-lg text-foreground">Tip Sent!</p>
                <p className="text-sm text-muted-foreground">${tipAmount.toFixed(2)} USDC sent to @{agentName}</p>
              </div>
            </div>
          ) : showConfirmation ? (
            <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-6 space-y-4 text-center animate-in fade-in slide-in-from-bottom-2 duration-300">
              <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto" />
              <div className="space-y-1">
                <p className="font-bold text-lg">Confirm Tip</p>
                <p className="text-sm text-muted-foreground">
                  You are sending <span className="font-bold text-foreground">${tipAmount.toFixed(2)} USDC</span> to <span className="font-bold text-foreground">@{agentName}</span>. This action is irreversible.
                </p>
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1 h-10" onClick={handleCancelConfirmation} disabled={isLoading}>
                  Cancel
                </Button>
                <Button className="flex-1 h-10 font-bold" onClick={handleConfirmTip} disabled={isLoading}>
                  {isLoading ? <ArrowClockwise className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                  Confirm
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Amount Selection */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Select Amount</p>
                  <div className="grid grid-cols-4 gap-2">
                    {PRESET_AMOUNTS.map((amount) => (
                      <Button
                        key={amount}
                        variant={selectedAmount === amount ? "default" : "outline"}
                        size="sm"
                        className="font-bold h-9"
                        onClick={() => handlePresetClick(amount)}
                      >
                        ${amount}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Custom Amount</p>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">$</span>
                    <Input
                      type="text"
                      value={customAmount}
                      onChange={handleCustomAmountChange}
                      placeholder="0.00"
                      className="pl-7 font-bold text-lg h-11"
                    />
                  </div>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
                  <p className="text-xs font-bold text-destructive flex items-center gap-2">
                    <AlertTriangle size={14} />
                    {error}
                  </p>
                </div>
              )}

              {/* Insufficient Balance Warning */}
              {!canTip && tipAmount > 0 && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-md p-3">
                  <p className="text-xs font-bold text-yellow-600 dark:text-yellow-500 flex items-center gap-2">
                    <Wallet size={14} />
                    Insufficient balance. Please deposit more USDC.
                  </p>
                </div>
              )}

              <Button 
                className="w-full h-11 font-bold text-sm uppercase shadow-lg shadow-primary/20"
                disabled={!canTip || isLoading}
                onClick={handleTipClick}
              >
                {isLoading ? (
                  <ArrowClockwise className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <CircleDollarSign size={16} className="mr-2" />
                )}
                {isLoading ? "Processing..." : `Send $${tipAmount.toFixed(2)} Tip`}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TipModal;
