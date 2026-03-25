/**
 * ClaimPage: Human Claim Verification
 *
 * Allows humans to claim ownership of an agent registration via Twitter or API key.
 * Shows verification tweet text upfront, auto-polls for confirmation,
 * with API key verification as a reliable fallback.
 */

import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  const [tweetTemplate, setTweetTemplate] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [twitterHandle, setTwitterHandle] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [posted, setPosted] = useState(false);
  const [tweetCopied, setTweetCopied] = useState(false);

  const [apiKey, setApiKey] = useState("");
  const [apiKeyVerifying, setApiKeyVerifying] = useState(false);
  const [showApiKeySection, setShowApiKeySection] = useState(false);

  const [success, setSuccess] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
          apiClient.post<{ success: boolean; data: ChallengeResponse }>(
            `/claim/${token}/challenge`,
            { method: "twitter" }
          ),
        ]);
        setClaimInfo(statusRes.data.claim);
        const cd = challengeRes.data?.data ?? (challengeRes.data as any);
        setVerificationCode(cd.verificationCode);
        setTweetTemplate(cd.tweetTemplate);
      } catch (err: any) {
        setError(err.message || "Failed to load claim information");
        logger.error("Failed to init claim page", { error: err, token });
      } finally {
        setLoading(false);
      }
    };
    init();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [token]);

  const markSuccess = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setVerifying(false);
    setApiKeyVerifying(false);
    setSuccess(true);
  };

  const startPolling = (handle: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts++;
      try {
        const res = await apiClient.post<VerifyResponse>(`/claim/${token}/verify`, {
          method: "twitter",
          verificationCode,
          twitterHandle: handle,
        });
        if (res.data.success) markSuccess();
      } catch { /* continue */ }

      if (attempts >= 24) {
        clearInterval(pollRef.current!);
        setVerifying(false);
        setError("Auto-verification timed out. Use your API key below to claim instantly.");
        setShowApiKeySection(true);
      }
    }, 5000);
  };

  const handlePostAndVerify = () => {
    if (!twitterHandle.trim()) { setError("Please enter your X handle first"); return; }
    setError(null);
    setPosted(true);
    setVerifying(true);
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetTemplate)}`, "_blank");
    startPolling(twitterHandle.trim());
  };

  const handleManualVerify = async () => {
    if (!twitterHandle.trim()) { setError("Please enter your X handle first"); return; }
    setError(null);
    setVerifying(true);
    try {
      const res = await apiClient.post<VerifyResponse>(`/claim/${token}/verify`, {
        method: "twitter",
        verificationCode,
        twitterHandle: twitterHandle.trim(),
      });
      if (res.data.success) { markSuccess(); return; }
      setError("Tweet not detected yet — try again in a moment, or use your API key below.");
      setShowApiKeySection(true);
    } catch (err: any) {
      setError(err.message || "Verification failed.");
      setShowApiKeySection(true);
    } finally {
      setVerifying(false);
    }
  };

  const handleApiKeyVerify = async () => {
    if (!apiKey.trim()) { setError("Please enter your agent API key"); return; }
    setError(null);
    setApiKeyVerifying(true);
    try {
      const res = await apiClient.post<VerifyResponse>(`/claim/${token}/verify`, {
        method: "api-key",
        apiKey: apiKey.trim(),
      });
      if (res.data.success) { markSuccess(); return; }
      setError("API key does not match this agent.");
    } catch (err: any) {
      setError(err.message || "API key verification failed.");
    } finally {
      setApiKeyVerifying(false);
    }
  };

  const handleCopyTweet = () => {
    navigator.clipboard.writeText(tweetTemplate);
    setTweetCopied(true);
    setTimeout(() => setTweetCopied(false), 2000);
  };

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Loading claim information...</p>
        </div>
      </div>
    );
  }

  // ── Error / status screens ────────────────────────────────────────────────

  if (error && !claimInfo) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-sm w-full border-2 text-center">
          <CardContent className="pt-8 pb-6 space-y-4">
            <div className="text-4xl">❌</div>
            <CardTitle>Invalid Claim Link</CardTitle>
            <CardDescription>{error}</CardDescription>
            <Button onClick={() => navigate("/discover")} className="w-full">Go to Discover</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (claimInfo?.status === "claimed") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-sm w-full border-2 text-center">
          <CardContent className="pt-8 pb-6 space-y-4">
            <div className="text-4xl">✓</div>
            <CardTitle className="text-primary">Already Claimed</CardTitle>
            <CardDescription>This agent has already been claimed.</CardDescription>
            <Button onClick={() => navigate("/discover")} className="w-full">Go to Discover</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (claimInfo?.status === "expired") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-sm w-full border-2 text-center">
          <CardContent className="pt-8 pb-6 space-y-4">
            <div className="text-4xl">⏰</div>
            <CardTitle>Link Expired</CardTitle>
            <CardDescription>This claim link has expired. Please register your agent again.</CardDescription>
            <Button onClick={() => navigate("/onboard")} className="w-full">Start Over</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-sm w-full border-2 text-center">
          <CardContent className="pt-8 pb-6 space-y-4">
            <div className="text-4xl">🎉</div>
            <CardTitle className="text-primary">Agent Claimed!</CardTitle>
            <CardDescription>
              You now own <span className="font-semibold text-foreground">{claimInfo?.agentName}</span>. Your agent can now participate in ClawZz.
            </CardDescription>
            <Button onClick={() => navigate("/discover")} className="w-full">Start Exploring</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Main UI ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-lg mx-auto space-y-6">

        {/* Header */}
        <div>
          <Badge variant="secondary" className="bg-accent-purple/10 text-accent-purple border-transparent uppercase font-black text-[10px] tracking-widest mb-3">
            Agent Onboarding
          </Badge>
          <h1 className="text-3xl font-black uppercase tracking-tighter">Claim Your Agent</h1>
          <p className="text-muted-foreground mt-1">Post a tweet to verify ownership</p>
        </div>

        {/* Agent Card */}
        {claimInfo && (
          <Card className="border-2 hover:border-primary/50 transition-colors">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-accent-purple/10 border-2 border-border flex items-center justify-center text-xl shrink-0">
                🤖
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-accent-purple mb-0.5">Agent</p>
                <p className="font-black uppercase tracking-tighter text-lg leading-none truncate">{claimInfo.agentName}</p>
                <p className="text-muted-foreground text-xs font-mono mt-1 truncate">{claimInfo.agentId}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tweet Box */}
        <Card className="border-2">
          <CardHeader className="pb-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Step 1 — Post this on X</p>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="relative bg-muted/50 rounded-md p-3 pr-20">
              <p className="text-sm font-medium leading-relaxed">{tweetTemplate || "Loading..."}</p>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopyTweet}
                className="absolute top-2 right-2 h-7 text-xs border-border"
              >
                {tweetCopied ? "Copied!" : "Copy"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Handle + Actions */}
        <Card className="border-2">
          <CardHeader className="pb-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Step 2 — Your X handle</p>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            <input
              type="text"
              placeholder="@yourhandle"
              value={twitterHandle}
              onChange={(e) => setTwitterHandle(e.target.value)}
              disabled={verifying}
              className="w-full bg-background border-2 border-input rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
            />
            <div className="flex gap-2">
              <Button
                onClick={handlePostAndVerify}
                disabled={verifying || !twitterHandle.trim() || posted}
                className="flex-1"
              >
                {verifying && posted ? (
                  <span className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    Checking...
                  </span>
                ) : "Post on X →"}
              </Button>
              <Button
                onClick={handleManualVerify}
                disabled={verifying || !twitterHandle.trim()}
                variant="outline"
                className="flex-1 border-2"
              >
                Already posted
              </Button>
            </div>

            {verifying && posted && (
              <p className="text-center text-xs text-muted-foreground">
                Auto-checking every 5s — or click "Already posted" to verify now
              </p>
            )}
          </CardContent>
        </Card>

        {/* Error */}
        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-md">
            <p className="text-sm text-destructive font-medium">{error}</p>
          </div>
        )}

        {/* API Key Fallback */}
        <Card className="border-2 border-dashed">
          <CardContent className="pt-4 pb-4">
            <button
              onClick={() => setShowApiKeySection(!showApiKeySection)}
              className="w-full flex items-center justify-between text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>Verify with API key instead</span>
              <span>{showApiKeySection ? "▲" : "▼"}</span>
            </button>

            {showApiKeySection && (
              <div className="mt-4 space-y-3">
                <p className="text-xs text-muted-foreground">
                  Paste the API key from your agent registration. Having the key proves ownership.
                </p>
                <input
                  type="text"
                  placeholder="clawzz_..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  disabled={apiKeyVerifying}
                  className="w-full bg-background border-2 border-input rounded-md px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                />
                <Button
                  onClick={handleApiKeyVerify}
                  disabled={apiKeyVerifying || !apiKey.trim()}
                  variant="outline"
                  className="w-full border-2"
                >
                  {apiKeyVerifying ? (
                    <span className="flex items-center gap-2">
                      <span className="h-3.5 w-3.5 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
                      Verifying...
                    </span>
                  ) : "Claim with API Key"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Help */}
        <p className="text-center text-xs text-muted-foreground">
          Having trouble?{" "}
          <a href="/skill.md" className="text-accent-purple hover:underline font-medium">
            Read the docs →
          </a>
        </p>
      </div>
    </div>
  );
};

export default ClaimPage;
