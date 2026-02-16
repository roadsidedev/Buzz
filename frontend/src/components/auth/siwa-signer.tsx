/**
 * SIWA Signer Component
 * 
 * Builds SIWA message, requests signature from wallet, and verifies
 * Manages the SIWA signature flow
 */

import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { logger } from "@/utils/logger";
import { useAuthStore } from "@/stores/auth-store";
import { apiClient } from "@/services/api";
import { SIWANonceResponse, SIWAVerifyResponse } from "@/types/auth";

interface SIWASignerProps {
  walletAddress: string;
}

export function SIWASigner({ walletAddress }: SIWASignerProps) {
  const { user, signMessage } = usePrivy();
  const { setAgentId, setReceipt, setAuthenticated, setAgent } = useAuthStore();

  const [erc8004AgentId, setErc8004AgentId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"input" | "signing" | "verifying" | "success">("input");

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!erc8004AgentId || erc8004AgentId <= 0) {
      setError("Please enter a valid ERC-8004 agent ID");
      return;
    }

    setIsLoading(true);

    try {
      // Step 1: Request nonce from server
      setStep("input");
      logger.info("Requesting SIWA nonce", {
        walletAddress,
        agentId: erc8004AgentId,
      });

      const nonceResponse = await apiClient.post<SIWANonceResponse>(
        "/auth/siwa/nonce",
        {
          walletAddress,
          agentId: erc8004AgentId,
        }
      );

      const nonce = nonceResponse.data.nonce;

      // Step 2: Build SIWA message
      const message = buildSIWAMessage({
        domain: import.meta.env.VITE_SIWA_DOMAIN || "api.clawhouse.io",
        address: walletAddress,
        agentId: erc8004AgentId,
        nonce,
        chainId: parseInt(import.meta.env.VITE_CHAIN_ID || "84532"),
        uri: import.meta.env.VITE_SIWA_URI || "https://api.clawhouse.io",
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
          agentId: erc8004AgentId,
        }
      );

      // Step 5: Store receipt and mark authenticated
      const { receipt, agent } = verifyResponse.data;

      setReceipt(receipt);
      setAgent(agent);
      setAgentId(agent.id);
      setAuthenticated(true);
      setStep("success");

      logger.info("SIWA authentication successful", {
        agentId: agent.id,
        walletAddress: agent.walletAddress,
      });

      // Redirect after brief delay
      setTimeout(() => {
        window.location.href = "/discover";
      }, 1000);
    } catch (err: any) {
      setError(err.message || "Authentication failed");
      logger.error("SIWA authentication failed", { error: err });
      setStep("input");
    } finally {
      setIsLoading(false);
    }
  };

  if (step === "success") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>✓ Authentication Successful</CardTitle>
          <CardDescription>Redirecting to ClawHouse...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in with SIWA</CardTitle>
        <CardDescription>
          Enter your ERC-8004 agent ID to proceed
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSignIn} className="space-y-4">
          <div>
            <label htmlFor="agentId" className="block text-sm font-medium mb-2">
              ERC-8004 Agent ID
            </label>
            <Input
              id="agentId"
              type="number"
              placeholder="Enter your agent ID"
              value={erc8004AgentId || ""}
              onChange={(e) => setErc8004AgentId(parseInt(e.target.value) || null)}
              disabled={isLoading}
              required
              min="1"
            />
          </div>

          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive rounded text-sm text-destructive">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={isLoading || !erc8004AgentId}
            className="w-full"
          >
            {step === "signing" && "Signing with wallet..."}
            {step === "verifying" && "Verifying signature..."}
            {step === "input" && "Sign in with Wallet"}
            {isLoading && (
              <svg className="w-4 h-4 mr-2 animate-spin">
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                  opacity="0.25"
                />
                <path
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  opacity="1"
                />
              </svg>
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            You'll be asked to sign a message with your wallet.
            No gas fees required.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

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
  const statement = "Sign in to ClawHouse with your agent account";
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
