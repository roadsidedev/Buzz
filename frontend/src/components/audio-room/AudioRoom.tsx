/**
 * AudioRoom Component
 *
 * Main container for self-hosted Jam audio rooms.
 * Uses custom useJamRoom hook for WebRTC audio streaming.
 */

import React, { useEffect, useState, useCallback } from "react";
import { useJamRoom } from "@/hooks/useJamRoom.js";
import { SpeakerGrid } from "./SpeakerGrid.jsx";
import { ListenerList } from "./ListenerList.jsx";
import { RoomControls } from "./RoomControls.jsx";
import { AgentSpeaker } from "./AgentSpeaker.jsx";

export interface AudioRoomProps {
  roomId: string;
  agentId: string;
  agentKeyPair: {
    publicKey: string;
    privateKey: string;
  };
  agentInfo?: {
    name: string;
    avatarUrl?: string;
  };
  onLeave?: () => void;
  onError?: (error: Error) => void;
}

export function AudioRoom({
  roomId,
  agentId,
  agentKeyPair,
  agentInfo,
  onLeave,
  onError,
}: AudioRoomProps) {
  const {
    inRoom,
    speakers,
    listeners,
    speaking,
    isMuted,
    isSpeaking,
    myId,
    connect,
    disconnect,
    toggleMute,
    sendReaction,
    error: jamError,
    isLoading,
  } = useJamRoom({
    roomId,
    publicKey: agentKeyPair.publicKey,
    privateKey: agentKeyPair.privateKey,
    autoJoin: true,
  });

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (jamError) {
      setError(jamError);
      onError?.(new Error(jamError));
    }
  }, [jamError, onError]);

  const handleLeave = useCallback(() => {
    disconnect();
    onLeave?.();
  }, [disconnect, onLeave]);

  const handleMuteToggle = useCallback(() => {
    toggleMute();
  }, [toggleMute]);

  const handleReaction = useCallback(
    (emoji: string) => {
      sendReaction(emoji);
    },
    [sendReaction],
  );

  if (error) {
    return (
      <div className="audio-room-error p-4 bg-red-50 rounded-lg">
        <p className="text-red-600">Failed to join room: {error}</p>
        <button
          onClick={() => {
            setError(null);
            connect();
          }}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded"
        >
          Retry
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="audio-room-loading p-4">
        <div className="animate-pulse flex space-x-4">
          <div className="rounded-full bg-slate-200 h-10 w-10"></div>
          <div className="flex-1 space-y-2 py-1">
            <div className="h-2 bg-slate-200 rounded"></div>
            <div className="h-2 bg-slate-200 rounded w-3/4"></div>
          </div>
        </div>
        <p className="mt-2 text-slate-500">Connecting to audio room...</p>
      </div>
    );
  }

  return (
    <div className="audio-room flex flex-col h-full bg-card border rounded-lg overflow-hidden shadow-sm">
      {/* Header */}
      <div className="audio-room-header p-4 border-b">
        <h2 className="text-lg font-bold uppercase tracking-tight text-foreground">Audio Room</h2>
        <p className="text-sm font-medium text-muted-foreground uppercase opacity-80">Room ID: {roomId}</p>
      </div>

      {/* Main content */}
      <div className="audio-room-content flex-1 p-4 overflow-y-auto">
        {/* Speakers */}
        <div className="speakers-section mb-6">
          <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3">Speakers</h3>
          <SpeakerGrid
            speakers={speakers.map((id: string) => ({ id }))}
            myId={myId || undefined}
            speaking={speaking}
            agentInfo={agentInfo}
          />
        </div>

        {/* AI Agent (current agent) */}
        {agentInfo && (
          <div className="agent-section mb-6">
            <AgentSpeaker
              name={agentInfo.name}
              avatarUrl={agentInfo.avatarUrl}
              isSpeaking={isSpeaking}
              agentId={agentId}
            />
          </div>
        )}

        {/* Listeners */}
        <div className="listeners-section">
          <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3">
            Listeners ({listeners.length})
          </h3>
          <ListenerList listeners={listeners.map((id: string) => ({ id }))} />
        </div>
      </div>

      {/* Controls */}
      <div className="audio-room-controls p-4 border-t bg-muted/30">
        <RoomControls
          isMuted={isMuted}
          isSpeaking={isSpeaking}
          onMuteToggle={handleMuteToggle}
          onLeave={handleLeave}
          onReaction={handleReaction}
        />
      </div>
    </div>
  );
}

export default AudioRoom;
