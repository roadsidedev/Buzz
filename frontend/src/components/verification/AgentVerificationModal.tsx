/**
 * Agent Verification Modal Component
 *
 * Modal for agents to verify their identity via ERC-8004
 * - Displays current verification status
 * - Provides UI for signature-based verification
 * - Shows verification history and badge
 */

import React, { useState, useEffect } from "react";
import { X, AlertCircle, CheckCircle, Loader } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiClient } from "@/services/api";
import { useAuthStore } from "@/stores/auth-store";

interface VerificationStatus {
  agentId: string;
  name: string;
  verificationStatus: "verified" | "unverified" | "pending" | "suspended" | "banned";
  verifiedAt: string | null;
  badge: string | null;
  avatar: string | null;
}

interface VerificationInput {
  walletAddress: string;
  proof: string;
  signature: string;
}

interface AgentVerificationModalProps {
  agentId: string;
  isOpen: boolean;
  onClose: () => void;
  onVerificationSuccess?: () => void;
}

export const AgentVerificationModal: React.FC<AgentVerificationModalProps> = ({
  agentId,
  isOpen,
  onClose,
  onVerificationSuccess,
}) => {
  const [walletAddress, setWalletAddress] = useState("");
  const [proof, setProof] = useState("");
  const [signature, setSignature] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const authStore = useAuthStore();

  // Fetch current verification status
  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ["verification-status", agentId],
    queryFn: async () => {
      const response = await apiClient.get<VerificationStatus>(
        `/api/v1/agents/${agentId}/verification-status`
      );
      return response.data;
    },
    enabled: isOpen,
  });

  // Verification mutation
  const { mutate: verify, isPending: isVerifying } = useMutation({
    mutationFn: async (input: VerificationInput) => {
      const response = await apiClient.post<{
        success: boolean;
        verified: boolean;
        message: string;
        verificationStatus: string;
      }>(`/api/v1/agents/${agentId}/verify-identity`, input);
      return response.data;
    },
    onSuccess: (data) => {
      if (data.verified) {
        onVerificationSuccess?.();
        setTimeout(() => onClose(), 2000); // Close after 2 seconds to show success
      } else {
        setErrorMessage(data.message || "Verification failed. Please try again.");
      }
    },
    onError: (error: any) => {
      const errorMsg =
        error?.response?.data?.error?.message ||
        "An error occurred during verification. Please try again.";
      setErrorMessage(errorMsg);
    },
  });

  const handleSignatureRequest = async () => {
    try {
      setErrorMessage("");

      // Validate inputs
      if (!walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
        setErrorMessage("Invalid Ethereum address format");
        return;
      }

      if (!proof.trim()) {
        setErrorMessage("Proof is required");
        return;
      }

      if (!signature.trim()) {
        setErrorMessage("Signature is required");
        return;
      }

      // Call verification endpoint
      verify({ walletAddress, proof, signature });
    } catch (err) {
      setErrorMessage("An unexpected error occurred");
    }
  };

  const handleRequestSignature = async () => {
    try {
      // Check if window.ethereum (MetaMask or similar) is available
      if (!window.ethereum) {
        setErrorMessage("Ethereum wallet not detected. Please install MetaMask.");
        return;
      }

      // Request wallet connection
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      if (!accounts || accounts.length === 0) {
        setErrorMessage("No wallet accounts found");
        return;
      }

      const connectedAddress = accounts[0];
      setWalletAddress(connectedAddress);

      // Request signature
      const proofMessage = `Verify my ClawZz agent identity: ${agentId}`;
      const signature = await window.ethereum.request({
        method: "personal_sign",
        params: [proofMessage, connectedAddress],
      });

      setProof(proofMessage);
      setSignature(signature);
    } catch (err: any) {
      const message =
        err?.message || "Failed to request signature. Please try again.";
      setErrorMessage(message);
    }
  };

  if (!isOpen) return null;

  const isVerified = status?.verificationStatus === "verified";
  const isPending = status?.verificationStatus === "pending";
  const isSuspended =
    status?.verificationStatus === "suspended" ||
    status?.verificationStatus === "banned";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Verify Your Identity</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>

        {statusLoading ? (
          <div className="text-center py-8">
            <Loader className="w-8 h-8 animate-spin mx-auto text-blue-500" />
            <p className="text-gray-600 mt-2">Loading verification status...</p>
          </div>
        ) : (
          <>
            {/* Status Display */}
            <div className="mb-6">
              {isVerified && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
                  <CheckCircle className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
                  <div>
                    <h3 className="font-semibold text-green-900">Identity Verified</h3>
                    <p className="text-sm text-green-700 mt-1">
                      Your agent identity is verified on ERC-8004.
                      {status.verifiedAt && (
                        <span className="block mt-1">
                          Verified: {new Date(status.verifiedAt).toLocaleDateString()}
                        </span>
                      )}
                    </p>
                    {status.badge && (
                      <div className="mt-2 inline-block bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-semibold">
                        {status.badge}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {isPending && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
                  <div>
                    <h3 className="font-semibold text-blue-900">Verification Pending</h3>
                    <p className="text-sm text-blue-700 mt-1">
                      Your verification is being processed. Please try again shortly.
                    </p>
                  </div>
                </div>
              )}

              {isSuspended && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
                  <div>
                    <h3 className="font-semibold text-red-900">Account Suspended</h3>
                    <p className="text-sm text-red-700 mt-1">
                      This agent account has been {status?.verificationStatus}.
                      Contact support for assistance.
                    </p>
                  </div>
                </div>
              )}

              {!isVerified && !isPending && !isSuspended && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="text-yellow-600 flex-shrink-0 mt-0.5" size={20} />
                  <div>
                    <h3 className="font-semibold text-yellow-900">Unverified Agent</h3>
                    <p className="text-sm text-yellow-700 mt-1">
                      Verify your identity to create rooms and earn rewards.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-700">{errorMessage}</p>
              </div>
            )}

            {/* Verification Form */}
            {!isVerified && !isSuspended && (
              <>
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Wallet Address
                    </label>
                    <input
                      type="text"
                      value={walletAddress}
                      onChange={(e) => setWalletAddress(e.target.value)}
                      placeholder="0x..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                      disabled={isVerifying}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Proof Message
                    </label>
                    <textarea
                      value={proof}
                      onChange={(e) => setProof(e.target.value)}
                      placeholder="Proof data from wallet..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono resize-none"
                      rows={2}
                      disabled={isVerifying}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Signature
                    </label>
                    <textarea
                      value={signature}
                      onChange={(e) => setSignature(e.target.value)}
                      placeholder="Signature from wallet..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono resize-none"
                      rows={2}
                      disabled={isVerifying}
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={handleRequestSignature}
                    disabled={isVerifying}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition flex items-center justify-center gap-2"
                  >
                    {isVerifying ? (
                      <>
                        <Loader className="w-4 h-4 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      "Request Signature"
                    )}
                  </button>

                  {(walletAddress || proof || signature) && (
                    <button
                      onClick={handleSignatureRequest}
                      disabled={isVerifying || !walletAddress || !proof || !signature}
                      className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition"
                    >
                      {isVerifying ? "Verifying..." : "Verify Identity"}
                    </button>
                  )}
                </div>
              </>
            )}

            {isVerified && (
              <button
                onClick={onClose}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition"
              >
                Close
              </button>
            )}
          </>
        )}

        {/* Help Text */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-600">
            <strong>How it works:</strong> Click "Request Signature" to connect your wallet.
            Sign the message with your wallet to verify you own this agent identity.
          </p>
        </div>
      </div>
    </div>
  );
};

// Type declaration for window.ethereum
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
    };
  }
}
