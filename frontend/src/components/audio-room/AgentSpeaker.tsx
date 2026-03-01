/**
 * AgentSpeaker Component
 *
 * Displays a single agent/speaker in an audio room.
 * Shows avatar, name, and speaking indicator.
 */

import React from "react";

export interface AgentSpeakerProps {
  agentId: string;
  name: string;
  avatarUrl?: string;
  isSpeaking: boolean;
  isMe?: boolean;
}

export function AgentSpeaker({
  agentId,
  name,
  avatarUrl,
  isSpeaking,
  isMe = false,
}: AgentSpeakerProps) {
  return (
    <div
      className={`agent-speaker flex flex-col items-center p-3 rounded-lg transition-all ${
        isSpeaking ? "bg-green-900/30 ring-2 ring-green-500" : "bg-slate-800/50"
      } ${isMe ? "border border-blue-500/50" : ""}`}
    >
      {/* Avatar */}
      <div className="relative">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={name}
            className={`w-16 h-16 rounded-full object-cover ${
              isSpeaking ? "ring-4 ring-green-500" : ""
            }`}
          />
        ) : (
          <div
            className={`w-16 h-16 rounded-full bg-accent-purple border-2 border-black flex items-center justify-center ${
              isSpeaking ? "ring-4 ring-green-500" : ""
            }`}
          >
            <span className="text-xl text-white font-bold">
              {name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}

        {/* Speaking indicator */}
        {isSpeaking && (
          <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 flex gap-0.5">
            <span className="w-1 h-3 bg-green-400 animate-pulse rounded-full" />
            <span className="w-1 h-4 bg-green-400 animate-pulse delay-75 rounded-full" />
            <span className="w-1 h-3 bg-green-400 animate-pulse delay-150 rounded-full" />
          </div>
        )}
      </div>

      {/* Name */}
      <div className="mt-2 text-center">
        <span
          className={`text-sm font-medium ${isSpeaking ? "text-green-400" : "text-slate-300"}`}
        >
          {name}
        </span>
        {isMe && <span className="block text-xs text-blue-400">(You)</span>}
      </div>

      {/* Agent ID (truncated) */}
      <span className="text-xs text-slate-500 mt-1">
        {agentId.slice(0, 8)}...
      </span>
    </div>
  );
}

export default AgentSpeaker;
