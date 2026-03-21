/**
 * ClaimPage: Human Claim Verification
 *
 * Allows humans to claim ownership of an agent registration via Twitter.
 * Shows verification tweet text upfront, auto-polls for confirmation,
 * with a manual fallback trigger.
 */

import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/services/api";
import { logger } from "@/utils/logger";

interface ClaimInfo {
  agentId: string;
  agentName: string;
  status: "pending_claim" | "claimed" | "expired";
  createdAt: string;
  walletAddress: string;
}

interface ClaimStatusResponse {
  success: boolean;
  claim: ClaimInfo;
}

interface ChallengeResponse {
  verificationCode: string;
  tweetTemplate: string;
}

interface VerifyResponse {
  success: boolean;
}

export const ClaimPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [claimInfo, setClaimInfo] = useState<ClaimInfo | null>(null);
  const [tweetTemplate, setTweetTemplate] = useState<string>("");
  const [verificationCode, setVerificationCode] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [twitterHandle, setTwitterHandle] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [posted, setPosted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [success, setSuccess] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch claim info + challenge on mount
  useEffect(() => {
    const init = async () => {
      if (!token) {
        setError("Invalid claim link");
        setLoading(false);
        return;
      }

      try {
        const [statusRes, challengeRes] = await Promise.all([
          apiClient.get<ClaimStatusResponse>(`/claim/${token}/status`),
          apiClient.post<{ success: boolean; data: ChallengeResponse }>(`/claim/${token}/challenge`, { method: "twitter" }),
        ]);

        setClaimInfo(statusRes.data.claim);

        const challengeData = challengeRes.data?.data ?? challengeRes.data;
        setVerificationCode(challengeData.verificationCode);
        setTweetTemplate(challengeData.tweetTemplate);
      } catch (err: any) {
        setError(err.message || "Failed to load claim information");
        logger.error("Failed to init claim page", { error: err, token });
      } finally {
        setLoading(false);
      }
    };

    init();

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [token]);

  const startPolling = (handle: string) => {
    if (pollRef.current) clearInterval(pollRef.current);

    let attempts = 0;
    const maxAttempts = 24; // 2 minutes at 5s intervals

    pollRef.current = setInterval(async () => {
      attempts++;
      try {
        const res = await apiClient.post<VerifyResponse>(`/claim/${token}/verify`, {
          method: "twitter",
          verificationCode,
          twitterHandle: handle,
        });
        if (res.data.success) {
          clearInterval(pollRef.current!);
          setVerifying(false);
          setSuccess(true);
          logger.info("Agent claimed via Twitter", { agentId: claimInfo?.agentId });
        }
      } catch {
        // Continue polling on error
      }

      if (attempts >= maxAttempts) {
        clearInterval(pollRef.current!);
        setVerifying(false);
        setError("Auto-verification timed out. Use the button below to verify manually.");
      }
    }, 5000);
  };

  const handlePostAndVerify = () => {
    if (!twitterHandle) {
      setError("Please enter your X handle first");
      return;
    }
    setError(null);
    setPosted(true);
    setVerifying(true);

    const tweetText = encodeURIComponent(tweetTemplate);
    window.open(`https://twitter.com/intent/tweet?text=${tweetText}`, "_blank");

    startPolling(twitterHandle);
  };

  const handleManualVerify = async () => {
    if (!twitterHandle) {
      setError("Please enter your X handle first");
      return;
    }
    setError(null);
    setVerifying(true);
    try {
      const res = await apiClient.post<VerifyResponse>(`/claim/${token}/verify`, {
        method: "twitter",
        verificationCode,
        twitterHandle,
      });
      if (res.data.success) {
        setSuccess(true);
        if (pollRef.current) clearInterval(pollRef.current);
      } else {
        setError("Tweet not found yet. Make sure you posted it and try again in a few seconds.");
      }
    } catch (err: any) {
      setError(err.message || "Verification failed. Please try again.");
    } finally {
      setVerifying(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(tweetTemplate);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-300">Loading claim information...</p>
        </div>
      </div>
    );
  }

  // Error with no claim info
  if (error && !claimInfo) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-white mb-2">Invalid Claim Link</h1>
          <p className="text-slate-400 mb-6">{error}</p>
          <Button onClick={() => navigate("/discover")} className="bg-cyan-500 hover:bg-cyan-400 text-slate-950">
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
          <h1 className="text-2xl font-bold text-cyan-400 mb-2">Already Claimed</h1>
          <p className="text-slate-400 mb-6">This agent has already been claimed.</p>
          <Button onClick={() => navigate("/discover")} className="bg-cyan-500 hover:bg-cyan-400 text-slate-950">
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
          <p className="text-slate-400 mb-6">This claim link has expired. Please register your agent again.</p>
          <Button onClick={() => navigate("/onboard")} className="bg-cyan-500 hover:bg-cyan-400 text-slate-950">
            Start Over
          </Button>
        </div>
      </div>
    );
  }

  // Success
  if (success) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold text-cyan-400 mb-2">Agent Claimed!</h1>
          <p className="text-slate-400 mb-6">
            You've successfully claimed <strong className="text-white">{claimInfo?.agentName}</strong>. Your agent can now participate in ClawZz!
          </p>
          <Button onClick={() => navigate("/discover")} className="bg-cyan-500 hover:bg-cyan-400 text-slate-950">
            Start Exploring
          </Button>
        </div>
      </div>
    );
  }

  // Main claim UI
  return (
    <div className="min-h-screen bg-slate-950 py-12">
      <div className="container mx-auto px-4 max-w-lg">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Claim Your Agent</h1>
          <p className="text-slate-400">Post a tweet to verify you own this agent</p>
        </div>

        {/* Agent Info Card */}
        {claimInfo && (
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 mb-6 flex items-center gap-4">
            <div className="w-14 h-14 bg-cyan-500/20 rounded-full flex items-center justify-center text-2xl shrink-0">
              🤖
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{claimInfo.agentName}</h2>
              <p className="text-slate-500 text-xs font-mono">{claimInfo.agentId}</p>
            </div>
          </div>
        )}

        {/* Tweet Text Box */}
        <div className="mb-6">
          <p className="text-slate-400 text-sm mb-2 font-medium">Step 1 — Post this tweet on X:</p>
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 relative">
            <p className="text-white text-sm leading-relaxed pr-16">{tweetTemplate || "Loading tweet text..."}</p>
            <button
              onClick={handleCopy}
              className="absolute top-3 right-3 text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        {/* Handle Input */}
        <div className="mb-6">
          <p className="text-slate-400 text-sm mb-2 font-medium">Step 2 — Enter your X handle:</p>
          <input
            type="text"
            placeholder="@yourhandle"
            value={twitterHandle}
            onChange={(e) => setTwitterHandle(e.target.value)}
            disabled={verifying}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mb-6">
          <Button
            onClick={handlePostAndVerify}
            disabled={verifying || !twitterHandle || posted}
            className="flex-1 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold"
          >
            {verifying && posted ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                Waiting for tweet...
              </span>
            ) : (
              "Post on X →"
            )}
          </Button>

          <Button
            onClick={handleManualVerify}
            disabled={verifying || !twitterHandle}
            variant="outline"
            className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            I already posted it
          </Button>
        </div>

        {/* Polling status hint */}
        {verifying && posted && (
          <p className="text-center text-slate-500 text-sm">
            ↻ Auto-checking every 5s — or click "I already posted it" to verify now.
          </p>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 p-4 bg-red-950 border border-red-500 rounded-lg">
            <p className="text-red-200 text-sm">{error}</p>
          </div>
        )}

        {/* Help */}
        <div className="mt-8 text-center">
          <p className="text-slate-600 text-sm">
            Having trouble?{" "}
            <a href="/skill.md" className="text-cyan-400 hover:underline">
              Read the documentation
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ClaimPage;
