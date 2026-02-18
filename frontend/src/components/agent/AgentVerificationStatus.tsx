/**
 * Agent Verification Status Component
 *
 * Displays agent verification badge and status indicator
 * Used in agent profiles, host listings, and dashboards
 */

import React, { useState } from "react";
import { CheckCircle, AlertCircle, Clock, Shield } from "lucide-react";
import { AgentVerificationModal } from "@/components/verification/AgentVerificationModal";

interface VerificationStatusProps {
  agentId: string;
  verificationStatus: "verified" | "unverified" | "pending" | "suspended" | "banned";
  verifiedAt?: string | null;
  badge?: string | null;
  showModal?: boolean;
  compact?: boolean;
  onClick?: () => void;
}

export const AgentVerificationStatus: React.FC<VerificationStatusProps> = ({
  agentId,
  verificationStatus,
  verifiedAt,
  badge,
  showModal = false,
  compact = false,
  onClick,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(showModal);

  const handleOpenModal = () => {
    setIsModalOpen(true);
    onClick?.();
  };

  const statusConfig = {
    verified: {
      icon: CheckCircle,
      bgColor: "bg-green-50",
      borderColor: "border-green-200",
      textColor: "text-green-900",
      badgeColor: "bg-green-100 text-green-800",
      label: "Verified",
      description: "Identity verified on ERC-8004",
    },
    pending: {
      icon: Clock,
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200",
      textColor: "text-blue-900",
      badgeColor: "bg-blue-100 text-blue-800",
      label: "Pending",
      description: "Verification in progress",
    },
    unverified: {
      icon: AlertCircle,
      bgColor: "bg-yellow-50",
      borderColor: "border-yellow-200",
      textColor: "text-yellow-900",
      badgeColor: "bg-yellow-100 text-yellow-800",
      label: "Unverified",
      description: "Click to verify your identity",
    },
    suspended: {
      icon: Shield,
      bgColor: "bg-red-50",
      borderColor: "border-red-200",
      textColor: "text-red-900",
      badgeColor: "bg-red-100 text-red-800",
      label: "Suspended",
      description: "Account suspended",
    },
    banned: {
      icon: Shield,
      bgColor: "bg-red-50",
      borderColor: "border-red-200",
      textColor: "text-red-900",
      badgeColor: "bg-red-100 text-red-800",
      label: "Banned",
      description: "Account banned",
    },
  };

  const config = statusConfig[verificationStatus];
  const Icon = config.icon;

  if (compact) {
    return (
      <div
        onClick={handleOpenModal}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${config.badgeColor} cursor-pointer hover:opacity-75 transition text-sm font-semibold`}
      >
        <Icon size={14} />
        {config.label}
        <AgentVerificationModal
          agentId={agentId}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      </div>
    );
  }

  return (
    <div
      onClick={verificationStatus === "unverified" ? handleOpenModal : undefined}
      className={`border rounded-lg p-4 ${config.bgColor} ${config.borderColor} ${
        verificationStatus === "unverified" ? "cursor-pointer hover:opacity-75 transition" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <Icon className={config.textColor} size={20} />
        <div className="flex-1">
          <h4 className={`font-semibold ${config.textColor}`}>{config.label}</h4>
          <p className={`text-sm ${config.textColor} opacity-75`}>{config.description}</p>

          {verifiedAt && verificationStatus === "verified" && (
            <p className={`text-xs ${config.textColor} opacity-60 mt-2`}>
              Verified on {new Date(verifiedAt).toLocaleDateString()}
            </p>
          )}

          {badge && (
            <div className="mt-2">
              <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${config.badgeColor}`}>
                {badge}
              </span>
            </div>
          )}

          {verificationStatus === "unverified" && (
            <button
              onClick={handleOpenModal}
              className="mt-2 text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              Verify Now →
            </button>
          )}
        </div>
      </div>

      <AgentVerificationModal
        agentId={agentId}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
};
