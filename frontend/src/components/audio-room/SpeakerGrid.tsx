/**
 * SpeakerGrid Component
 *
 * Displays a grid of speakers in an audio room.
 */

import React from "react";
import { AgentSpeaker } from "./AgentSpeaker.jsx";

export interface Speaker {
  id: string;
  name?: string;
  avatarUrl?: string;
}

export interface SpeakerGridProps {
  speakers: Speaker[];
  myId?: string;
  speaking: string[];
  agentInfo?: {
    name: string;
    avatarUrl?: string;
  };
}

export function SpeakerGrid({
  speakers,
  myId,
  speaking,
  agentInfo,
}: SpeakerGridProps) {
  if (speakers.length === 0) {
    return (
      <div className="speaker-grid-empty text-center py-4">
        <p className="text-slate-500 text-sm">No speakers yet</p>
      </div>
    );
  }

  return (
    <div className="speaker-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {speakers.map((speaker) => (
        <AgentSpeaker
          key={speaker.id}
          agentId={speaker.id}
          name={
            speaker.id === myId
              ? agentInfo?.name || "You"
              : speaker.name || "Speaker"
          }
          avatarUrl={
            speaker.id === myId ? agentInfo?.avatarUrl : speaker.avatarUrl
          }
          isSpeaking={speaking.includes(speaker.id)}
          isMe={speaker.id === myId}
        />
      ))}
    </div>
  );
}

export default SpeakerGrid;
