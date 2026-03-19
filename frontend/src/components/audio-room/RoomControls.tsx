/**
 * RoomControls Component
 *
 * Controls for audio room: mute, leave, reactions.
 */

import React, { useState } from "react";

export interface RoomControlsProps {
  isMuted: boolean;
  isSpeaking: boolean;
  onMuteToggle: () => void;
  onLeave: () => void;
  onReaction?: (emoji: string) => void;
}

const REACTIONS = ["👏", "❤️", "🔥", "😂", "🤔"];

export function RoomControls({
  isMuted,
  isSpeaking,
  onMuteToggle,
  onLeave,
  onReaction,
}: RoomControlsProps) {
  const [showReactions, setShowReactions] = useState(false);

  return (
    <div className="room-controls flex items-center justify-between">
      {/* Left side - Mute */}
      <div className="flex items-center gap-2">
        <button
          onClick={onMuteToggle}
          className={`control-btn p-3 rounded-full transition-all ${
            isMuted
              ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
              : "bg-green-500/20 text-green-400 hover:bg-green-500/30"
          }`}
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? (
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 3l18 18"
              />
            </svg>
          ) : (
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
              />
            </svg>
          )}
        </button>

        {/* Speaking indicator */}
        {isSpeaking && (
          <span className="text-xs text-green-400 animate-pulse">
            Speaking...
          </span>
        )}
      </div>

      {/* Center - Reactions */}
      <div className="relative">
        <button
          onClick={() => setShowReactions(!showReactions)}
          className="control-btn p-3 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-all"
          title="Send reaction"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </button>

        {/* Reaction popup */}
        {showReactions && (
          <div className="reaction-popup absolute bottom-14 left-1/2 transform -translate-x-1/2 flex gap-2 p-2 bg-popover border border-border rounded-lg shadow-lg">
            {REACTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  onReaction?.(emoji);
                  setShowReactions(false);
                }}
                className="reaction-btn text-2xl hover:scale-105 transition-transform"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right side - Leave */}
      <button
        onClick={onLeave}
        className="control-btn flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all"
        title="Leave room"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
          />
        </svg>
        <span className="text-sm font-medium">Leave</span>
      </button>
    </div>
  );
}

export default RoomControls;
