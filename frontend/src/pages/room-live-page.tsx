/**
 * Room Live Page
 *
 * Real-time interface for live room sessions with message feed, participant list,
 * and audio player. Displays orchestrator scores and selected messages.
 */

import React, { useState } from 'react';
import { useRoom, useWebSocket } from '../hooks';
import { Message } from '../types';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';

interface RoomLivePageProps {
  roomId: string;
}

/**
 * Real-time room interface
 */
export function RoomLivePage({ roomId }: RoomLivePageProps) {
  const { room, messages, selectedMessages, isLoading, error, submitMessage, closeRoom } =
    useRoom(roomId);
  const { isConnected } = useWebSocket();
  const [messageInput, setMessageInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Handle message submission
   */
  const handleSubmitMessage = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!messageInput.trim()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await submitMessage(messageInput);
      setMessageInput('');
    } catch (err) {
      console.error('Failed to submit message:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handle close room
   */
  const handleCloseRoom = async () => {
    if (window.confirm('Close this room? This action cannot be undone.')) {
      try {
        await closeRoom();
      } catch (err) {
        console.error('Failed to close room:', err);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Loading room...</p>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Room not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b-2 border-black p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold uppercase">{room.type} Room</h1>
            <p className="text-gray-600 mt-1">{room.objective}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-gray-600">Status</p>
              <Badge variant={room.status === 'active' ? 'success' : 'default'} isLive={true}>
                {room.status}
              </Badge>
            </div>
            <div className="w-px h-12 bg-black"></div>
            <div className="text-right">
              <p className="text-sm text-gray-600">WebSocket</p>
              <Badge variant={isConnected ? 'success' : 'error'} isLive={isConnected}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </Badge>
            </div>
          </div>
        </div>
      </header>

      {error && (
        <div className="p-4 border-b-2 border-red-500 bg-red-50">
          <p className="text-red-700 font-semibold">Error</p>
          <p className="text-red-600 text-sm">{error.message}</p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-6 p-6 h-[calc(100vh-200px)]">
        {/* Messages Feed */}
        <div className="col-span-2 flex flex-col border-2 border-black">
          {/* Messages List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-400">
                <p>No messages yet. Be the first to speak!</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-3 border-l-4 ${
                    msg.selected ? 'border-cyan-500 bg-cyan-50' : 'border-gray-300 bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs text-gray-600 font-semibold">{msg.agentId}</p>
                    {msg.score !== undefined && (
                      <span className="text-xs font-bold bg-black text-white px-2 py-1">
                        {msg.score.toFixed(0)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm mt-2">{msg.text}</p>
                </div>
              ))
            )}
          </div>

          {/* Message Input */}
          <form onSubmit={handleSubmitMessage} className="border-t-2 border-black p-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder="Type your message..."
                disabled={isSubmitting || room.status !== 'active'}
                className="flex-1 px-3 py-2 border-2 border-black font-inter focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting || !messageInput.trim() || room.status !== 'active'}
              >
                {isSubmitting ? '...' : 'Send'}
              </Button>
            </div>
          </form>
        </div>

        {/* Right Sidebar */}
        <div className="flex flex-col gap-4">
          {/* Room Stats */}
          <Card variant="default" className="p-4">
            <h3 className="font-bold uppercase text-sm mb-3">Room Stats</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Participants:</span>
                <span className="font-bold">{room.participantCount}</span>
              </div>
              <div className="flex justify-between">
                <span>Viewers:</span>
                <span className="font-bold">{room.listenerCount}</span>
              </div>
              <div className="flex justify-between">
                <span>Duration:</span>
                <span className="font-bold">{Math.floor(room.duration / 60)}m</span>
              </div>
            </div>
          </Card>

          {/* Selected Messages */}
          <Card variant="default" className="p-4 flex-1 overflow-y-auto">
            <h3 className="font-bold uppercase text-sm mb-3">Selected Messages</h3>
            {selectedMessages.length === 0 ? (
              <p className="text-xs text-gray-600">No selected messages yet</p>
            ) : (
              <div className="space-y-2">
                {selectedMessages.map((msg) => (
                  <div key={msg.id} className="p-2 bg-cyan-50 border-l-2 border-cyan-500">
                    <p className="text-xs font-semibold">{msg.agentId}</p>
                    <p className="text-xs mt-1 line-clamp-2">{msg.text}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Close Room Button */}
          <Button
            variant="secondary"
            onClick={handleCloseRoom}
            disabled={room.status !== 'active'}
            className="w-full"
          >
            Close Room
          </Button>
        </div>
      </div>
    </div>
  );
}
