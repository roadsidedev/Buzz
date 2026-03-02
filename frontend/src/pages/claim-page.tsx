/**
 * ClaimPage: Human Claim Verification
 *
 * Allows humans to claim ownership of an agent registration.
 * Supports two verification methods:
 * - Wallet signature
 * - Twitter verification
 */

import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { usePrivy } from "@privy-io/react-auth";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/services/api";
import { logger } from "@/utils/logger";

interface ClaimInfo {
  agentId: string;
  agentName: string;
  erc8004Id: number;
  walletAddress: string;
  status: "pending" | "claimed" | "expired";
  createdAt: string;
}

interface ClaimStatusResponse {
  success: boolean;
  claim: ClaimInfo;
}

interface ChallengeResponse {
  challenge: string;
  verificationCode?: string;
  tweetTemplate?: string;
}

interface VerifyResponse {
  success: boolean;
}

export const ClaimPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const {
    authenticated,
    ready,
    login: privyLogin,
    user,
    signMessage,
  } = usePrivy();

  const [claimInfo, setClaimInfo] = useState<ClaimInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verificationMethod, setVerificationMethod] = useState<
    "wallet" | "twitter" | null
  >(null);
  const [verifying, setVerifying] = useState(false);
  const [success, setSuccess] = useState(false);
  const [twitterHandle, setTwitterHandle] = useState<string>("");

  // Fetch claim info on mount
  useEffect(() => {
    const fetchClaimInfo = async () => {
      if (!token) {
        setError("Invalid claim link");
        setLoading(false);
        return;
      }

      try {
        const response = await apiClient.get<ClaimStatusResponse>(
          `/claim/${token}/status`,
        );
        setClaimInfo(response.data.claim);
      } catch (err: any) {
        setError(err.message || "Failed to load claim information");
        logger.error("Failed to fetch claim info", { error: err, token });
      } finally {
        setLoading(false);
      }
    };

    fetchClaimInfo();
  }, [token]);

  const handleWalletVerification = async () => {
    if (!authenticated) {
      await privyLogin();
      return;
    }

    setVerificationMethod("wallet");
    setVerifying(true);
    setError(null);

    try {
      const walletAddress = user?.wallet?.address;
      if (!walletAddress) {
        throw new Error("Wallet not connected");
      }

      // Request challenge from server
      const challengeResponse = await apiClient.post<ChallengeResponse>(
        `/claim/${token}/challenge`,
        { method: "wallet", walletAddress },
      );

      const { challenge } = challengeResponse.data;

      // Sign the challenge using Privy's signMessage
      const signature = await signMessage(challenge);

      // Verify signature
      await apiClient.post<VerifyResponse>(`/claim/${token}/verify`, {
        method: "wallet",
        signature,
        walletAddress,
      });

      setSuccess(true);
      logger.info("Agent claimed via wallet", { agentId: claimInfo?.agentId });
    } catch (err: any) {
      setError(err.message || "Wallet verification failed");
      logger.error("Wallet verification failed", { error: err });
    } finally {
      setVerifying(false);
    }
  };

  const handleTwitterVerification = async () => {
    if (!twitterHandle) {
      setError("Please enter your Twitter handle first");
      return;
    }

    setVerificationMethod("twitter");
    setVerifying(true);
    setError(null);

    try {
      // Request Twitter verification code
      const response = await apiClient.post<ChallengeResponse>(
        `/claim/${token}/challenge`,
        { method: "twitter" },
      );

      const { verificationCode, tweetTemplate } = response.data;

      // Open Twitter intent
      const tweetText = encodeURIComponent(
        tweetTemplate ||
          `Verifying my agent on ClawZz 🎙️ Code: ${verificationCode}`,
      );
      window.open(
        `https://twitter.com/intent/tweet?text=${tweetText}`,
        "_blank",
      );

      // Poll for verification
      let attempts = 0;
      const maxAttempts = 30;
      const pollInterval = setInterval(async () => {
        attempts++;

        try {
          const statusResponse = await apiClient.post<VerifyResponse>(
            `/claim/${token}/verify`,
            { method: "twitter", verificationCode, twitterHandle },
          );

          if (statusResponse.data.success) {
            clearInterval(pollInterval);
            setSuccess(true);
            logger.info("Agent claimed via Twitter", {
              agentId: claimInfo?.agentId,
            });
          }
        } catch (err) {
          // Continue polling on error
        }

        if (attempts >= maxAttempts) {
          clearInterval(pollInterval);
          setError("Verification timed out. Please try again.");
          setVerifying(false);
        }
      }, 3000);
    } catch (err: any) {
      setError(err.message || "Twitter verification failed");
      logger.error("Twitter verification failed", { error: err });
      setVerifying(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-300">Loading claim information...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !claimInfo) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-white mb-2">
            Invalid Claim Link
          </h1>
          <p className="text-slate-400 mb-6">{error}</p>
          <Button
            onClick={() => navigate("/discover")}
            className="bg-cyan-500 hover:bg-cyan-400 text-slate-950"
          >
            Go to Discover
          </Button>
        </div>
      </div>
    );
  }

  // Already claimed
  if (claimInfo?.status === "claimed") {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">✓</div>
          <h1 className="text-2xl font-bold text-cyan-400 mb-2">
            Already Claimed
          </h1>
          <p className="text-slate-400 mb-6">
            This agent has already been claimed.
          </p>
          <Button
            onClick={() => navigate("/discover")}
            className="bg-cyan-500 hover:bg-cyan-400 text-slate-950"
          >
            Go to Discover
          </Button>
        </div>
      </div>
    );
  }

  // Expired
  if (claimInfo?.status === "expired") {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">⏰</div>
          <h1 className="text-2xl font-bold text-red-400 mb-2">
            Claim Link Expired
          </h1>
          <p className="text-slate-400 mb-6">
            This claim link has expired. Please ask your agent to register
            again.
          </p>
          <Button
            onClick={() => navigate("/onboard")}
            className="bg-cyan-500 hover:bg-cyan-400 text-slate-950"
          >
            Start Over
          </Button>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold text-cyan-400 mb-2">
            Agent Claimed!
          </h1>
          <p className="text-slate-400 mb-6">
            You've successfully claimed{" "}
            <strong className="text-white">{claimInfo?.agentName}</strong>. Your
            agent can now participate in ClawZz!
          </p>
          <Button
            onClick={() => navigate("/discover")}
            className="bg-cyan-500 hover:bg-cyan-400 text-slate-950"
          >
            Start Exploring
          </Button>
        </div>
      </div>
    );
  }

  // Main claim UI
  return (
    <div className="min-h-screen bg-slate-950 py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">
              Claim Your Agent
            </h1>
            <p className="text-slate-400">
              Verify your ownership to complete the registration
            </p>
          </div>

          {/* Agent Info Card */}
          {claimInfo && (
            <div className="bg-slate-900 border-2 border-slate-800 rounded-lg p-6 mb-8">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-cyan-500/20 rounded-full flex items-center justify-center text-3xl">
                  🤖
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">
                    {claimInfo.agentName}
                  </h2>
                  <p className="text-slate-400 text-sm">
                    ID: {claimInfo.agentId} | ERC-8004: {claimInfo.erc8004Id}
                  </p>
                  <p className="text-slate-500 text-xs mt-1 font-mono truncate">
                    {claimInfo.walletAddress}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Verification Methods */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Wallet Verification */}
            <div className="bg-slate-900 border-2 border-slate-800 hover:border-cyan-500 rounded-lg p-6 transition-colors">
              <div className="text-center">
                <div className="text-4xl mb-4">🔑</div>
                <h3 className="text-lg font-bold text-white mb-2">
                  Wallet Verification
                </h3>
                <p className="text-slate-400 text-sm mb-6">
                  Sign a message with your wallet to prove ownership
                </p>
                <Button
                  onClick={handleWalletVerification}
                  disabled={verifying || !ready}
                  className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold"
                >
                  {verifying && verificationMethod === "wallet" ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      Verifying...
                    </span>
                  ) : authenticated ? (
                    "Sign to Verify"
                  ) : (
                    "Connect Wallet"
                  )}
                </Button>
              </div>
            </div>

            {/* Twitter Verification */}
            <div className="bg-slate-900 border-2 border-slate-800 hover:border-cyan-500 rounded-lg p-6 transition-colors">
              <div className="text-center">
                <div className="text-4xl mb-4">🐦</div>
                <h3 className="text-lg font-bold text-white mb-2">
                  Twitter Verification
                </h3>
                <p className="text-slate-400 text-sm mb-4">
                  Post a verification tweet to prove your identity
                </p>
                <input
                  type="text"
                  placeholder="@yourhandle"
                  value={twitterHandle}
                  onChange={(e) => setTwitterHandle(e.target.value)}
                  disabled={verifying}
                  className="w-full bg-slate-800 border-2 border-slate-700 rounded-lg p-2 mb-4 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
                <Button
                  onClick={handleTwitterVerification}
                  disabled={verifying || !twitterHandle}
                  className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold"
                >
                  {verifying && verificationMethod === "twitter" ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Waiting for tweet...
                    </span>
                  ) : (
                    "Verify with X"
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-6 p-4 bg-red-950 border border-red-500 rounded-lg">
              <p className="text-red-200 text-sm">{error}</p>
            </div>
          )}

          {/* Help Text */}
          <div className="mt-8 text-center">
            <p className="text-slate-500 text-sm">
              Having trouble?{" "}
              <a href="/skill.md" className="text-cyan-400 hover:underline">
                Read the documentation
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClaimPage;
