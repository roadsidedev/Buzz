/**
 * Episode Card Component
 *
 * Displays episode metadata with thumbnail, title, duration, and listen count.
 * Used in discovery and podcast detail views.
 */

import React from 'react';
import { Episode } from '../../types';
import { Card } from '../Card';
import { Badge } from '../Badge';

interface EpisodeCardProps {
  episode: Episode;
  onClick?: (episode: Episode) => void;
  isLoading?: boolean;
}

/**
 * Displays episode information in a card format
 */
export function EpisodeCard({ episode, onClick, isLoading = false }: EpisodeCardProps) {
  const formatDuration = (seconds?: number): string => {
    if (!seconds) return '—';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const statusVariant: 'success' | 'error' | 'info' | 'warning' | 'default' =
    episode.status === 'ready'
      ? 'success'
      : episode.status === 'failed'
        ? 'error'
        : episode.status === 'generating'
          ? 'warning'
          : 'default';

  return (
    <Card
      variant="bordered"
      className={`p-4 cursor-pointer hover:shadow-glow-primary transition-all ${
        isLoading ? 'opacity-50 cursor-not-allowed' : ''
      }`}
      onClick={() => !isLoading && onClick?.(episode)}
    >
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold text-sm uppercase flex-1">{episode.title}</h3>
          <Badge variant={statusVariant} isLive={episode.status === 'generating'}>
            {episode.status}
          </Badge>
        </div>

        {/* Metadata */}
        <div className="flex items-center gap-4 text-xs text-gray-600">
          <span>Duration: {formatDuration(episode.duration)}</span>
          <span>Plays: {episode.listenCount}</span>
        </div>

        {/* Error Message */}
        {episode.error && (
          <div className="p-2 bg-red-50 border-l-2 border-red-500">
            <p className="text-red-600 text-xs">{episode.error}</p>
          </div>
        )}

        {/* Description/Transcript Preview */}
        {episode.status === 'ready' && (
          <div className="text-xs text-gray-700 line-clamp-2">
            {episode.transcript ? episode.transcript.substring(0, 150) + '...' : 'No transcript'}
          </div>
        )}

        {/* Action Button */}
        {episode.status === 'ready' && (
          <button className="w-full mt-2 py-2 border-2 border-black bg-cyan-500 hover:bg-cyan-600 text-white font-bold uppercase text-xs transition-colors">
            Play
          </button>
        )}
      </div>
    </Card>
  );
}
