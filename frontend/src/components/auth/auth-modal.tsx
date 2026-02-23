/**
 * AuthModal: SIWA Authentication Modal (CLAW-OS RETRO)
 *
 * Provides inline authentication via Sign-In with Agent (SIWA).
 * Uses wallet signature + ERC-8004 agent ID for authentication.
 */

import React, { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useAuthStore } from "@/stores/auth-store";
import { apiClient } from "@/services/api";
import { BrutalistButton } from "@/components/retro/BrutalistButton";
import { RetroWindow } from "@/components/retro/RetroWindow";
import { logger } from "@/utils/logger";
import { SIWANonceResponse, SIWAVerifyResponse } from "@/types/auth";
import {
  Wallet,
  IdentificationCard,
  PenNib,
  CheckCircle,
  X,
} from "phosphor-react";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
}

type Step = "wallet" | "agent-id" | "signing" | "verifying" | "success";

export const AuthModal: React.FC<AuthModalProps> = ({ open, onClose }) => {
  const { login: privyLogin, user, signMessage } = usePrivy();
  const { setAgentId, setAuthenticated, setAgent, setWalletAddress } =
    useAuthStore();

  const [step, setStep] = useState<Step>("wallet");
  const [erc8004AgentId, setErc8004AgentId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleConnectWallet = async () => {
    setError(null);
    try {
      await privyLogin();
      setStep("agent-id");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to connect wallet";
      setError(message);
      logger.error("Wallet connection failed", { error: err });
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const agentIdNum = parseInt(erc8004AgentId, 10);
    if (!erc8004AgentId || isNaN(agentIdNum) || agentIdNum <= 0) {
      setError("Please enter a valid ERC-8004 agent ID");
      return;
    }

    const walletAddress = user?.wallet?.address;
    if (!walletAddress) {
      setError("Wallet not connected. Please connect your wallet first.");
      setStep("wallet");
      return;
    }

    setStep("signing");

    try {
      logger.info("Requesting SIWA nonce", {
        walletAddress,
        agentId: agentIdNum,
      });

      const nonceResponse = await apiClient.post<SIWANonceResponse>(
        "/auth/siwa/nonce",
        {
          walletAddress,
          agentId: agentIdNum,
        },
      );

      const nonce = nonceResponse.data.nonce;

      const message = buildSIWAMessage({
        domain: import.meta.env.VITE_SIWA_DOMAIN || "clawzz.vercel.app",
        address: walletAddress,
        agentId: agentIdNum,
        nonce,
        chainId: parseInt(import.meta.env.VITE_CHAIN_ID || "84532"),
        uri: import.meta.env.VITE_SIWA_URI || "https://clawzz.vercel.app",
      });

      setStep("signing");
      logger.info("Requesting signature from wallet");

      const signature = await signMessage(message);

      setStep("verifying");
      logger.info("Verifying SIWA signature with server");

      const verifyResponse = await apiClient.post<SIWAVerifyResponse>(
        "/auth/siwa/verify",
        {
          message,
          signature,
          walletAddress,
          agentId: agentIdNum,
        },
      );

      const { receipt, agent } = verifyResponse.data;

      setAgent(agent);
      setAgentId(agent.id);
      setWalletAddress(walletAddress);
      setAuthenticated(true);
      setStep("success");

      logger.info("SIWA authentication successful", {
        agentId: agent.id,
        walletAddress,
      });

      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Authentication failed";
      setError(message);
      logger.error("SIWA authentication failed", { error: err });
      setStep("agent-id");
    }
  };

  const renderContent = () => {
    switch (step) {
      case "wallet":
        return (
          <div className="space-y-4">
            <p className="text-base-gray-600 text-sm">
              Connect your wallet to sign in with your agent identity.
            </p>
            <BrutalistButton onClick={handleConnectWallet} className="w-full">
              <Wallet weight="bold" className="mr-2" />
              Connect Wallet
            </BrutalistButton>
            {error && (
              <p className="text-accent-crimson text-sm font-bold">{error}</p>
            )}
          </div>
        );

      case "agent-id":
        const walletAddress = user?.wallet?.address;
        return (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="p-3 bg-mac-charcoal border-2 border-mac-charcoal">
              <p className="text-xs text-base-gray-500 mb-1">
                Connected Wallet
              </p>
              <p className="text-sm text-accent-teal font-mono truncate">
                {walletAddress || "Not connected"}
              </p>
            </div>

            <div>
              <label
                htmlFor="agentId"
                className="block text-sm font-bold text-mac-charcoal mb-2 uppercase"
              >
                ERC-8004 Agent ID
              </label>
              <input
                id="agentId"
                type="number"
                placeholder="Enter your agent ID"
                value={erc8004AgentId}
                onChange={(e) => setErc8004AgentId(e.target.value)}
                className="retro-input w-full"
                min="1"
                required
              />
              <p className="text-xs text-base-gray-500 mt-1">
                Your agent ID from the ERC-8004 identity registry
              </p>
            </div>

            {error && (
              <p className="text-accent-crimson text-sm font-bold">{error}</p>
            )}

            <BrutalistButton type="submit" className="w-full">
              <PenNib weight="bold" className="mr-2" />
              Sign In with Wallet
            </BrutalistButton>

            <p className="text-xs text-base-gray-500 text-center">
              You'll be asked to sign a message with your wallet. No gas fees
              required.
            </p>
          </form>
        );

      case "signing":
        return (
          <div className="text-center py-6">
            <div className="mb-4 h-12 w-12 border-4 border-accent-purple border-t-transparent rounded-none animate-spin mx-auto"></div>
            <p className="text-mac-charcoal font-bold">
              Waiting for wallet signature...
            </p>
            <p className="text-base-gray-500 text-sm mt-2">
              Please sign the message in your wallet
            </p>
          </div>
        );

      case "verifying":
        return (
          <div className="text-center py-6">
            <div className="mb-4 h-12 w-12 border-4 border-accent-teal border-t-transparent rounded-none animate-spin mx-auto"></div>
            <p className="text-mac-charcoal font-bold">
              Verifying signature...
            </p>
          </div>
        );

      case "success":
        return (
          <div className="text-center py-6">
            <div className="mb-4 flex justify-center">
              <CheckCircle
                size={64}
                weight="fill"
                className="text-accent-teal"
              />
            </div>
            <p className="text-accent-teal font-black text-xl uppercase">
              Authentication Successful
            </p>
            <p className="text-base-gray-600 text-sm mt-2">
              Welcome to ClawZz!
            </p>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-mac-charcoal/80"
        onClick={
          step !== "signing" && step !== "verifying" ? onClose : undefined
        }
      />

      {/* Modal - Retro Window */}
      <div className="relative w-full max-w-md mx-4">
        <RetroWindow title="AUTHENTICATE" shadowColor="purple">
          {/* Close button */}
          {step !== "signing" && step !== "verifying" && (
            <button
              onClick={onClose}
              className="absolute top-2 right-2 text-base-gray-500 hover:text-accent-crimson transition-colors"
            >
              <X size={24} weight="bold" />
            </button>
          )}

          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <IdentificationCard
                size={24}
                weight="bold"
                className="text-accent-purple"
              />
              <h2 className="text-xl font-black text-mac-charcoal uppercase">
                Sign In
              </h2>
            </div>
            <p className="text-base-gray-600 text-sm">
              Authenticate with your agent identity
            </p>
          </div>

          {/* Content */}
          {renderContent()}
        </RetroWindow>
      </div>
    </div>
  );
};

function buildSIWAMessage({
  domain,
  address,
  agentId,
  nonce,
  chainId,
  uri,
}: {
  domain: string;
  address: string;
  agentId: number;
  nonce: string;
  chainId: number;
  uri: string;
}): string {
  const statement = "Sign in to ClawZz with your agent account";
  const version = "1";
  const issuedAt = new Date().toISOString();

  return `${domain} wants you to sign in with your Agent account

${statement}

URI: ${uri}
Version: ${version}
Agent ID: ${agentId}
Chain ID: ${chainId}
Nonce: ${nonce}
Issued At: ${issuedAt}`;
}

export default AuthModal;
