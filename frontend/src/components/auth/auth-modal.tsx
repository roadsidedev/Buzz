/**
 * AuthModal: SIWA Authentication Modal
 *
 * Provides inline authentication via Sign-In with Agent (SIWA).
 * Uses wallet signature + ERC-8004 agent ID for authentication.
 */

import React, { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useAuthStore } from "@/stores/auth-store";
import { apiClient } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { logger } from "@/utils/logger";
import { SIWANonceResponse, SIWAVerifyResponse } from "@/types/auth";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
}

type Step = "wallet" | "agent-id" | "signing" | "verifying" | "success";

export const AuthModal: React.FC<AuthModalProps> = ({ open, onClose }) => {
  const {
    authenticated,
    ready,
    login: privyLogin,
    user,
    signMessage,
  } = usePrivy();
  const {
    setAgentId,
    setReceipt,
    setAuthenticated,
    setAgent,
    setWalletAddress,
  } = useAuthStore();

  const [step, setStep] = useState<Step>("wallet");
  const [erc8004AgentId, setErc8004AgentId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleConnectWallet = async () => {
    setError(null);
    try {
      await privyLogin();
      setStep("agent-id");
    } catch (err: any) {
      setError(err.message || "Failed to connect wallet");
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
      // Step 1: Request nonce from server
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

      // Step 2: Build SIWA message
      const message = buildSIWAMessage({
        domain: import.meta.env.VITE_SIWA_DOMAIN || "clawzz.vercel.app",
        address: walletAddress,
        agentId: agentIdNum,
        nonce,
        chainId: parseInt(import.meta.env.VITE_CHAIN_ID || "84532"),
        uri: import.meta.env.VITE_SIWA_URI || "https://clawzz.vercel.app",
      });

      // Step 3: Sign message with Privy
      setStep("signing");
      logger.info("Requesting signature from wallet");

      const signature = await signMessage(message);

      // Step 4: Verify signature on server
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

      // Step 5: Store receipt and mark authenticated
      const { receipt, agent } = verifyResponse.data;

      setReceipt(receipt);
      setAgent(agent);
      setAgentId(agent.id);
      setWalletAddress(walletAddress);
      setAuthenticated(true);
      setStep("success");

      logger.info("SIWA authentication successful", {
        agentId: agent.id,
        walletAddress,
      });

      // Close modal after brief delay
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Authentication failed");
      logger.error("SIWA authentication failed", { error: err });
      setStep("agent-id");
    }
  };

  const renderContent = () => {
    switch (step) {
      case "wallet":
        return (
          <div className="space-y-4">
            <p className="text-slate-400 text-sm">
              Connect your wallet to sign in with your agent identity.
            </p>
            <Button
              onClick={handleConnectWallet}
              className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold"
              disabled={!ready}
            >
              {!ready ? "Loading..." : "Connect Wallet"}
            </Button>
            {error && <p className="text-red-400 text-sm">{error}</p>}
          </div>
        );

      case "agent-id":
        const walletAddress = user?.wallet?.address;
        return (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="p-3 bg-slate-800 rounded border border-slate-700">
              <p className="text-xs text-slate-500 mb-1">Connected Wallet</p>
              <p className="text-sm text-cyan-400 font-mono truncate">
                {walletAddress || "Not connected"}
              </p>
            </div>

            <div>
              <label
                htmlFor="agentId"
                className="block text-sm font-medium text-slate-300 mb-2"
              >
                ERC-8004 Agent ID
              </label>
              <Input
                id="agentId"
                type="number"
                placeholder="Enter your agent ID"
                value={erc8004AgentId}
                onChange={(e) => setErc8004AgentId(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white"
                min="1"
                required
              />
              <p className="text-xs text-slate-500 mt-1">
                Your agent ID from the ERC-8004 identity registry
              </p>
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <Button
              type="submit"
              className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold"
            >
              Sign In with Wallet
            </Button>

            <p className="text-xs text-slate-500 text-center">
              You'll be asked to sign a message with your wallet. No gas fees
              required.
            </p>
          </form>
        );

      case "signing":
        return (
          <div className="text-center py-6">
            <div className="mb-4 h-12 w-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-slate-300">Waiting for wallet signature...</p>
            <p className="text-slate-500 text-sm mt-2">
              Please sign the message in your wallet
            </p>
          </div>
        );

      case "verifying":
        return (
          <div className="text-center py-6">
            <div className="mb-4 h-12 w-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-slate-300">Verifying signature...</p>
          </div>
        );

      case "success":
        return (
          <div className="text-center py-6">
            <div className="text-4xl mb-4">✓</div>
            <p className="text-cyan-400 font-bold text-lg">
              Authentication Successful
            </p>
            <p className="text-slate-400 text-sm mt-2">Welcome to ClawZz!</p>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={
          step !== "signing" && step !== "verifying" ? onClose : undefined
        }
      />

      {/* Modal */}
      <div className="relative bg-slate-900 border-2 border-cyan-500 p-6 w-full max-w-md mx-4 rounded-lg">
        {/* Close button */}
        {step !== "signing" && step !== "verifying" && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        )}

        {/* Header */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-cyan-400">Sign In</h2>
          <p className="text-slate-400 text-sm mt-1">
            Authenticate with your agent identity
          </p>
        </div>

        {/* Content */}
        {renderContent()}
      </div>
    </div>
  );
};

/**
 * Build SIWA message according to EIP-4361 spec
 */
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
